/**
 * Unlawful detainer deadline helpers. These mirror the rules CPH already uses in its
 * "02 Deadlines" matter docs. Results are DRAFTS: staff must verify against the
 * court record and proof of service before saving them to the calendar.
 */
import { addDaysISO, parseISODate, toISODate } from "@/lib/dates";
import { addCourtDays, nextCourtDayAfter, rollToCourtDay, type HolidaySet } from "./court-days";

export type NoticeType = "3day_pay" | "3day_perform" | "30day" | "60day" | "90day";

export const NOTICE_DAYS: Record<NoticeType, number> = {
  "3day_pay": 3,
  "3day_perform": 3,
  "30day": 30,
  "60day": 60,
  "90day": 90,
};

export interface Step {
  label: string;
  authority?: string;
}

export interface NoticeResult {
  expires: string;
  earliestFiling: string;
  steps: Step[];
}

export function computeNoticeDeadlines(input: {
  noticeType: NoticeType;
  servedOn: string;
  /** Add 5 calendar days for service by mail (CCP §1013). */
  addMailDays: boolean;
  holidays: HolidaySet;
}): NoticeResult {
  const { noticeType, servedOn, addMailDays, holidays } = input;
  const n = NOTICE_DAYS[noticeType];
  const steps: Step[] = [];
  let expires: string;

  if (n === 3) {
    // CCP §1161(2)-(3): 3-day notices exclude Saturdays, Sundays, and judicial holidays.
    expires = addCourtDays(servedOn, 3, holidays);
    steps.push({ label: `3 court days after ${servedOn} (weekends & judicial holidays excluded)`, authority: "CCP §1161" });
    if (addMailDays) {
      const withMail = addDaysISO(expires, 5);
      expires = rollToCourtDay(withMail, holidays);
      steps.push({ label: `+5 calendar days for mail service → ${withMail}${withMail !== expires ? `, rolled to ${expires}` : ""}`, authority: "CCP §1013" });
    }
  } else {
    const raw = addDaysISO(servedOn, n + (addMailDays ? 5 : 0));
    expires = rollToCourtDay(raw, holidays);
    steps.push({
      label: `${n} calendar days${addMailDays ? " + 5 for mail service" : ""} after ${servedOn} → ${raw}`,
      authority: addMailDays ? "CCP §12, §1013" : "CCP §12",
    });
    if (raw !== expires) steps.push({ label: `Last day falls on a weekend/holiday → rolls to ${expires}`, authority: "CCP §12a" });
  }

  const earliestFiling = nextCourtDayAfter(expires, holidays);
  steps.push({ label: `Earliest filing: next court day after expiration → ${earliestFiling}` });
  return { expires, earliestFiling, steps };
}

export interface AnswerResult {
  answerDue: string;
  steps: Step[];
}

/** Answer due 10 court days after service of summons (CCP §1167, AB 2347 eff. 1/1/2025). */
export function computeAnswerDue(input: { summonsServedOn: string; holidays: HolidaySet }): AnswerResult {
  const answerDue = addCourtDays(input.summonsServedOn, 10, input.holidays);
  return {
    answerDue,
    steps: [
      { label: `10 court days after summons served ${input.summonsServedOn} → ${answerDue}`, authority: "CCP §1167" },
      { label: "The CCP §1013 mail extension does not apply to the UD response deadline." },
      { label: "Substituted service is complete on the 10th day after mailing — enter that date.", authority: "CCP §415.20" },
    ],
  };
}

/** AB 1482 just cause attaches after 12 months of continuous occupancy (CC §1946.2(a)). */
export function ab1482Anniversary(tenancyStart: string): string {
  const d = parseISODate(tenancyStart);
  const target = new Date(Date.UTC(d.getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate()));
  // Feb 29 → Mar 1 handled by Date rollover
  return toISODate(target);
}
