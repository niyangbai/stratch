// ─────────────────────────────────────────────────────────────────────────────
// Public types — stochastic models and a single simulation spec.
// ─────────────────────────────────────────────────────────────────────────────

export type ModelId = 'gbm' | 'fatgbm' | 'heston';

/** OHLCV bar — the shape the simulator emits and backtest engines consume. */
export interface Bar {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface BaseParams {
  /** Initial asset price. */
  s0: number;
  /** Annualized drift (e.g. 0.10 = +10%/yr). */
  mu: number;
}

/** Geometric Brownian motion — Gaussian log-returns. */
export interface GbmParams extends BaseParams {
  /** Annualized volatility. */
  sigma: number;
}

/** GBM with Student-t log-returns — captures heavy tails (crypto-like). */
export interface FatGbmParams extends BaseParams {
  sigma: number;
  /** Student-t degrees of freedom (> 2); lower = fatter tails. */
  nu: number;
}

/** Heston stochastic-volatility model — volatility mean-reverts. */
export interface HestonParams extends BaseParams {
  /** Initial variance. */
  v0: number;
  /** Long-run variance. */
  theta: number;
  /** Mean-reversion speed of variance. */
  kappa: number;
  /** Volatility of variance. */
  xi: number;
  /** Correlation between asset and variance (usually negative). */
  rho: number;
}

export type ModelParams = GbmParams | FatGbmParams | HestonParams;

/** A full simulation request. */
export interface SimSpec {
  model: ModelId;
  /** Step size in years (e.g. 1/365 for daily). */
  dt: number;
  /** Number of steps (produces `steps + 1` points / `steps` bars). */
  steps: number;
  params: ModelParams;
}
