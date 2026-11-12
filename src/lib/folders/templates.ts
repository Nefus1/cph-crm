import templates from "./generator-templates.json";

export interface FolderJobPayload {
  matterId: string;
  root: string;
  relativePath: string;
  templateVersion: string;
  folders: string[];
  files: Record<string, string>;
}

export function safeFolderName(value: string): string {
  const clean = value
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "");
  if (!clean || clean === "." || clean === "..") throw new Error("invalid_path");
  return (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(clean) ? `_${clean}` : clean).slice(0, 140).replace(/[. ]+$/g, "");
}

export function folderPayload(
  matter: { id: string; number: string; displayName: string; practiceArea: string; matterType: string },
  root: string,
): FolderJobPayload {
  const template =
    matter.practiceArea === "ud"
      ? templates["Unlawful Detainer"]
      : matter.practiceArea === "family" && matter.matterType === "dissolution"
        ? templates.Divorce
        : matter.practiceArea === "trust"
          ? templates["Estate Planning"]
          : matter.practiceArea === "general"
            ? templates.General
            : { folders: ["Pleadings", "Correspondence", "Exhibits", "Scans"], files: templates.General.files };
  const suffixLength = Math.max(...template.folders.map((f) => f.length), ...Object.keys(template.files).map((f) => f.length));
  const leafBudget = Math.min(140, 240 - root.length - suffixLength - 2);
  if (leafBudget < matter.number.length + 8) throw new Error("invalid_path");
  const relativePath = safeFolderName(`${matter.number} — ${matter.displayName}`)
    .slice(0, leafBudget)
    .replace(/[. ]+$/g, "");
  return { matterId: matter.id, root, relativePath, templateVersion: "cph-1", folders: [...template.folders], files: { ...template.files } };
}

export function retrySeconds(attempts: number) {
  return Math.min(3600, 15 * 2 ** Math.min(attempts, 8));
}
