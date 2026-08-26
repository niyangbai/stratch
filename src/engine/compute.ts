// ─────────────────────────────────────────────────────────────────────────────
// Run pipeline — single exchange backtest OR Monte-Carlo simulation. Pure and
// shared, so it can run on the main thread or inside a Web Worker.
// ─────────────────────────────────────────────────────────────────────────────

import { simulateBars, quantile, type ModelId, type ModelParams, type SimSpec } from '@stratch/market-sim';
import { fetchBinance, fetchCoinbase, timeframeMs, timeframeYears, type DataSource } from './data';
import { runBacktest, attribute, type BacktestConfig, type BacktestResult, type Attribution } from './run';
import type { Strategy } from '../ir';

export interface BacktestSpec {
  mode: 'backtest';
  source: DataSource;
  pair: string;
  timeframe: string;
  bars: number;
  startCash: number;
  feeBps: number;
  slippageBps: number;
}

export interface SimulateSpec {
  mode: 'simulate';
  pair: string;
  model: ModelId;
  s0: number;
  mu: number;
  sigma: number;
  nu: number;
  v0: number;
  theta: number;
  kappa: number;
  xi: number;
  rho: number;
  timeframe: string;
  bars: number;
  paths: number;
  seed: number;
  startCash: number;
  feeBps: number;
  slippageBps: number;
}

export type RunSpec = BacktestSpec | SimulateSpec;

export interface SimulateResult {
  model: ModelId;
  paths: number;
  bars: number;
  /** Per-step equity quantile curves (sorted ascending by `q`). */
  equityQuantiles: { q: number; series: number[] }[];
  /** A few raw equity paths for the faint overlay. */
  sampleEquity: number[][];
  finalReturn: {
    p05: number;
    p25: number;
    median: number;
    p75: number;
    p95: number;
    mean: number;
    positiveRate: number;
  };
}

export type RunOutput =
  | { kind: 'backtest'; result: BacktestResult; attribution: Attribution[] }
  | { kind: 'simulate'; mc: SimulateResult };

function runtimeCfg(spec: { startCash: number; feeBps: number; slippageBps: number }): BacktestConfig {
  return { startCash: spec.startCash, feeBps: spec.feeBps, slippageBps: spec.slippageBps };
}

function modelParams(spec: SimulateSpec): ModelParams {
  switch (spec.model) {
    case 'fatgbm': return { s0: spec.s0, mu: spec.mu, sigma: spec.sigma, nu: spec.nu };
    case 'heston': return { s0: spec.s0, mu: spec.mu, v0: spec.v0, theta: spec.theta, kappa: spec.kappa, xi: spec.xi, rho: spec.rho };
    default: return { s0: spec.s0, mu: spec.mu, sigma: spec.sigma };
  }
}

function runSimulate(strategy: Strategy, spec: SimulateSpec): SimulateResult {
  const sim: SimSpec = { model: spec.model, dt: timeframeYears(spec.timeframe), steps: spec.bars, params: modelParams(spec) };
  const stepMs = timeframeMs(spec.timeframe);
  const cfg = runtimeCfg(spec);
  const paths = Math.max(1, Math.round(spec.paths));

  const equities: number[][] = new Array(paths);
  const finals: number[] = new Array(paths);
  for (let i = 0; i < paths; i++) {
    const bars = simulateBars(sim, spec.seed + i, { stepMs });
    const r = runBacktest(strategy, cfg, bars);
    equities[i] = r.equity;
    finals[i] = r.metrics.totalReturn;
  }

  const QS = [0.05, 0.25, 0.5, 0.75, 0.95];
  const equityQuantiles = QS.map((q) => {
    const series: number[] = new Array(spec.bars);
    for (let s = 0; s < spec.bars; s++) {
      series[s] = quantile(equities.map((e) => e[s]), q);
    }
    return { q, series };
  });

  const sampleCount = Math.min(12, paths);
  const sampleEquity: number[][] = [];
  for (let i = 0; i < sampleCount; i++) {
    const idx = paths === 1 ? 0 : Math.round((i * (paths - 1)) / (sampleCount - 1));
    sampleEquity.push(equities[idx]);
  }

  const mean = finals.reduce((a, b) => a + b, 0) / finals.length;
  const positiveRate = finals.filter((f) => f > 0).length / finals.length;

  return {
    model: spec.model,
    paths,
    bars: spec.bars,
    equityQuantiles,
    sampleEquity,
    finalReturn: {
      p05: quantile(finals, 0.05),
      p25: quantile(finals, 0.25),
      median: quantile(finals, 0.5),
      p75: quantile(finals, 0.75),
      p95: quantile(finals, 0.95),
      mean,
      positiveRate,
    },
  };
}

export async function computeRun(strategy: Strategy, spec: RunSpec): Promise<RunOutput> {
  if (spec.mode === 'simulate') {
    return { kind: 'simulate', mc: runSimulate(strategy, spec) };
  }

  const bars = spec.source === 'coinbase'
    ? await fetchCoinbase(spec.pair, spec.timeframe, spec.bars)
    : await fetchBinance(spec.pair, spec.timeframe, spec.bars);
  const cfg = runtimeCfg(spec);
  const result = runBacktest(strategy, cfg, bars);
  const attribution = attribute(strategy, cfg, bars, result).slice(0, 12);
  return { kind: 'backtest', result, attribution };
}
