import { describe, expect, it } from "vitest";
import { computeAnswerDue, computeNoticeDeadlines, ab1482Anniversary } from "@/lib/deadlines/ud";
import { addCourtDays, isCourtDay } from "@/lib/deadlines/court-days";

// Holidays relevant to the fixtures (subset of the seeded CA judicial holidays).
const H = new Set(["2026-09-07", "2026-09-25", "2026-10-12", "2026-11-11", "2026-11-26", "2026-11-27"]);

// Fixtures come from the Acosta "02 Deadlines" doc in the firm's Drive.
describe("30-day notice (personal/substituted, no extension)", () => {
  const cases: [string, string, string][] = [
    ["2026-09-08", "2026-10-08", "2026-10-09"],
    ["2026-09-09", "2026-10-09", "2026-10-13"], // Oct 12 holiday skipped
    ["2026-09-10", "2026-10-13", "2026-10-14"], // Sat Oct 10 → Tue Oct 13
    ["2026-09-11", "2026-10-13", "2026-10-14"],
    ["2026-09-14", "2026-10-14", "2026-10-15"],
    ["2026-09-15", "2026-10-15", "2026-10-16"],
  ];
  it.each(cases)("served %s → expires %s, file %s", (served, expires, filing) => {
    const r = computeNoticeDeadlines({ noticeType: "30day", servedOn: served, addMailDays: false, holidays: H });
    expect(r.expires).toBe(expires);
    expect(r.earliestFiling).toBe(filing);
  });
});

describe("30-day notice served by mail (+5 days)", () => {
  const cases: [string, string, string][] = [
    ["2026-09-08", "2026-10-13", "2026-10-14"],
    ["2026-09-09", "2026-10-14", "2026-10-15"],
    ["2026-09-10", "2026-10-15", "2026-10-16"],
    ["2026-09-11", "2026-10-16", "2026-10-19"],
    ["2026-09-14", "2026-10-19", "2026-10-20"],
    ["2026-09-15", "2026-10-20", "2026-10-21"],
  ];
  it.each(cases)("served %s → expires %s, file %s", (served, expires, filing) => {
    const r = computeNoticeDeadlines({ noticeType: "30day", servedOn: served, addMailDays: true, holidays: H });
    expect(r.expires).toBe(expires);
    expect(r.earliestFiling).toBe(filing);
  });
});

describe("UD answer due (10 court days, CCP §1167)", () => {
  it.each([
    ["2026-10-13", "2026-10-27"],
    ["2026-10-15", "2026-10-29"],
    ["2026-10-19", "2026-11-02"],
  ])("summons served %s → answer due %s", (served, due) => {
    expect(computeAnswerDue({ summonsServedOn: served, holidays: H }).answerDue).toBe(due);
  });

  it("skips Veterans Day and Thanksgiving", () => {
    // Nov 5 (Thu) + 10 court days, skipping Nov 11, 26, 27
    expect(computeAnswerDue({ summonsServedOn: "2026-11-05", holidays: H }).answerDue).toBe("2026-11-20");
    expect(computeAnswerDue({ summonsServedOn: "2026-11-16", holidays: H }).answerDue).toBe("2026-12-02");
  });
});

describe("3-day notice (court days)", () => {
  it("excludes weekends", () => {
    // Served Thu Oct 1 → Fri(1), Mon(2), Tue(3)
    const r = computeNoticeDeadlines({ noticeType: "3day_pay", servedOn: "2026-10-01", addMailDays: false, holidays: H });
    expect(r.expires).toBe("2026-10-06");
    expect(r.earliestFiling).toBe("2026-10-07");
  });
  it("excludes judicial holidays", () => {
    // Served Fri Oct 9 → Tue Oct 13 (1), Wed (2), Thu Oct 15 (3); Mon Oct 12 is a holiday
    const r = computeNoticeDeadlines({ noticeType: "3day_pay", servedOn: "2026-10-09", addMailDays: false, holidays: H });
    expect(r.expires).toBe("2026-10-15");
  });
});

describe("court day helpers", () => {
  it("identifies weekends and holidays", () => {
    expect(isCourtDay("2026-10-12", H)).toBe(false);
    expect(isCourtDay("2026-10-10", H)).toBe(false);
    expect(isCourtDay("2026-10-13", H)).toBe(true);
    expect(addCourtDays("2026-09-04", 1, H)).toBe("2026-09-08"); // Labor Day skipped
  });
  it("AB 1482 anniversary is 12 months after tenancy start", () => {
    expect(ab1482Anniversary("2026-06-07")).toBe("2027-06-07");
  });
});
