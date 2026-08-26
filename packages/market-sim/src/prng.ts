// ─────────────────────────────────────────────────────────────────────────────
// Deterministic PRNG + distributions. Every simulation is seeded, so the same
// seed reproduces the exact same market.
// ─────────────────────────────────────────────────────────────────────────────

/** mulberry32 — small, fast, deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal via Box–Muller. */
export function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  const v = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Gamma(a, 1) via Marsaglia–Tsang (handles a < 1 via a boost step). */
function gamma(rand: () => number, a: number): number {
  if (a < 1) {
    return gamma(rand, a + 1) * Math.pow(Math.max(rand(), 1e-12), 1 / a);
  }
  const d = a - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = gaussian(rand);
    const v = (1 + c * x) ** 3;
    if (v <= 0) continue;
    const u = rand();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/**
 * Student-t with `nu` degrees of freedom, scaled to unit variance so it can
 * replace a Gaussian in a diffusion term without changing the volatility.
 */
export function studentT(rand: () => number, nu: number): number {
  const df = Math.max(2.001, nu);
  const chi2 = 2 * gamma(rand, df / 2);
  const t = gaussian(rand) * Math.sqrt(df / chi2);
  return t / Math.sqrt(df / (df - 2));
}
