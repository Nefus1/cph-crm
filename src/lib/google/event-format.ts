import type { calendar_v3 } from "googleapis";
import type { CalEvent, Matter } from "@/db/schema";
import { areaConfig } from "@/config/practice-areas";
import { gcalReminderMinutes } from "@/config/reminder-ladders";
import { addDaysISO, FIRM_TZ } from "@/lib/dates";

export function addMinutes(date: string, time: string, minutes: number) {
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

export function toGcalEvent(ev: CalEvent, matter: Matter | null, baseUrl: string): calendar_v3.Schema$Event {
  const link = matter ? `${baseUrl}/matters/${matter.id}` : `${baseUrl}/calendar`;
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

