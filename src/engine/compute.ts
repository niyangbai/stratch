// ─────────────────────────────────────────────────────────────────────────────
// Backtest pipeline — data loading + backtest + score + attribution. Pure and
// shared, so it can run on the main thread or inside a Web Worker.
// ─────────────────────────────────────────────────────────────────────────────

import { generateBars, fetchBinance } from './data';
import { fullBacktest, attribute, type BacktestConfig, type BacktestResult, type Attribution } from './run';
import type { Strategy } from '../ir';

export interface BacktestOutput {
  result: BacktestResult;
  attribution: Attribution[];
  source: 'synthetic' | 'binance';
}

export async function computeBacktest(strategy: Strategy, config: BacktestConfig): Promise<BacktestOutput> {
  let bars;
  let source: 'synthetic' | 'binance' = config.source;
  if (config.source === 'binance') {
    try {
      bars = await fetchBinance(config.pair, config.timeframe, config.bars);
    } catch (err) {
      console.warn('[backtest] Binance unavailable, falling back to synthetic', err);
      source = 'synthetic';
      bars = generateBars(config.pair, config.timeframe, config.bars, config.seed);
    }
  } else {
    bars = generateBars(config.pair, config.timeframe, config.bars, config.seed);
  }

  const result = fullBacktest(strategy, config, bars);
  const attribution = attribute(strategy, config, bars, result).slice(0, 12);
  return { result, attribution, source };
}
