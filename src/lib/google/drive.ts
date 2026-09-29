import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { matters } from "@/db/schema";
import { driveApi, getAuthedClient, googleErrorMessage } from "./client";

export const MATTER_SUBFOLDERS = ["Pleadings", "Correspondence", "Exhibits", "Scans"];
const FOLDER_MIME = "application/vnd.google-apps.folder";

type Drive = ReturnType<typeof driveApi>;

function q(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function findChildFolder(drive: Drive, parentId: string, name: string) {
  const res = await drive.files.list({
    q: `'${q(parentId)}' in parents and name = '${q(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id, name, webViewLink)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0] ?? null;
}

export async function createFolder(drive: Drive, parentId: string, name: string) {
  const res = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: "id, name, webViewLink",
    supportsAllDrives: true,
  });
  return res.data;
}

export async function ensureFolder(drive: Drive, parentId: string, name: string) {
  return (await findChildFolder(drive, parentId, name)) ?? (await createFolder(drive, parentId, name));
}

/** Folder picker: list sub-folders of a folder (or My Drive root), optionally filtered by name. */
export async function listFolders(parentId: string = "root", search?: string) {
  const authed = await getAuthedClient();
  if (!authed) throw new Error("Google is not connected");
  const drive = driveApi(authed.client);
  const clauses = [`mimeType = '${FOLDER_MIME}'`, "trashed = false"];
  if (search) clauses.push(`name contains '${q(search)}'`);
  else clauses.push(`'${q(parentId)}' in parents`);
  const res = await drive.files.list({
    q: clauses.join(" and "),
    fields: "files(id, name, parents)",
    orderBy: "name",
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? []).map((f) => ({ id: f.id!, name: f.name! }));
}

export async function getFolderName(id: string) {
  const authed = await getAuthedClient();
  if (!authed) throw new Error("Google is not connected");
  const res = await driveApi(authed.client).files.get({ fileId: id, fields: "id, name", supportsAllDrives: true });
  return res.data.name ?? id;
}

/**
 * Creates (or reuses) Cases/"Last, First — Type (Side)" with the standard subfolders
 * and stores the link on the matter. Idempotent: an existing same-name folder is reused.
 */
export async function ensureMatterFolder(matterId: string): Promise<{ ok: boolean; error?: string }> {
  const matter = await db.query.matters.findFirst({ where: eq(matters.id, matterId) });
  if (!matter) return { ok: false, error: "Matter not found" };
  const authed = await getAuthedClient();
  if (!authed || !authed.settings.casesFolderId) {
    await db.update(matters).set({ driveStatus: "none", driveError: null }).where(eq(matters.id, matterId));
    return { ok: false, error: "Google Drive is not connected or no Cases folder is selected" };
  }
  try {
    await db.update(matters).set({ driveStatus: "pending", driveError: null }).where(eq(matters.id, matterId));
    const drive = driveApi(authed.client);
    const folder = matter.driveFolderId
      ? (await drive.files.get({ fileId: matter.driveFolderId, fields: "id, name, webViewLink, trashed", supportsAllDrives: true })).data
      : await ensureFolder(drive, authed.settings.casesFolderId, matter.displayName);
    if (!folder?.id) throw new Error("Folder could not be created");
    for (const sub of MATTER_SUBFOLDERS) await ensureFolder(drive, folder.id, sub);
    await db
      .update(matters)
      .set({
        driveFolderId: folder.id,
        driveFolderUrl: folder.webViewLink ?? `https://drive.google.com/drive/folders/${folder.id}`,
        driveStatus: "ok",
        driveError: null,
      })
      .where(eq(matters.id, matterId));
    return { ok: true };
  } catch (err) {
    const msg = googleErrorMessage(err);
    await db.update(matters).set({ driveStatus: "error", driveError: msg.slice(0, 500) }).where(eq(matters.id, matterId));
    return { ok: false, error: msg };
  }
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink?: string;
  modifiedTime?: string;
  isFolder: boolean;
}

export async function listFolderFiles(folderId: string): Promise<DriveFile[]> {
  const authed = await getAuthedClient();
  if (!authed) throw new Error("Google is not connected");
  const res = await driveApi(authed.client).files.list({
    q: `'${q(folderId)}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, webViewLink, iconLink, modifiedTime)",
    orderBy: "folder, name",
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType ?? "",
    webViewLink: f.webViewLink ?? `https://drive.google.com/open?id=${f.id}`,
    iconLink: f.iconLink ?? undefined,
    modifiedTime: f.modifiedTime ?? undefined,
    isFolder: f.mimeType === FOLDER_MIME,
  }));
}
