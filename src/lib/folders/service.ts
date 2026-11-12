import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, folderConnectors, folderJobs, matterFolders, matters } from "@/db/schema";
import { folderPayload, retrySeconds } from "./templates";
import { driveApi, getAuthedClient } from "@/lib/google/client";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function enqueueFolder(tx: Tx, matterId: string, verification = false) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`folder:${matterId}`}, 0))`);
  const settings = await tx.query.appSettings.findFirst({ where: eq(appSettings.id, 1) });
  if (
    !settings?.folderConnectorId ||
    !settings.folderRoot ||
    !settings.casesFolderId ||
    (!verification && (!settings.folderSetupEnabled || !settings.folderMappingVerifiedAt))
  )
    throw new Error("folder_setup_disabled");
  const connector = await tx.query.folderConnectors.findFirst({ where: eq(folderConnectors.id, settings.folderConnectorId) });
  if (!connector || connector.revokedAt) throw new Error("connector_revoked");
  const matter = await tx.query.matters.findFirst({ where: eq(matters.id, matterId) });
  if (!matter || matter.archivedAt) throw new Error("not_found");
  const existing = await tx.query.matterFolders.findFirst({ where: eq(matterFolders.matterId, matterId) });
  if (existing) return existing.id;
  const payload = folderPayload(matter, settings.folderRoot);
  const [binding] = await tx
    .insert(matterFolders)
    .values({
      matterId,
      origin: "managed",
      relativePath: payload.relativePath,
      localRoot: payload.root,
      templateVersion: payload.templateVersion,
      driveRootId: settings.casesFolderId,
      isVerification: verification,
    })
    .returning();
  await tx.insert(folderJobs).values({ bindingId: binding.id, connectorId: connector.id, payload });
  return binding.id;
}

export async function findSyncedFolder(parentId: string, relativePath: string) {
  const authed = await getAuthedClient();
  if (!authed) throw new Error("google_disconnected");
  const drive = driveApi(authed.client);
  let parent = parentId;
  const parts = relativePath.split("/");
  if (parts.some((p) => !p || p === "." || p === ".." || /[\\\x00-\x1f]/.test(p))) throw new Error("invalid_path");
  const escape = (v: string) => v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  let found: { id: string; name: string; webViewLink: string } | null = null;
  for (const name of parts) {
    const res = await drive.files.list({
      q: `'${escape(parent)}' in parents and name = '${escape(name)}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id,name,webViewLink),nextPageToken",
      pageSize: 2,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (!res.data.files?.length) return null;
    if (res.data.files.length !== 1 || res.data.nextPageToken) throw new Error("folder_ambiguous");
    const f = res.data.files[0];
    found = { id: f.id!, name: f.name!, webViewLink: f.webViewLink ?? `https://drive.google.com/drive/folders/${f.id}` };
    parent = found.id;
  }
  return found;
}

export async function discoverFolder(id: string) {
  const binding = await db.query.matterFolders.findFirst({ where: eq(matterFolders.id, id) });
  if (!binding || binding.localStatus !== "ready" || !binding.relativePath || binding.discoveryStatus === "linked") return;
  let error: string | null = null;
  try {
    if (!binding.driveRootId) throw new Error("google_disconnected");
    const folder = await findSyncedFolder(binding.driveRootId!, binding.relativePath);
    if (folder) {
      await db.transaction(async (tx) => {
        const updated = await tx
          .update(matterFolders)
          .set({ driveFolderId: folder.id, driveFolderUrl: folder.webViewLink, discoveryStatus: "linked", discoveryError: null })
          .where(and(eq(matterFolders.id, id), sql`${matterFolders.discoveryStatus} <> 'linked'`))
          .returning({ id: matterFolders.id });
        if (!updated.length) return;
        // Preserve previously selected legacy links.
        await tx
          .update(matters)
          .set({ driveFolderId: folder.id, driveFolderUrl: folder.webViewLink, driveStatus: "ok", driveError: null })
          .where(and(eq(matters.id, binding.matterId), sql`${matters.driveFolderId} is null`));
      });
      return;
    }
  } catch (e) {
    error = e instanceof Error && ["folder_ambiguous", "google_disconnected", "invalid_path"].includes(e.message) ? e.message : "drive_error";
  }
  await db
    .update(matterFolders)
    .set({
      discoveryStatus: error ? "error" : "waiting",
      discoveryError: error,
      discoveryAttempts: binding.discoveryAttempts + 1,
      nextDiscoveryAt: new Date(Date.now() + retrySeconds(binding.discoveryAttempts + 1) * 1000),
    })
    .where(and(eq(matterFolders.id, id), sql`${matterFolders.discoveryStatus} <> 'linked'`));
}
export async function discoverPendingFolders(limit = 10) {
  const rows = await db
    .select({ id: matterFolders.id })
    .from(matterFolders)
    .where(sql`${matterFolders.localStatus} = 'ready' and ${matterFolders.discoveryStatus} <> 'linked' and ${matterFolders.nextDiscoveryAt} <= now()`)
    .limit(limit);
  for (const row of rows) await discoverFolder(row.id);
  return rows.length;
}
