const shortDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });

/** Formats an ISO `YYYY-MM-DD` date as e.g. "Jun 18" in UTC. */
export function formatShortDate(isoDate: string): string {
  return shortDate.format(new Date(isoDate + "T00:00:00Z"));
}
