import "server-only";
import type { calendar_v3 } from "googleapis";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { events, matters, type CalEvent, type Matter } from "@/db/schema";
import { areaConfig } from "@/config/practice-areas";
import { gcalReminderMinutes } from "@/config/reminder-ladders";
import { addDaysISO, FIRM_TZ } from "@/lib/dates";
import { appUrl } from "@/lib/env";
import { calendarApi, getAuthedClient, googleErrorMessage } from "./client";

export async function listCalendars() {
  const authed = await getAuthedClient();
  if (!authed) throw new Error("Google is not connected");
  const res = await calendarApi(authed.client).calendarList.list({ minAccessRole: "writer", maxResults: 250 });
  return (res.data.items ?? []).map((c) => ({ id: c.id!, name: c.summaryOverride || c.summary || c.id!, primary: !!c.primary }));
}

function addMinutes(date: string, time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const dayShift = Math.floor(total / 1440);
  const mins = ((total % 1440) + 1440) % 1440;
  return {
    date: addDaysISO(date, dayShift),
    time: `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`,
  };
}

/** "[UD] Acosta — Answer due · 26CMUD01121" */
export function gcalTitle(ev: Pick<CalEvent, "title" | "status">, matter: Pick<Matter, "practiceArea" | "displayName" | "caseNumber"> | null) {
  const prefix = ev.status === "vacated" ? "[VACATED] " : ev.status === "continued" ? "[CONTINUED] " : "";
  if (!matter) return `${prefix}${ev.title}`;
  const badge = areaConfig(matter.practiceArea).badge;
  const client = matter.displayName.split(" — ")[0].split(",")[0].trim();
  return `${prefix}[${badge}] ${client} — ${ev.title}${matter.caseNumber ? ` · ${matter.caseNumber}` : ""}`;
}

export function toGcalEvent(ev: CalEvent, matter: Matter | null): calendar_v3.Schema$Event {
  const link = matter ? `${appUrl()}/matters/${matter.id}` : `${appUrl()}/calendar`;
  const description = [ev.notes, matter ? `Matter: ${matter.displayName}${matter.number ? ` (${matter.number})` : ""}` : "", ev.computedFrom ? `Computed: ${ev.computedFrom} — verify against the court record` : "", `Open in CRM: ${link}`]
    .filter(Boolean)
    .join("\n\n");
  const reminders = gcalReminderMinutes(ev.ladder, ev.allDay || !ev.time);
  const base: calendar_v3.Schema$Event = {
    summary: gcalTitle(ev, matter),
    description,
    location: ev.location || undefined,
    reminders: reminders.length ? { useDefault: false, overrides: reminders.slice(0, 5).map((minutes) => ({ method: "popup", minutes })) } : { useDefault: true },
    extendedProperties: { private: { cphEventId: ev.id } },
  };
  if (ev.allDay || !ev.time) {
    base.start = { date: ev.date };
    base.end = { date: addDaysISO(ev.date, 1) };
  } else {
    const end = addMinutes(ev.date, ev.time, ev.durationMinutes || 60);
    base.start = { dateTime: `${ev.date}T${ev.time}:00`, timeZone: FIRM_TZ };
    base.end = { dateTime: `${end.date}T${end.time}:00`, timeZone: FIRM_TZ };
  }
  return base;
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
    const body = toGcalEvent(ev, matter);
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
