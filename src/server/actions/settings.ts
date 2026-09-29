"use server";
import { cookies } from "next/headers";
import { after } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { appSettings, staff } from "@/db/schema";
import { getCurrentStaff, requireAdmin, requireStaff } from "@/lib/auth";
import { listCalendars, queueUnsyncedEvents, syncPendingEvents } from "@/lib/google/calendar";
import { getFolderName, listFolders } from "@/lib/google/drive";
import { fail, type ActionResult } from "@/server/types";
import { revalidateAll } from "./_helpers";

export async function setLocale(locale: "en" | "es"): Promise<ActionResult> {
  try {
    const l = locale === "es" ? "es" : "en";
    const store = await cookies();
    store.set("cph_locale", l, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    const me = await getCurrentStaff();
    if (me) await db.update(staff).set({ locale: l }).where(eq(staff.id, me.id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateMyName(name: string): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    await db.update(staff).set({ name: z.string().trim().min(1).max(120).parse(name) }).where(eq(staff.id, me.id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(120).default(""),
  role: z.enum(["admin", "staff"]).default("staff"),
});

export async function inviteStaff(raw: z.input<typeof inviteSchema>): Promise<ActionResult> {
  try {
    await requireAdmin();
    const s = inviteSchema.parse(raw);
    await db
      .insert(staff)
      .values({ email: s.email, name: s.name, role: s.role, active: true })
      .onConflictDoUpdate({ target: staff.email, set: { active: true, role: s.role, name: sql`coalesce(nullif(${s.name}, ''), ${staff.name})` } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateStaffMember(id: string, patch: { role?: "admin" | "staff"; active?: boolean; name?: string }): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    if (id === me.id && (patch.role === "staff" || patch.active === false)) return { ok: false, error: "cannot_demote_self" };
    const set: Partial<typeof staff.$inferInsert> = {};
    if (patch.role) set.role = patch.role;
    if (typeof patch.active === "boolean") set.active = patch.active;
    if (typeof patch.name === "string") set.name = patch.name.trim().slice(0, 120);
    await db.update(staff).set(set).where(eq(staff.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateFirmSettings(raw: { defaultSupervisingAttorney?: string; firmName?: string }): Promise<ActionResult> {
  try {
    await requireAdmin();
    const s = z.object({ defaultSupervisingAttorney: z.string().trim().max(120).default(""), firmName: z.string().trim().min(1).max(120).default("CPH") }).parse(raw);
    await db.update(appSettings).set(s).where(eq(appSettings.id, 1));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ─── Google ────────────────────────────────────────────────────────────── */

export async function browseDriveFolders(parentId: string = "root", search?: string): Promise<ActionResult<{ id: string; name: string }[]>> {
  try {
    await requireAdmin();
    return { ok: true, data: await listFolders(parentId || "root", search?.trim() || undefined) };
  } catch (e) {
    return fail(e);
  }
}

export async function setCasesFolder(folderId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const name = await getFolderName(folderId);
    await db.update(appSettings).set({ casesFolderId: folderId, casesFolderName: name }).where(eq(appSettings.id, 1));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function getCalendars(): Promise<ActionResult<{ id: string; name: string; primary: boolean }[]>> {
  try {
    await requireAdmin();
    return { ok: true, data: await listCalendars() };
  } catch (e) {
    return fail(e);
  }
}

export async function setCalendar(calendarId: string, calendarName: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await db.update(appSettings).set({ calendarId, calendarName: calendarName.slice(0, 200) }).where(eq(appSettings.id, 1));
    await queueUnsyncedEvents();
    after(() => syncPendingEvents(200));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function disconnectGoogle(): Promise<ActionResult> {
  try {
    await requireAdmin();
    await db
      .update(appSettings)
      .set({ googleRefreshTokenEnc: null, googleEmail: null, googleConnectedAt: null })
      .where(eq(appSettings.id, 1));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function syncCalendarNow(): Promise<ActionResult<{ processed: number; ok: number; failed: number }>> {
  try {
    await requireStaff();
    const res = await syncPendingEvents(200);
    revalidateAll();
    return { ok: true, data: res };
  } catch (e) {
    return fail(e);
  }
}
