// ─────────────────────────────────────────────────────────────────────────────
// Backtest worker — data loading + backtest + score + attribution run off the
// main thread so large lookbacks / complex strategies never freeze the UI.
// ─────────────────────────────────────────────────────────────────────────────

import { generateBars, fetchBinance } from './data';
import { fullBacktest, attribute, type BacktestConfig } from './run';
import type { Strategy } from '../ir';

interface Request {
  strategy: Strategy;
  config: BacktestConfig;
}

interface Response {
  ok: boolean;
  result?: ReturnType<typeof fullBacktest>;
  attribution?: ReturnType<typeof attribute>;
  source?: 'synthetic' | 'binance';
  error?: string;
}

const ctx = self as unknown as {
  onmessage: (e: MessageEvent<Request>) => void;
  postMessage: (data: Response) => void;
};

ctx.onmessage = async (e) => {
  const { strategy, config } = e.data;
  try {
    let bars;
    let source: 'synthetic' | 'binance' = config.source;
    if (config.source === 'binance') {
      try {
        bars = await fetchBinance(config.pair, config.timeframe, config.bars);
      } catch (err) {
        console.warn('[backtest worker] Binance unavailable, falling back to synthetic', err);
        source = 'synthetic';
        bars = generateBars(config.pair, config.timeframe, config.bars, config.seed);
      }
    } else {
      bars = generateBars(config.pair, config.timeframe, config.bars, config.seed);
    }

    const result = fullBacktest(strategy, config, bars);
    const attribution = attribute(strategy, config, bars, result).slice(0, 12);
    ctx.postMessage({ ok: true, result, attribution, source });
  } catch (err) {
    ctx.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
