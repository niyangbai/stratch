// ─────────────────────────────────────────────────────────────────────────────
// OHLCV synthesis — turn a simulated close path into tradable bars.
// ─────────────────────────────────────────────────────────────────────────────

import type { SimSpec, Bar } from './models.js';
import { mulberry32, gaussian } from './prng.js';
import { simulatePath } from './gbm.js';

function refSigma(spec: SimSpec): number {
  const p = spec.params as { sigma?: number; theta?: number };
  if (spec.model === 'heston') return Math.sqrt(Math.max(0, p.theta ?? 0.1));
  return p.sigma ?? 0.3;
}

/**
 * Simulate a bar series (one bar per step). `seed` drives the price path; a
 * derived seed drives the intra-bar open/high/low/volume noise, so the whole
 * series is reproducible.
 */
export function simulateBars(spec: SimSpec, seed = 1, opts: { stepMs?: number; startTime?: number } = {}): Bar[] {
  const closes = simulatePath(spec, seed);
  const noise = mulberry32((seed | 0) + 0x9e3779b9);
  const stepMs = opts.stepMs ?? 3_600_000;
  const startTime = opts.startTime ?? 0;
  const sigma = refSigma(spec);

  const bars: Bar[] = [];
  let prev = closes[0];
  for (let i = 0; i < closes.length - 1; i++) {
    const close = closes[i + 1];
    const open = prev * Math.exp(sigma * 0.1 * gaussian(noise));
    const hi = Math.max(open, close) * (1 + sigma * 0.2 * noise());
    const lo = Math.min(open, close) * (1 - sigma * 0.2 * noise());
    const ret = Math.abs(close / prev - 1);
    const volume = 1 + ret / Math.max(sigma, 0.02) + noise() * 0.5;
    bars.push({ t: startTime + i * stepMs, open, high: hi, low: lo, close, volume });
    prev = close;
  }
  return bars;
}
