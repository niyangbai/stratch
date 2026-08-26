// ─────────────────────────────────────────────────────────────────────────────
// Run worker — runs the pure backtest / simulate pipeline off the main thread.
// ─────────────────────────────────────────────────────────────────────────────

import { computeRun, type RunSpec } from './compute';
import type { Strategy } from '../ir';

const ctx = self as unknown as {
  onmessage: (e: MessageEvent<{ strategy: Strategy; spec: RunSpec }>) => void;
  postMessage: (data: any) => void;
};

ctx.onmessage = async (e) => {
  const { strategy, spec } = e.data;
  try {
    const out = await computeRun(strategy, spec);
    ctx.postMessage({ ok: true, ...out });
  } catch (err) {
    ctx.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
