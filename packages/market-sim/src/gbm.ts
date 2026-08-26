// ─────────────────────────────────────────────────────────────────────────────
// Single-path simulation — GBM, fat-tailed GBM and Heston.
// ─────────────────────────────────────────────────────────────────────────────

import { mulberry32, gaussian, studentT } from './prng.js';
import type { SimSpec, GbmParams, FatGbmParams, HestonParams } from './models.js';

/**
 * Simulate one price path. Returns `steps + 1` closing prices; `[0]` is `s0`.
 * Heston carries variance as hidden state across steps.
 */
export function simulatePath(spec: SimSpec, seed = 1): number[] {
  const rand = mulberry32(seed);
  const steps = Math.max(0, Math.round(spec.steps));
  const sdt = Math.sqrt(spec.dt);
  const path = new Array<number>(steps + 1);
  path[0] = spec.params.s0;

  if (spec.model === 'heston') {
    const h = spec.params as HestonParams;
    let v = Math.max(0, h.v0);
    const corr = Math.sqrt(Math.max(0, 1 - h.rho * h.rho));
    for (let i = 1; i <= steps; i++) {
      const z1 = gaussian(rand);
      const z2 = gaussian(rand);
      const w1 = z1;
      const w2 = h.rho * z1 + corr * z2;
      // Full-truncation Euler for the variance process.
      v = Math.max(0, v + h.kappa * (h.theta - v) * spec.dt + h.xi * Math.sqrt(v) * sdt * w2);
      path[i] = path[i - 1] * Math.exp((h.mu - 0.5 * v) * spec.dt + Math.sqrt(v) * sdt * w1);
    }
    return path;
  }

  if (spec.model === 'fatgbm') {
    const f = spec.params as FatGbmParams;
    const drift = (f.mu - 0.5 * f.sigma * f.sigma) * spec.dt;
    const vol = f.sigma * sdt;
    for (let i = 1; i <= steps; i++) {
      path[i] = path[i - 1] * Math.exp(drift + vol * studentT(rand, f.nu));
    }
    return path;
  }

  const g = spec.params as GbmParams;
  const drift = (g.mu - 0.5 * g.sigma * g.sigma) * spec.dt;
  const vol = g.sigma * sdt;
  for (let i = 1; i <= steps; i++) {
    path[i] = path[i - 1] * Math.exp(drift + vol * gaussian(rand));
  }
  return path;
}
