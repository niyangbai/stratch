// ─────────────────────────────────────────────────────────────────────────────
// Small statistics helpers used to summarize Monte Carlo output.
// ─────────────────────────────────────────────────────────────────────────────

function quantileSorted(sorted: number[], q: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/** Linear-interpolated quantile of a sample (q in [0, 1]). */
export function quantile(values: number[], q: number): number {
  return quantileSorted([...values].sort((a, b) => a - b), q);
}

/** Several quantiles in one pass. */
export function quantiles(values: number[], qs: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return qs.map((q) => quantileSorted(sorted, q));
}
