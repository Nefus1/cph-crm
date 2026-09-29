"use server";
import { requireAdmin } from "@/lib/auth";
import { googleErrorMessage } from "@/lib/google/client";
import {
  commitDriveCases,
  commitSheet,
  linkCalendarEvents,
  previewCalendar,
  previewDriveCases,
  previewSheet,
  type CalendarPreviewRow,
  type FolderPreviewRow,
  type SheetPreviewRow,
} from "@/lib/import/server";
import type { ActionResult } from "@/server/types";
import { revalidateAll } from "./_helpers";

function err(e: unknown): { ok: false; error: string } {
  if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
  return { ok: false, error: googleErrorMessage(e) };
}

export async function previewSheetImport(sheet: string, policy: "age" | "active" | "closed"): Promise<ActionResult<{ title: string; spreadsheetId: string; rows: SheetPreviewRow[] }>> {
  try {
    await requireAdmin();
    return { ok: true, data: await previewSheet(sheet, policy) };
  } catch (e) {
    return err(e);
  }
}

export async function commitSheetImport(sheet: string, policy: "age" | "active" | "closed", keys: string[]): Promise<ActionResult<{ createdContacts: number; createdMatters: number }>> {
  try {
    const me = await requireAdmin();
    const res = await commitSheet(sheet, policy, keys, me.id);
    revalidateAll();
    return { ok: true, data: res };
  } catch (e) {
    return err(e);
  }
}

export async function previewDriveImport(): Promise<ActionResult<FolderPreviewRow[]>> {
  try {
    await requireAdmin();
    return { ok: true, data: await previewDriveCases() };
  } catch (e) {
    return err(e);
  }
}

export async function commitDriveImport(folderIds: string[]): Promise<ActionResult<{ linkedCount: number; createdMatters: number }>> {
  try {
    const me = await requireAdmin();
    const res = await commitDriveCases(folderIds, me.id);
    revalidateAll();
    return { ok: true, data: res };
  } catch (e) {
    return err(e);
  }
}

export async function previewCalendarImport(): Promise<ActionResult<CalendarPreviewRow[]>> {
  try {
    await requireAdmin();
    return { ok: true, data: await previewCalendar() };
  } catch (e) {
    return err(e);
  }
}

export async function commitCalendarLinks(links: { gcalId: string; matterId: string | null; kind: "hearing" | "deadline" | "appointment" }[]): Promise<ActionResult<{ count: number }>> {
  try {
    const me = await requireAdmin();
    const res = await linkCalendarEvents(links, me.id);
    revalidateAll();
    return { ok: true, data: res };
  } catch (e) {
    return err(e);
  }
}
