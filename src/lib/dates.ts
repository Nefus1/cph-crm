import { formatInTimeZone } from "date-fns-tz";

export const FIRM_TZ = "America/Los_Angeles";

/** Today's date (YYYY-MM-DD) in the firm's time zone. */
export function todayISO(now: Date = new Date()): string {
  return formatInTimeZone(now, FIRM_TZ, "yyyy-MM-dd");
}

/** Parse a YYYY-MM-DD string as a UTC-midnight Date (pure calendar arithmetic). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

export function diffDaysISO(a: string, b: string): number {
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayISO(iso: string): number {
  return parseISODate(iso).getUTCDay();
}

export function formatDate(iso: string | null | undefined, locale: string = "en", opts: Intl.DateTimeFormatOptions = {}) {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  }).format(parseISODate(iso.slice(0, 10)));
}

export function formatDateLong(iso: string | null | undefined, locale: string = "en") {
  return formatDate(iso, locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(d: Date | string | null | undefined, locale: string = "en") {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    timeZone: FIRM_TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatTime(hhmm: string | null | undefined, locale: string = "en") {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  return new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
}

/** Relative-day label key: overdue / today / tomorrow / in N days. */
export function relativeDays(iso: string, today: string = todayISO()): number {
  return diffDaysISO(iso, today);
}

/** Loose date parser for imports: "1/26/2023", "12/11/2008", "2023-01-26". */
export function parseLooseDate(input: string | null | undefined): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  return null;
}
