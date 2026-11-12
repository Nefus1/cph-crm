"use server";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appSettings, folderConnectors, folderJobs, matterFolders, matters } from "@/db/schema";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { discoverFolder, enqueueFolder } from "@/lib/folders/service";
import { driveApi, getAuthedClient } from "@/lib/google/client";
import { getSettings } from "@/server/queries/settings";
import { fail } from "@/server/types";
import { logActivity, revalidateAll } from "./_helpers";

export async function requestCaseFolder(matterId: string, verification = false) {
  try {
    const me = verification ? await requireAdmin() : await requireStaff();
    z.string().uuid().parse(matterId);
    const id = await db.transaction(async (tx) => {
      const id = await enqueueFolder(tx, matterId, verification);
      await logActivity(tx, { matterId, type: "system", body: "Folder setup requested", messageKey: "folderRequested", authorId: me.id });
      return id;
    });
    revalidateAll();
    return { ok: true as const, data: { id } };
  } catch (e) {
    return fail(e);
  }
}
export async function retryCaseFolder(id: string) {
  try {
    await requireStaff();
    z.string().uuid().parse(id);
    await db.transaction(async (tx) => {
      const [binding] = await tx.select().from(matterFolders).where(eq(matterFolders.id, id));
      if (!binding) throw new Error("not_found");
      const settings = await tx.query.appSettings.findFirst({ where: eq(appSettings.id, 1) });
      const [job] = await tx.select().from(folderJobs).where(eq(folderJobs.bindingId, id)).for("update");
      if (job && (job.state === "error" || job.state === "waiting")) {
        const connectorId = settings?.folderConnectorId;
        const connector = connectorId ? await tx.query.folderConnectors.findFirst({ where: eq(folderConnectors.id, connectorId) }) : null;
        if (!connector || connector.revokedAt) throw new Error("connector_revoked");
        if (binding.localRoot !== settings?.folderRoot || (!binding.isVerification && (!settings?.folderSetupEnabled || !settings.folderMappingVerifiedAt)))
          throw new Error("folder_setup_disabled");
        await tx
          .update(folderJobs)
          .set({ connectorId: connector.id, state: "waiting", attempts: 0, error: null, leaseToken: null, leaseUntil: null, nextAttemptAt: new Date() })
          .where(eq(folderJobs.id, job.id));
        await tx.update(matterFolders).set({ localStatus: "waiting" }).where(eq(matterFolders.id, id));
      }
    });
    await discoverFolder(id);
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
export async function registerFolderConnector(name: string) {
  try {
    await requireAdmin();
    const label = z.string().trim().min(1).max(100).parse(name);
    const token = randomBytes(32).toString("hex");
    const [row] = await db
      .insert(folderConnectors)
      .values({ name: label, tokenHash: createHash("sha256").update(token).digest("hex") })
      .returning({ id: folderConnectors.id });
    revalidateAll();
    return { ok: true as const, data: { id: row.id, token } };
  } catch (e) {
    return fail(e);
  }
}
export async function revokeFolderConnector(id: string) {
  try {
    await requireAdmin();
    z.string().uuid().parse(id);
    await db.transaction(async (tx) => {
      await tx.update(folderConnectors).set({ revokedAt: new Date() }).where(eq(folderConnectors.id, id));
      await tx.update(appSettings).set({ folderSetupEnabled: false, folderMappingVerifiedAt: null }).where(eq(appSettings.folderConnectorId, id));
    });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
export async function saveFolderSettings(raw: { root: string; connectorId: string; enabled: boolean }) {
  try {
    await requireAdmin();
    const input = z
      .object({
        root: z
          .string()
          .trim()
          .min(3)
          .max(160)
          .regex(/^(?:[A-Za-z]:\\|\\\\[^\\]+\\[^\\]+\\?)/),
        connectorId: z.string().uuid(),
        enabled: z.boolean(),
      })
      .parse(raw);
    if (/^[A-Za-z]:\\?$/.test(input.root) || /[<>"|?*\/\x00-\x1f]/.test(input.root) || input.root.split("\\").some((p) => p === "." || p === ".."))
      throw new Error("invalid_path");
    await db.transaction(async (tx) => {
      const [settings] = await tx.select().from(appSettings).where(eq(appSettings.id, 1)).for("update");
      const c = await tx.query.folderConnectors.findFirst({ where: eq(folderConnectors.id, input.connectorId) });
      if (!c || c.revokedAt) throw new Error("connector_revoked");
      const changed = settings.folderRoot !== input.root.replace(/\\+$/, "") || settings.folderConnectorId !== input.connectorId;
      if (input.enabled && (changed || !settings.folderMappingVerifiedAt || !settings.casesFolderId)) throw new Error("mapping_unverified");
      await tx
        .update(appSettings)
        .set({
          folderRoot: input.root.replace(/\\+$/, ""),
          folderConnectorId: input.connectorId,
          folderSetupEnabled: input.enabled,
          ...(changed ? { folderMappingVerifiedAt: null } : {}),
        })
        .where(eq(appSettings.id, 1));
    });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
export async function verifyFolderMapping(bindingId: string) {
  try {
    await requireAdmin();
    z.string().uuid().parse(bindingId);
    await db.transaction(async (tx) => {
      const [settings] = await tx.select().from(appSettings).where(eq(appSettings.id, 1)).for("update");
      const b = await tx.query.matterFolders.findFirst({ where: eq(matterFolders.id, bindingId) });
      const job = await tx.query.folderJobs.findFirst({ where: eq(folderJobs.bindingId, bindingId) });
      if (
        !b?.isVerification ||
        b.discoveryStatus !== "linked" ||
        b.localStatus !== "ready" ||
        b.localRoot !== settings.folderRoot ||
        b.driveRootId !== settings.casesFolderId ||
        job?.connectorId !== settings.folderConnectorId
      )
        throw new Error("mapping_unverified");
      await tx.update(appSettings).set({ folderMappingVerifiedAt: new Date() }).where(eq(appSettings.id, 1));
    });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}

async function inspectFolder(folderId: string) {
  z.string()
    .min(1)
    .max(200)
    .regex(/^[\w-]+$/)
    .parse(folderId);
  const settings = await getSettings();
  const authed = await getAuthedClient();
  if (!authed || !settings.casesFolderId) throw new Error("google_disconnected");
  const drive = driveApi(authed.client);
  let current = folderId;
  const names: string[] = [];
  for (let depth = 0; depth < 20 && current !== settings.casesFolderId; depth++) {
    const { data } = await drive.files.get({ fileId: current, fields: "id,name,parents,mimeType,trashed", supportsAllDrives: true });
    if (data.trashed || data.mimeType !== "application/vnd.google-apps.folder" || data.parents?.length !== 1 || !data.name || /[/\\]/.test(data.name))
      throw new Error("invalid_path");
    names.unshift(data.name);
    current = data.parents[0];
  }
  if (current !== settings.casesFolderId || !names.length) throw new Error("invalid_path");
  return { folderId, relativePath: names.join("/"), url: `https://drive.google.com/drive/folders/${folderId}`, rootId: settings.casesFolderId };
}
export async function previewExistingFolder(folderId: string) {
  try {
    await requireAdmin();
    return { ok: true as const, data: await inspectFolder(folderId) };
  } catch (e) {
    return fail(e);
  }
}
export async function linkExistingFolder(matterId: string, folderId: string, expectedPath: string, localConfirmed: boolean) {
  try {
    const me = await requireAdmin();
    z.string().uuid().parse(matterId);
    const preview = await inspectFolder(folderId); // recheck the actual folder at commit
    if (preview.relativePath !== expectedPath) throw new Error("folder_changed");
    const settings = await getSettings();
    if (localConfirmed && !settings.folderRoot) throw new Error("invalid_path");
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`folder:${matterId}`}, 0))`);
      if (!(await tx.query.matters.findFirst({ where: eq(matters.id, matterId) }))) throw new Error("not_found");
      const linked = await tx.query.matterFolders.findFirst({ where: and(eq(matterFolders.matterId, matterId), eq(matterFolders.driveFolderId, folderId)) });
      if (linked) {
        if (linked.origin === "legacy" && localConfirmed)
          await tx
            .update(matterFolders)
            .set({ relativePath: preview.relativePath, localRoot: settings.folderRoot, driveRootId: preview.rootId, localStatus: "ready" })
            .where(eq(matterFolders.id, linked.id));
        return;
      }
      const managed = await tx.query.matterFolders.findFirst({
        where: and(
          eq(matterFolders.matterId, matterId),
          eq(matterFolders.origin, "managed"),
          eq(matterFolders.relativePath, preview.relativePath),
          eq(matterFolders.driveRootId, preview.rootId),
          eq(matterFolders.localStatus, "ready"),
        ),
      });
      if (managed)
        await tx
          .update(matterFolders)
          .set({ driveFolderId: folderId, driveFolderUrl: preview.url, discoveryStatus: "linked", discoveryError: null })
          .where(eq(matterFolders.id, managed.id));
      else
        await tx.insert(matterFolders).values({
          matterId,
          origin: "legacy",
          relativePath: localConfirmed ? preview.relativePath : null,
          localRoot: localConfirmed ? settings.folderRoot || null : null,
          driveRootId: preview.rootId,
          driveFolderId: folderId,
          driveFolderUrl: preview.url,
          localStatus: localConfirmed ? "ready" : "unlinked",
          discoveryStatus: "linked",
        });
      await tx
        .update(matters)
        .set({ driveFolderId: folderId, driveFolderUrl: preview.url, driveStatus: "ok" })
        .where(and(eq(matters.id, matterId), sql`${matters.driveFolderId} is null`));
      await logActivity(tx, { matterId, type: "system", body: "Existing folder linked", messageKey: "folderLinked", authorId: me.id });
    });
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return fail(e);
  }
}
