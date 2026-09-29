import { addDaysISO, weekdayISO } from "@/lib/dates";

/** Set of YYYY-MM-DD judicial holidays. */
export type HolidaySet = ReadonlySet<string>;

export function isCourtDay(iso: string, holidays: HolidaySet): boolean {
  const wd = weekdayISO(iso);
  return wd !== 0 && wd !== 6 && !holidays.has(iso);
}

/** CCP §12a: if the last day is a weekend or holiday, roll to the next court day. */
export function rollToCourtDay(iso: string, holidays: HolidaySet): string {
  let d = iso;
  while (!isCourtDay(d, holidays)) d = addDaysISO(d, 1);
  return d;
}

/** Counts `n` court days after `start` (start excluded, CCP §12). */
export function addCourtDays(start: string, n: number, holidays: HolidaySet): string {
  let d = start;
  let counted = 0;
  while (counted < n) {
    d = addDaysISO(d, 1);
    if (isCourtDay(d, holidays)) counted++;
  }
  return d;
}

/** Counts `n` calendar days after `start` (first day excluded, last included) and rolls per §12a. */
export function addCalendarDaysRolled(start: string, n: number, holidays: HolidaySet): string {
  return rollToCourtDay(addDaysISO(start, n), holidays);
}

/** First court day strictly after `iso`. */
export function nextCourtDayAfter(iso: string, holidays: HolidaySet): string {
  return rollToCourtDay(addDaysISO(iso, 1), holidays);
}
