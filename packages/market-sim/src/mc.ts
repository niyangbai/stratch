// ─────────────────────────────────────────────────────────────────────────────
// Monte Carlo — generate many independent price paths.
// ─────────────────────────────────────────────────────────────────────────────

import type { SimSpec } from './models.js';
import { simulatePath } from './gbm.js';

/** Generate `count` independent paths, seeded sequentially from `seed`. */
export function simulatePaths(spec: SimSpec, count: number, seed = 1): number[][] {
  const n = Math.max(0, Math.round(count));
  const out: number[][] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = simulatePath(spec, (seed | 0) + i);
  return out;
}
