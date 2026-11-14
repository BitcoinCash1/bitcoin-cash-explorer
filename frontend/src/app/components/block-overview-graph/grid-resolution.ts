type Sized = { size: number };
const histograms = new WeakMap<readonly Sized[], Map<number, number>>();
const resolutions = new WeakMap<readonly Sized[], Map<string, number>>();

/** Arrays passed here are immutable snapshots. Cache analysis across paired graphs. */
export function gridResolution(
  txs: readonly Sized[],
  limit: number,
  preferred: number
): number {
  if (!txs.length || !Number.isFinite(limit) || limit <= 0) return preferred;
  const key = `${limit}:${preferred}`;
  const cached = resolutions.get(txs)?.get(key);
  if (cached !== undefined) return cached;
  let histogram = histograms.get(txs);
  if (!histogram) {
    histogram = new Map();
    for (const tx of txs)
      histogram.set(tx.size, (histogram.get(tx.size) || 0) + 1);
    histograms.set(txs, histogram);
  }
  let total = 0;
  for (const [size, count] of histogram) total += size * count;
  const target = Math.min(1, total / limit);
  let best = preferred;
  let error = Infinity;
  for (
    let width = 32;
    width <= Math.max(512, Math.ceil(Math.sqrt(txs.length)));
    width++
  ) {
    const bytesPerUnit = limit / (width / 1.02) ** 2;
    let cells = 0;
    for (const [size, count] of histogram) {
      const side = Math.min(
        width,
        Math.max(1, Math.round(Math.sqrt((1.1 * size) / bytesPerUnit)))
      );
      cells += side * side * count;
    }
    if (cells > width * width) continue;
    const candidateError = Math.abs(cells / (width * width) - target);
    // Once within one percentage point, prefer the existing density over subpixel precision.
    if (
      (candidateError < 0.01 && error >= 0.01) ||
      (candidateError < 0.01 &&
        error < 0.01 &&
        Math.abs(width - preferred) < Math.abs(best - preferred)) ||
      (candidateError >= 0.01 && error >= 0.01 && candidateError < error)
    ) {
      error = candidateError;
      best = width;
    }
  }
  const cache = resolutions.get(txs) || new Map<string, number>();
  cache.set(key, best);
  resolutions.set(txs, cache);
  return best;
}
