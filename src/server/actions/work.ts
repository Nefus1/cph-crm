"use server";
import { after } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activities, events, ledgerEntries, tasks } from "@/db/schema";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { syncEvent } from "@/lib/google/calendar";
import { formatCents } from "@/lib/money";
import { activityInput, eventInput, ledgerInput, taskInput } from "@/server/schemas";
import { getSettings } from "@/server/queries/settings";
import { fail, type ActionResult } from "@/server/types";
import { logActivity, revalidateAll } from "./_helpers";

/* ─── Tasks ─────────────────────────────────────────────────────────────── */

export async function createTask(raw: z.input<typeof taskInput>): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireStaff();
    const t = taskInput.parse(raw);
    const [row] = await db
      .insert(tasks)
      .values({ ...t, assigneeId: t.assigneeId ?? me.id, createdBy: me.id })
      .returning({ id: tasks.id });
    revalidateAll();
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTask(id: string, raw: z.input<typeof taskInput>): Promise<ActionResult> {
  try {
    await requireStaff();
    const t = taskInput.parse(raw);
    await db.update(tasks).set(t).where(eq(tasks.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleTask(id: string, done: boolean): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    const [row] = await db
      .update(tasks)
      .set(done ? { completedAt: sql`now()`, completedBy: me.id } : { completedAt: null, completedBy: null })
      .where(eq(tasks.id, id))
      .returning();
    if (done && row?.matterId) await logActivity(db, { matterId: row.matterId, type: "system", body: `Task completed: ${row.title}`, authorId: me.id });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    await requireStaff();
    await db.delete(tasks).where(eq(tasks.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ─── Hearings & deadlines ──────────────────────────────────────────────── */

async function initialSyncStatus() {
  const s = await getSettings();
  return s.googleRefreshTokenEnc && s.calendarId ? "pending" : "off";
}

export async function createEvent(raw: z.input<typeof eventInput>): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireStaff();
    const e = eventInput.parse(raw);
    const syncStatus = await initialSyncStatus();
    const [row] = await db
      .insert(events)
      .values({ ...e, allDay: !e.time, computedFrom: e.computedFrom ?? null, syncStatus, createdBy: me.id })
      .returning({ id: events.id });
    if (e.matterId) {
      await logActivity(db, { matterId: e.matterId, type: "system", body: `${e.kind === "hearing" ? "Hearing" : e.kind === "deadline" ? "Deadline" : "Appointment"} added: ${e.title} — ${formatDate(e.date)}`, authorId: me.id });
    }
    if (syncStatus === "pending") after(() => syncEvent(row.id));
    revalidateAll();
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    return fail(err);
  }
}

/** Save several confirmed dates at once (from the UD deadline calculator). */
export async function createEvents(list: z.input<typeof eventInput>[]): Promise<ActionResult<{ count: number }>> {
  try {
    const me = await requireStaff();
    const parsed = list.map((x) => eventInput.parse(x));
    if (parsed.length === 0) return { ok: true, data: { count: 0 } };
    const syncStatus = await initialSyncStatus();
    const rows = await db
      .insert(events)
      .values(parsed.map((e) => ({ ...e, allDay: !e.time, computedFrom: e.computedFrom ?? null, syncStatus, createdBy: me.id })))
      .returning({ id: events.id, matterId: events.matterId, title: events.title, date: events.date });
    const matterId = rows[0]?.matterId;
    if (matterId) {
      await logActivity(db, { matterId, type: "system", body: `Dates added from calculator: ${rows.map((r) => `${r.title} (${formatDate(r.date)})`).join("; ")}`, authorId: me.id });
    }
    if (syncStatus === "pending") {
      after(async () => {
        for (const r of rows) await syncEvent(r.id);
      });
    }
    revalidateAll();
    return { ok: true, data: { count: rows.length } };
  } catch (err) {
    return fail(err);
  }
}

export async function updateEvent(id: string, raw: z.input<typeof eventInput>): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    const e = eventInput.parse(raw);
    const current = await db.query.events.findFirst({ where: eq(events.id, id) });
    if (!current) return { ok: false, error: "not_found" };
    const syncStatus = current.syncStatus === "off" ? await initialSyncStatus() : "pending";
    await db
      .update(events)
      .set({ ...e, allDay: !e.time, computedFrom: e.computedFrom ?? current.computedFrom, syncStatus })
      .where(eq(events.id, id));
    if (current.matterId && (current.date !== e.date || current.status !== e.status)) {
      await logActivity(db, {
        matterId: current.matterId,
        type: "system",
        body: current.status !== e.status ? `${e.title}: marked ${e.status}` : `${e.title} moved from ${formatDate(current.date)} to ${formatDate(e.date)}`,
        authorId: me.id,
      });
    }
    if (syncStatus === "pending") after(() => syncEvent(id));
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setEventStatus(id: string, status: "scheduled" | "done" | "continued" | "vacated"): Promise<ActionResult> {
  try {
    await requireStaff();
    const current = await db.query.events.findFirst({ where: eq(events.id, id) });
    if (!current) return { ok: false, error: "not_found" };
    const syncStatus = current.syncStatus === "off" ? "off" : "pending";
    await db.update(events).set({ status, syncStatus }).where(eq(events.id, id));
    if (syncStatus === "pending") after(() => syncEvent(id));
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    const [row] = await db.update(events).set({ deletedAt: sql`now()` }).where(and(eq(events.id, id), isNull(events.deletedAt))).returning();
    if (row?.matterId) await logActivity(db, { matterId: row.matterId, type: "system", body: `Removed: ${row.title} (${formatDate(row.date)})`, authorId: me.id });
    if (row) after(() => syncEvent(id));
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function retryEventSync(id: string): Promise<ActionResult> {
  try {
    await requireStaff();
    await db.update(events).set({ syncStatus: "pending" }).where(eq(events.id, id));
    const res = await syncEvent(id);
    revalidateAll();
    return res.ok ? { ok: true } : { ok: false, error: res.error ?? "sync_error" };
  } catch (err) {
    return fail(err);
  }
}

/* ─── Fees & payments ───────────────────────────────────────────────────── */

export async function addLedgerEntry(raw: z.input<typeof ledgerInput>): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    const l = ledgerInput.parse(raw);
    if (l.kind !== "adjustment" && l.amountCents <= 0) return { ok: false, error: "amount_positive" };
    if (l.amountCents === 0) return { ok: false, error: "amount_positive" };
    await db.insert(ledgerEntries).values({ ...l, createdBy: me.id });
    const label = l.kind === "payment" ? "Payment received" : l.kind === "charge" ? "Charge added" : "Adjustment";
    await logActivity(db, {
      matterId: l.matterId,
      type: l.kind === "payment" ? "payment" : "system",
      body: `${label}: ${formatCents(l.amountCents)}${l.description ? ` — ${l.description}` : ""}${l.method ? ` (${l.method})` : ""}`,
      authorId: me.id,
    });
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteLedgerEntry(id: string): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    const entry = await db.query.ledgerEntries.findFirst({ where: eq(ledgerEntries.id, id) });
    if (!entry) return { ok: true };
    if (me.role !== "admin" && entry.createdBy !== me.id) return { ok: false, error: "admin_only" };
    await db.delete(ledgerEntries).where(eq(ledgerEntries.id, id));
    await logActivity(db, { matterId: entry.matterId, type: "system", body: `Deleted ${entry.kind}: ${formatCents(entry.amountCents)}${entry.description ? ` — ${entry.description}` : ""}`, authorId: me.id });
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/* ─── Timeline ──────────────────────────────────────────────────────────── */

export async function addActivity(raw: z.input<typeof activityInput>): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    const a = activityInput.parse(raw);
    if (!a.matterId && !a.contactId) return { ok: false, error: "required" };
    await db.insert(activities).values({
      matterId: a.matterId,
      contactId: a.contactId,
      type: a.type,
      body: a.body,
      occurredAt: a.occurredAt ? new Date(a.occurredAt) : new Date(),
      authorId: me.id,
    });
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteActivity(id: string): Promise<ActionResult> {
  try {
    const me = await requireStaff();
    const row = await db.query.activities.findFirst({ where: eq(activities.id, id) });
    if (!row) return { ok: true };
    if (me.role !== "admin" && row.authorId !== me.id) return { ok: false, error: "admin_only" };
    if (!["note", "call", "email", "meeting", "sms"].includes(row.type)) return { ok: false, error: "system_entry" };
    await db.delete(activities).where(eq(activities.id, id));
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/* ─── Admin: court holidays ─────────────────────────────────────────────── */

export async function addHoliday(date: string, name: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(date);
    const n = z.string().trim().min(1).max(120).parse(name);
    const { courtHolidays } = await import("@/db/schema");
    await db.insert(courtHolidays).values({ date: d, name: n }).onConflictDoUpdate({ target: courtHolidays.date, set: { name: n } });
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteHoliday(date: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { courtHolidays } = await import("@/db/schema");
    await db.delete(courtHolidays).where(eq(courtHolidays.date, date));
    revalidateAll();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
