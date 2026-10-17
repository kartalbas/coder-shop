// Swiss calendar dates (issue #17): revenue days and number years follow
// Europe/Zurich, not UTC. Pure Intl helpers — no I/O.

export const SWISS_TIME_ZONE = "Europe/Zurich";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SWISS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const yearFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SWISS_TIME_ZONE,
  year: "numeric",
});

/** "YYYY-MM-DD" of the Swiss calendar day the instant falls in. */
export function swissDayKey(date: Date): string {
  return dayKeyFormatter.format(date);
}

/** Calendar year in Switzerland — an order at 00:30 on 1 January (Zurich) is next year. */
export function swissYear(date: Date): number {
  return Number(yearFormatter.format(date));
}

/** "YYYY-MM-DD" shifted by whole calendar days. */
export function addDaysToDayKey(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** UTC instant of Swiss midnight at the start of the given calendar day. */
export function swissDayStartUtc(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  // Switzerland is UTC+1/+2, so the day starts within two hours before UTC midnight.
  let ts = Date.UTC(year, month - 1, day) - 2 * 60 * 60 * 1000;
  const step = 15 * 60 * 1000;
  while (swissDayKey(new Date(ts)) !== dayKey) ts += step;
  return new Date(ts);
}
