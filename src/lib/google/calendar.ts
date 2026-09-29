import "server-only";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { events, matters } from "@/db/schema";
import { appUrl } from "@/lib/env";
import { calendarApi, getAuthedClient, googleErrorMessage } from "./client";
import { toGcalEvent } from "./event-format";

export async function listCalendars() {
  const authed = await getAuthedClient();
  if (!authed) throw new Error("Google is not connected");
  const res = await calendarApi(authed.client).calendarList.list({ minAccessRole: "writer", maxResults: 250 });
  return (res.data.items ?? []).map((c) => ({ id: c.id!, name: c.summaryOverride || c.summary || c.id!, primary: !!c.primary }));
}

/** Push one CRM event to Google Calendar (create, update, or delete). */
export async function syncEvent(eventId: string): Promise<{ ok: boolean; error?: string }> {
  const ev = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!ev) return { ok: true };
  const authed = await getAuthedClient();
  if (!authed || !authed.settings.calendarId) {
    if (ev.deletedAt) await db.delete(events).where(eq(events.id, ev.id));
    else await db.update(events).set({ syncStatus: "off", syncError: null }).where(eq(events.id, ev.id));
    return { ok: false, error: "Calendar not connected" };
  }
  const cal = calendarApi(authed.client);
  const calendarId = authed.settings.calendarId;
  try {
    if (ev.deletedAt) {
      if (ev.gcalEventId) {
        try {
          await cal.events.delete({ calendarId, eventId: ev.gcalEventId });
        } catch (err) {
          const code = (err as { code?: number }).code;
          if (code !== 404 && code !== 410) throw err;
        }
      }
      await db.delete(events).where(eq(events.id, ev.id));
      return { ok: true };
    }
    const matter = ev.matterId ? ((await db.query.matters.findFirst({ where: eq(matters.id, ev.matterId) })) ?? null) : null;
    const body = toGcalEvent(ev, matter, appUrl());
    let gcalId = ev.gcalEventId;
    if (gcalId) {
      try {
        await cal.events.update({ calendarId, eventId: gcalId, requestBody: body });
      } catch (err) {
        const code = (err as { code?: number }).code;
        if (code === 404 || code === 410) gcalId = null;
        else throw err;
      }
    }
    if (!gcalId) {
      const res = await cal.events.insert({ calendarId, requestBody: body });
      gcalId = res.data.id ?? null;
    }
    await db.update(events).set({ gcalEventId: gcalId, syncStatus: "synced", syncError: null }).where(eq(events.id, ev.id));
    return { ok: true };
  } catch (err) {
    const msg = googleErrorMessage(err);
    await db.update(events).set({ syncStatus: "error", syncError: msg.slice(0, 500) }).where(eq(events.id, ev.id));
    return { ok: false, error: msg };
  }
}

/** Resync everything that is pending, errored, or soft-deleted. Used by the cron route. */
export async function syncPendingEvents(limit = 50) {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(or(inArray(events.syncStatus, ["pending", "error"]), isNotNull(events.deletedAt)))
    .limit(limit);
  let ok = 0;
  let failed = 0;
  for (const r of rows) {
    const res = await syncEvent(r.id);
    if (res.ok) ok++;
    else failed++;
  }
  return { processed: rows.length, ok, failed };
}

/** After connecting a calendar, queue every event that was created while sync was off. */
export async function queueUnsyncedEvents() {
  await db.update(events).set({ syncStatus: "pending" }).where(and(isNull(events.deletedAt), eq(events.syncStatus, "off")));
}

/** Existing events on the Google calendar (for import/linking). */
export async function listGoogleEvents(fromISO: string, max = 250) {
  const authed = await getAuthedClient();
  if (!authed || !authed.settings.calendarId) throw new Error("Calendar not connected");
  const res = await calendarApi(authed.client).events.list({
    calendarId: authed.settings.calendarId,
    timeMin: new Date(`${fromISO}T00:00:00Z`).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: max,
  });
  return (res.data.items ?? []).map((e) => ({
    id: e.id!,
    summary: e.summary ?? "(no title)",
    description: e.description ?? "",
    location: e.location ?? "",
    date: e.start?.date ?? (e.start?.dateTime ? e.start.dateTime.slice(0, 10) : ""),
    time: e.start?.dateTime ? e.start.dateTime.slice(11, 16) : null,
    allDay: !!e.start?.date,
    cphEventId: e.extendedProperties?.private?.cphEventId ?? null,
  }));
}
