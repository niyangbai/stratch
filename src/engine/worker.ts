// ─────────────────────────────────────────────────────────────────────────────
// Backtest worker — runs the pure backtest pipeline off the main thread.
// ─────────────────────────────────────────────────────────────────────────────

import { computeBacktest } from './compute';
import type { Strategy } from '../ir';
import type { BacktestConfig } from './run';

const ctx = self as unknown as {
  onmessage: (e: MessageEvent<{ strategy: Strategy; config: BacktestConfig }>) => void;
  postMessage: (data: any) => void;
};

ctx.onmessage = async (e) => {
  const { strategy, config } = e.data;
  try {
    const out = await computeBacktest(strategy, config);
    ctx.postMessage({ ok: true, ...out });
  } catch (err) {
    ctx.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
