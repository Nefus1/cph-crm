import { describe, expect, it } from "vitest";
import { addMinutes, gcalTitle, toGcalEvent } from "@/lib/google/event-format";
import { gcalReminderMinutes } from "@/config/reminder-ladders";
import type { CalEvent, Matter } from "@/db/schema";

const matter = { id: "m1", practiceArea: "ud", displayName: "Acosta, Francisco — UD (Plaintiff)", caseNumber: "26CMUD01121", number: "CPH-26-0001" } as Matter;
const base = {
  id: "e1",
  matterId: "m1",
  kind: "deadline",
  title: "Answer due",
  allDay: true,
  date: "2026-10-27",
  time: null,
  durationMinutes: 60,
  location: "",
  notes: "",
  ladder: "filing",
  status: "scheduled",
  computedFrom: null,
} as unknown as CalEvent;

describe("Google Calendar event format", () => {
  it("uses the [AREA] Client — Title · Case# convention", () => {
    expect(gcalTitle(base, matter)).toBe("[UD] Acosta — Answer due · 26CMUD01121");
    expect(gcalTitle({ ...base, status: "vacated" }, matter)).toBe("[VACATED] [UD] Acosta — Answer due · 26CMUD01121");
  });

  it("all-day events end the next day and remind at 9am 5/2/1 days before", () => {
    const ev = toGcalEvent(base, matter, "https://crm.example");
    expect(ev.start).toEqual({ date: "2026-10-27" });
    expect(ev.end).toEqual({ date: "2026-10-28" });
    expect(ev.reminders?.overrides?.map((o) => o.minutes)).toEqual([5 * 1440 - 540, 2 * 1440 - 540, 1440 - 540]);
    expect(ev.description).toContain("https://crm.example/matters/m1");
  });

  it("timed hearings use Pacific time and the service ladder when chosen", () => {
    const ev = toGcalEvent({ ...base, allDay: false, time: "08:30", durationMinutes: 90, ladder: "service" }, matter, "x");
    expect(ev.start).toEqual({ dateTime: "2026-10-27T08:30:00", timeZone: "America/Los_Angeles" });
    expect(ev.end).toEqual({ dateTime: "2026-10-27T10:00:00", timeZone: "America/Los_Angeles" });
    expect(ev.reminders?.overrides?.map((o) => o.minutes)).toEqual([14400, 7200, 2880]);
  });

  it("handles events crossing midnight", () => {
    expect(addMinutes("2026-10-27", "23:30", 60)).toEqual({ date: "2026-10-28", time: "00:30" });
  });

  it("ladders", () => {
    expect(gcalReminderMinutes("none", true)).toEqual([]);
  });
});
