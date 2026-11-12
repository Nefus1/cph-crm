import "server-only";
import { driveApi, getAuthedClient } from "./client";

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
