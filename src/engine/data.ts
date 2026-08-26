// ─────────────────────────────────────────────────────────────────────────────
// Market data — Binance / Coinbase public-kline fetch for real historical bars.
// Synthetic market simulation lives in the standalone @stratch/market-sim package.
// ─────────────────────────────────────────────────────────────────────────────

import type { Bar } from '@stratch/market-sim';

export type { Bar } from '@stratch/market-sim';

export type DataSource = 'binance' | 'coinbase';

/** Parse a timeframe like "1d" / "4h" / "15m" into milliseconds. */
export function timeframeMs(tf: string): number {
  const num = parseInt(tf, 10);
  const unit = tf.replace(num.toString(), '');
  const mult = unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : unit === 'd' ? 86_400_000 : 3_600_000;
  return num * mult;
}

/** Convert a timeframe into years (the `dt` for a stochastic model). */
export function timeframeYears(tf: string): number {
  return timeframeMs(tf) / (365 * 24 * 3600 * 1000);
}

/** Fetch recent OHLCV klines from Binance public API (no key required). */
export async function fetchBinance(pair: string, timeframe: string, count: number): Promise<Bar[]> {
  const symbol = pair.replace('/', '');
  const interval = timeframeToBinance(timeframe);
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${count}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const raw: any[][] = await res.json();
  return raw.map((k) => ({
    t: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

/** Fetch recent candles from Coinbase Exchange public API (no key required). */
export async function fetchCoinbase(pair: string, timeframe: string, count: number): Promise<Bar[]> {
  const product = pair.replace('/', '-').replace(/USDT$/, 'USD');
  const gran = Math.round(timeframeMs(timeframe) / 1000);
  const pageSize = 300; // Coinbase caps candles per request
  const raw: any[][] = [];
  let windowEnd = Math.floor(Date.now() / 1000);
  let remaining = count;

  // Page backwards so lookbacks longer than 300 bars still work.
  while (remaining > 0) {
    const windowStart = windowEnd - gran * Math.min(pageSize, remaining);
    const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=${gran}&start=${windowStart}&end=${windowEnd}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Coinbase ${res.status}`);
    const batch: any[][] = await res.json();
    if (!batch.length) break;
    raw.push(...batch);
    windowEnd = windowStart;
    remaining -= batch.length;
    if (batch.length < pageSize) break;
  }

  // Candles arrive newest-first as [time, low, high, open, close, volume].
  const byTime = new Map<number, any[]>();
  for (const c of raw) byTime.set(c[0], c);
  const candles = [...byTime.values()].sort((a, b) => a[0] - b[0]).slice(-count);

  return candles.map((k) => ({
    t: k[0] * 1000,
    open: parseFloat(k[3]),
    high: parseFloat(k[2]),
    low: parseFloat(k[1]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

function timeframeToBinance(tf: string): string {
  if (/^[0-9]+m$/.test(tf)) return tf;
  if (/^[0-9]+h$/.test(tf)) return tf;
  if (/^[0-9]+d$/.test(tf)) return tf;
  return '1h';
}
