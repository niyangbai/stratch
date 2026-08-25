// ─────────────────────────────────────────────────────────────────────────────
// Market data — deterministic synthetic OHLCV (works offline, reproducible)
// plus an optional Binance public-kline fetch for real historical bars.
// ─────────────────────────────────────────────────────────────────────────────

export interface Bar {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Series {
  pair: string;
  timeframe: string;
  bars: Bar[];
  source: 'synthetic' | 'binance';
}

/** Deterministic PRNG (mulberry32). Same seed -> same market. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  // Box–Muller
  const u = Math.max(rand(), 1e-12);
  const v = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const BASE_PRICE: Record<string, number> = {
  'BTC/USDT': 42000,
  'ETH/USDT': 2400,
  'SOL/USDT': 110,
};

const BASE_VOLUME: Record<string, number> = {
  'BTC/USDT': 900,
  'ETH/USDT': 28000,
  'SOL/USDT': 140000,
};

const VOLATILITY: Record<string, number> = {
  'BTC/USDT': 0.022,
  'ETH/USDT': 0.028,
  'SOL/USDT': 0.035,
};

export function generateBars(pair: string, timeframe: string, count: number, seed: number): Bar[] {
  const rand = mulberry32(seed);
  const base = BASE_PRICE[pair] ?? 100;
  const baseVol = BASE_VOLUME[pair] ?? 10000;
  const vol = VOLATILITY[pair] ?? 0.03;

  const tfMs = timeframeMs(timeframe);
  const t0 = Date.now() - tfMs * count;

  // regime: -1 downtrend, 0 chop, +1 uptrend — switches occasionally
  let regime = 0;
  let bars: Bar[] = [];
  let prevClose = base;

  for (let i = 0; i < count; i++) {
    if (i % 120 === 0) {
      const r = rand();
      regime = r < 0.4 ? 1 : r < 0.7 ? -1 : 0;
    }
    const drift = regime * 0.0009;
    const ret = drift + vol * gaussian(rand);
    const close = prevClose * Math.exp(ret);

    const gap = vol * 0.25 * gaussian(rand);
    const open = prevClose * Math.exp(gap);
    const hi = Math.max(open, close) * (1 + vol * rand() * 0.6);
    const lo = Math.min(open, close) * (1 - vol * rand() * 0.6);
    const volume = baseVol * (0.5 + Math.abs(ret) / vol + rand() * 0.6);

    bars.push({ t: t0 + tfMs * i, open, high: hi, low: lo, close, volume });
    prevClose = close;
  }
  // Drop the warm-up bar so indexing [0] is clean.
  bars = bars.slice(1);
  return bars;
}

export function timeframeMs(tf: string): number {
  const num = parseInt(tf, 10);
  const unit = tf.replace(num.toString(), '');
  const mult = unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : unit === 'd' ? 86_400_000 : 3_600_000;
  return num * mult;
}

export function barsPerYear(tf: string): number {
  const ms = timeframeMs(tf);
  return Math.round((365 * 24 * 3600 * 1000) / ms);
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

function timeframeToBinance(tf: string): string {
  // Binance interval strings
  if (/^[0-9]+m$/.test(tf)) return tf;
  if (/^[0-9]+h$/.test(tf)) return tf;
  if (/^[0-9]+d$/.test(tf)) return tf;
  return '1h';
}
