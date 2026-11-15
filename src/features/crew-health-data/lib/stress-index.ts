/**
 * Baevsky stress index computed from one day's simulated RR intervals (data/processed/crew_daily.csv,
 * column `rr_ms`). It runs where the CSV is parsed, on the server, so only the index reaches the client.
 *
 *   histogram of RR intervals in 50 ms bins
 *   Mo     = centre of the bin holding the most beats, in seconds
 *   AMo    = share of beats in that bin, in %
 *   MxDMn  = (max RR − min RR), in seconds
 *   SI     = AMo / (2 · Mo · MxDMn)
 *
 * A simulated interface value: no clinical range or threshold is asserted.
 */

/** Fewest beats the index is computed from. */
export const MIN_BEATS = 20;
/** Histogram bin width in milliseconds. */
export const BIN_MS = 50;

/** Space-separated RR intervals in ms. Any unreadable token makes the whole window unusable. */
export function parseRrIntervals(raw: string | undefined): number[] {
  const tokens = raw?.trim().split(/\s+/).filter(Boolean) ?? [];
  const values = tokens.map(Number);
  return values.every(Number.isFinite) ? values : [];
}

/** Stress index for a window of RR intervals (ms); null with fewer than 20 beats, invalid beats, or no spread. */
export function baevskyStressIndex(rrMs: readonly number[]): number | null {
  if (rrMs.length < MIN_BEATS || !rrMs.every((rr) => Number.isFinite(rr) && rr > 0)) return null;

  const counts = new Map<number, number>();
  for (const rr of rrMs) {
    const bin = Math.floor(rr / BIN_MS);
    counts.set(bin, (counts.get(bin) ?? 0) + 1);
  }
  // Most beats wins; a tie goes to the shortest bin so the result never depends on beat order.
  const [modeBin, modeCount] = [...counts].reduce((best, entry) =>
    entry[1] > best[1] || (entry[1] === best[1] && entry[0] < best[0]) ? entry : best,
  );

  const mo = (modeBin * BIN_MS + BIN_MS / 2) / 1000;
  const amo = (modeCount / rrMs.length) * 100;
  const mxdmn = (Math.max(...rrMs) - Math.min(...rrMs)) / 1000;
  if (mxdmn === 0) return null;
  return amo / (2 * mo * mxdmn);
}
