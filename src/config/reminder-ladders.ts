/**
 * CPH reminder ladders (from the firm's "02 Deadlines" convention):
 *   service dates → 10 / 5 / 2 days before
 *   filing dates / hearings → 5 / 2 / 1 days before
 */
export const LADDERS = {
  service: [10, 5, 2],
  filing: [5, 2, 1],
  none: [] as number[],
} as const;

export type Ladder = keyof typeof LADDERS;

export function ladderDays(ladder: string): readonly number[] {
  return LADDERS[(ladder as Ladder) in LADDERS ? (ladder as Ladder) : "none"];
}

/** Google Calendar popup reminders. All-day events fire at 9:00 AM N days before. */
export function gcalReminderMinutes(ladder: string, allDay: boolean): number[] {
  return ladderDays(ladder).map((days) => (allDay ? days * 1440 - 9 * 60 : days * 1440));
}
