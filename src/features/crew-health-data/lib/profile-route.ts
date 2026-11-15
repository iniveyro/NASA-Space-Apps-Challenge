/**
 * Link to an astronaut profile, optionally opened on a mission day. Pure, so server and client
 * components can share it. The latest day is the profile's default and keeps the URL bare.
 */
export function profileHref(profileId: string, day?: number, latestDay?: number): string {
  const path = `/astronaut/${profileId}`;
  if (day === undefined || !Number.isFinite(day) || day === latestDay) return path;
  return `${path}?day=${day}`;
}
