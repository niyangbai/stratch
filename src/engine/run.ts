// ─────────────────────────────────────────────────────────────────────────────
// Interpreter + backtest + metrics + attribution.
// Long-only crypto spot, bar-based. All in-memory, browser-side.
// ─────────────────────────────────────────────────────────────────────────────

import type { Strategy, Block, FieldValue } from '../ir';
import type { Bar } from './data';
import { explainValue } from './explain';

export interface BacktestConfig {
  startCash: number;
  feeBps: number;
  slippageBps: number;
}

export interface TradeReasonLeaf {
  label: string;
  a: number;
  b: number;
  op: string;
  result: boolean;
}

export interface Trade {
  side: 'BUY' | 'SELL';
  bar: number;
  time: number;
  price: number;
  qty: number;
  notional: number;
  fee: number;
  pnl?: number;
  reason?: { conditionId: string; text: string; leaves: TradeReasonLeaf[] };
}

export interface Metrics {
  totalReturn: number;
  cagr: number;
  buyHold: number;
  annVol: number;
  maxDrawdown: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  winRate: number | null;
  profitFactor: number | null;
  trades: number;
  finalValue: number;
  bars: number;
}

export interface BacktestResult {
  bars: Bar[];
  equity: number[];
  trades: Trade[];
  metrics: Metrics;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function num(v: FieldValue): number {
  return typeof v === 'number' ? v : parseFloat(String(v)) || 0;
}
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

interface RT {
  strategy: Strategy;
  bars: Bar[];
  cfg: BacktestConfig;
  cash: number;
  position: number;
  avgEntry: number;
  cost: number;
  vars: Record<string, number>;
  i: number;
  trades: Trade[];
  forceFalse: Set<string>;
  activeCond: { conditionId: string; text: string; leaves: TradeReasonLeaf[] } | null;
  cache: Map<string, number[]>;
  depth: number;
}

function child(b: Block, name: string): string | null {
  return b.values?.[name] ?? null;
}

function srcValue(bar: Bar, src: string): number {
  switch (src) {
    case 'Open': return bar.open;
    case 'High': return bar.high;
    case 'Low': return bar.low;
    case 'Volume': return bar.volume;
    default: return bar.close;
  }
}

// ── indicators (precomputed arrays) ─────────────────────────────────────────

function indicatorArray(rt: RT, ind: string, src: string, period: number): number[] {
  const key = `${ind}|${src}|${period}`;
  const hit = rt.cache.get(key);
  if (hit) return hit;

  const bars = rt.bars;
  const n = bars.length;
  const p = Math.max(2, Math.round(period));
  const arr = new Array(n).fill(0);
  const series = bars.map((b) => srcValue(b, src));

  if (ind.startsWith('Bollinger')) {
    const band = ind.replace('Bollinger ', '');
    for (let i = 0; i < n; i++) {
      const from = Math.max(0, i - p + 1);
      const win = series.slice(from, i + 1);
      const mean = win.reduce((a, b) => a + b, 0) / win.length;
      if (win.length < 2) { arr[i] = mean; continue; }
      const std = Math.sqrt(win.reduce((a, b) => a + (b - mean) ** 2, 0) / win.length);
      const k = 2;
      arr[i] = band === 'Upper' ? mean + k * std : band === 'Lower' ? mean - k * std : mean;
    }
    rt.cache.set(key, arr);
    return arr;
  }

  if (ind === 'EMA') {
    const k = 2 / (p + 1);
    arr[0] = series[0];
    for (let i = 1; i < n; i++) arr[i] = series[i] * k + arr[i - 1] * (1 - k);
    rt.cache.set(key, arr);
    return arr;
  }

  if (ind === 'RSI') {
    let gain = 0, loss = 0;
    for (let i = 1; i < n; i++) {
      const ch = series[i] - series[i - 1];
      const g = Math.max(ch, 0), l = Math.max(-ch, 0);
      if (i <= p) { gain += g; loss += l; } else { gain = (gain * (p - 1) + g) / p; loss = (loss * (p - 1) + l) / p; }
      const avgG = gain / p, avgL = loss / p;
      arr[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
    }
    rt.cache.set(key, arr);
    return arr;
  }

  if (ind === 'MACD') {
    const ema = (len: number) => {
      const out: number[] = new Array(n).fill(0);
      const k = 2 / (len + 1);
      out[0] = series[0];
      for (let i = 1; i < n; i++) out[i] = series[i] * k + out[i - 1] * (1 - k);
      return out;
    };
    const fast = ema(12), slow = ema(26);
    for (let i = 0; i < n; i++) arr[i] = fast[i] - slow[i];
    rt.cache.set(key, arr);
    return arr;
  }

  if (ind === 'ATR') {
    let atr = 0;
    for (let i = 0; i < n; i++) {
      const tr = Math.max(
        bars[i].high - bars[i].low,
        i > 0 ? Math.abs(bars[i].high - bars[i - 1].close) : 0,
        i > 0 ? Math.abs(bars[i].low - bars[i - 1].close) : 0,
      );
      if (i === 0) atr = tr; else atr = (atr * (p - 1) + tr) / p;
      arr[i] = atr;
    }
    rt.cache.set(key, arr);
    return arr;
  }

  if (ind === 'VWAP') {
    let tpv = 0, tv = 0;
    for (let i = 0; i < n; i++) {
      const typical = (bars[i].high + bars[i].low + bars[i].close) / 3;
      if (i < p) { tpv += typical * bars[i].volume; tv += bars[i].volume; }
      else {
        const old = bars[i - p];
        const oldTypical = (old.high + old.low + old.close) / 3;
        tpv += typical * bars[i].volume - oldTypical * old.volume;
        tv += bars[i].volume - old.volume;
      }
      arr[i] = tv > 0 ? tpv / tv : typical;
    }
    rt.cache.set(key, arr);
    return arr;
  }

  if (ind === 'ROC') {
    for (let i = 0; i < n; i++) {
      const j = Math.max(0, i - p);
      arr[i] = series[j] === 0 ? 0 : ((series[i] - series[j]) / series[j]) * 100;
    }
    rt.cache.set(key, arr);
    return arr;
  }

  rt.cache.set(key, arr);
  return arr;
}

// ── evaluation ───────────────────────────────────────────────────────────────

function evalNum(rt: RT, id: string | null): number {
  if (!id) return 0;
  const b = rt.strategy.blocks[id];
  if (!b) return 0;
  const v = (name: string) => evalNum(rt, child(b, name));

  switch (b.type) {
    case 'number': return num(b.fields.n);
    case 'arith': {
      const a = v('a'), bb = v('b');
      switch (b.fields.op) {
        case '+': return a + bb;
        case '−': return a - bb;
        case '×': return a * bb;
        case '÷': return bb === 0 ? 0 : a / bb;
        default: return a + bb;
      }
    }
    case 'minmax': return b.fields.op === 'min' ? Math.min(v('a'), v('b')) : Math.max(v('a'), v('b'));
    case 'abs': return Math.abs(v('x'));
    case 'round': return Math.round(v('x'));
    case 'getVar': return rt.vars[String(b.fields.var)] ?? 0;
    case 'param': return rt.vars[String(b.fields.name)] ?? 0;
    case 'price': return srcValue(rt.bars[rt.i], String(b.fields.src));
    case 'priceAgo': {
      const back = clamp(Math.round(evalNum(rt, child(b, 'bars'))), 0, rt.i);
      return srcValue(rt.bars[rt.i - back], String(b.fields.src));
    }
    case 'window': {
      const n = clamp(Math.round(evalNum(rt, child(b, 'n'))), 1, rt.i + 1);
      const src = String(b.fields.src);
      const from = rt.i - n + 1;
      let acc = srcValue(rt.bars[from], src);
      let best = acc;
      for (let j = from + 1; j <= rt.i; j++) {
        const s = srcValue(rt.bars[j], src);
        switch (b.fields.fn) {
          case 'sum': acc += s; break;
          case 'highest': best = Math.max(best, s); break;
          case 'lowest': best = Math.min(best, s); break;
          default: acc += s; break;
        }
      }
      if (b.fields.fn === 'average') return acc / n;
      if (b.fields.fn === 'sum') return acc;
      return best;
    }
    case 'indicator': {
      const ind = String(b.fields.ind);
      const src = String(b.fields.src);
      const period = Math.max(2, Math.round(evalNum(rt, child(b, 'period'))));
      return indicatorArray(rt, ind, src, period)[rt.i];
    }
    case 'portfolio': {
      const close = rt.bars[rt.i].close;
      switch (b.fields.item) {
        case 'Cash': return rt.cash;
        case 'Position': return rt.position;
        case 'Average Entry Price': return rt.avgEntry;
        default: return rt.cash + rt.position * close;
      }
    }
    case 'callFn': {
      if (rt.depth > 32) return 0;
      const f = rt.strategy.functions.find((x) => x.id === String(b.fields.fn));
      if (!f || !f.returnBlockId) return 0;
      // shadow globals with parameter values
      const saved: Record<string, number> = {};
      for (const p of f.params) {
        saved[p] = rt.vars[p];
        rt.vars[p] = evalNum(rt, child(b, p));
      }
      rt.depth += 1;
      const out = evalNum(rt, f.returnBlockId);
      rt.depth -= 1;
      for (const p of f.params) rt.vars[p] = saved[p];
      return out;
    }
    default: return 0;
  }
}

function evalBool(rt: RT, id: string | null): boolean {
  if (!id) return false;
  const b = rt.strategy.blocks[id];
  if (!b) return false;
  const v = (name: string) => evalNum(rt, child(b, name));
  const vb = (name: string) => evalBool(rt, child(b, name));

  switch (b.type) {
    case 'compare': {
      const a = v('a'), bb = v('b');
      switch (b.fields.op) {
        case '>': return a > bb;
        case '<': return a < bb;
        case '=': return Math.abs(a - bb) < 1e-9;
        case '>=': return a >= bb;
        case '<=': return a <= bb;
        case '!=': return Math.abs(a - bb) >= 1e-9;
        default: return a > bb;
      }
    }
    case 'and': return vb('a') && vb('b');
    case 'or': return vb('a') || vb('b');
    case 'not': return !vb('x');
    default: return false;
  }
}

// ── trade execution ──────────────────────────────────────────────────────────

function doBuy(rt: RT, amountId: string | null, unit: string) {
  const amount = evalNum(rt, amountId);
  const close = rt.bars[rt.i].close;
  const slip = rt.cfg.slippageBps / 10000;
  const feeRate = rt.cfg.feeBps / 10000;
  const price = close * (1 + slip);

  let notional = 0;
  if (unit === '% of cash') notional = rt.cash * clamp(amount, 0, 100) / 100;
  else if (unit === 'USDT') notional = clamp(amount, 0, rt.cash);
  else if (unit === 'BTC') notional = Math.min(Math.max(amount, 0) * price, rt.cash);

  if (notional <= 0) return;
  const fee = notional * feeRate;
  const qty = (notional - fee) / price;
  if (qty <= 0) return;

  rt.cash -= notional;
  rt.cost += notional;
  rt.position += qty;
  rt.avgEntry = rt.cost / rt.position;

  rt.trades.push({
    side: 'BUY', bar: rt.i, time: rt.bars[rt.i].t, price, qty, notional, fee,
    reason: rt.activeCond ? { conditionId: rt.activeCond.conditionId, text: rt.activeCond.text, leaves: rt.activeCond.leaves } : undefined,
  });
}

function doSell(rt: RT, amountId: string | null, unit: string, sellAll: boolean) {
  if (rt.position <= 0) return;
  const close = rt.bars[rt.i].close;
  const slip = rt.cfg.slippageBps / 10000;
  const feeRate = rt.cfg.feeBps / 10000;
  const price = close * (1 - slip);

  let qty = 0;
  if (sellAll) {
    qty = rt.position;
  } else {
    const amount = evalNum(rt, amountId);
    qty = unit === '% of position' ? rt.position * clamp(amount, 0, 100) / 100 : clamp(amount, 0, rt.position);
  }
  if (qty <= 0) return;

  const gross = qty * price;
  const fee = gross * feeRate;
  const proceeds = gross - fee;
  const pnl = (price - rt.avgEntry) * qty - fee;

  rt.cash += proceeds;
  rt.position -= qty;
  rt.cost -= rt.avgEntry * qty;
  if (rt.position <= 1e-12) { rt.position = 0; rt.avgEntry = 0; rt.cost = 0; }
  else rt.avgEntry = rt.cost / rt.position;

  rt.trades.push({
    side: 'SELL', bar: rt.i, time: rt.bars[rt.i].t, price, qty, notional: proceeds, fee, pnl,
    reason: rt.activeCond ? { conditionId: rt.activeCond.conditionId, text: rt.activeCond.text, leaves: rt.activeCond.leaves } : undefined,
  });
}

// ── condition tracing (for "why did this trade happen?") ─────────────────────

function traceCond(rt: RT, id: string): { text: string; leaves: TradeReasonLeaf[] } {
  const b = rt.strategy.blocks[id];
  const leaves: TradeReasonLeaf[] = [];
  if (b?.type === 'compare') {
    const a = evalNum(rt, child(b, 'a'));
    const bb = evalNum(rt, child(b, 'b'));
    const op = String(b.fields.op);
    const label = `${explainValue(rt.strategy, child(b, 'a'))} ${op} ${explainValue(rt.strategy, child(b, 'b'))}`;
    leaves.push({ label, a, b: bb, op, result: evalBool(rt, id) });
  } else if (b) {
    if (b.values?.a) leaves.push(...traceCond(rt, b.values.a).leaves);
    if (b.values?.b) leaves.push(...traceCond(rt, b.values.b).leaves);
    if (b.values?.x) leaves.push(...traceCond(rt, b.values.x).leaves);
  }
  return { text: explainValue(rt.strategy, id), leaves };
}

// ── statement execution ──────────────────────────────────────────────────────

function execStmt(rt: RT, id: string) {
  const b = rt.strategy.blocks[id];
  if (!b) return;
  const stack = (name: string) => (b.statements?.[name] ?? []).forEach((cid) => execStmt(rt, cid));

  switch (b.type) {
    case 'if':
    case 'ifelse': {
      const condId = child(b, 'condition');
      let cond = condId ? evalBool(rt, condId) : false;
      if (condId && rt.forceFalse.has(condId)) cond = false;
      if (cond) {
        const prev = rt.activeCond;
        rt.activeCond = condId ? { conditionId: condId, ...traceCond(rt, condId) } : null;
        stack('do');
        rt.activeCond = prev;
      } else if (b.type === 'ifelse') {
        stack('else');
      }
      break;
    }
    case 'setVar':
      rt.vars[String(b.fields.var)] = evalNum(rt, child(b, 'value'));
      break;
    case 'changeVar':
      rt.vars[String(b.fields.var)] = (rt.vars[String(b.fields.var)] ?? 0) + evalNum(rt, child(b, 'value'));
      break;
    case 'buy':
      doBuy(rt, child(b, 'amount'), String(b.fields.unit));
      break;
    case 'sell':
      doSell(rt, child(b, 'amount'), String(b.fields.unit), false);
      break;
    case 'sellAll':
      doSell(rt, null, 'BTC', true);
      break;
    default:
      break;
  }
}

// ── backtest ─────────────────────────────────────────────────────────────────

export function runBacktest(strategy: Strategy, cfg: BacktestConfig, bars: Bar[], forceFalse: Set<string> = new Set()): BacktestResult {
  const rt: RT = {
    strategy, bars, cfg,
    cash: cfg.startCash,
    position: 0,
    avgEntry: 0,
    cost: 0,
    vars: {},
    i: 0,
    trades: [],
    forceFalse,
    activeCond: null,
    cache: new Map(),
    depth: 0,
  };

  strategy.setup.forEach((id) => execStmt(rt, id));

  const equity: number[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    rt.i = i;
    strategy.onBar.forEach((id) => execStmt(rt, id));
    equity[i] = rt.cash + rt.position * bars[i].close;
  }

  const metrics = computeMetrics(bars, equity, rt.trades, cfg.startCash);
  return { bars, equity, trades: rt.trades, metrics };
}

// ── metrics ──────────────────────────────────────────────────────────────────

function computeMetrics(bars: Bar[], equity: number[], trades: Trade[], startCash: number): Metrics {
  const finalValue = equity[equity.length - 1] ?? startCash;
  const totalReturn = finalValue / startCash - 1;
  const buyHold = bars.length ? bars[bars.length - 1].close / bars[0].close - 1 : 0;

  // max drawdown
  let peak = -Infinity, maxDrawdown = 0;
  for (const e of equity) {
    peak = Math.max(peak, e);
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - e) / peak);
  }

  // per-bar returns
  const rets: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    if (equity[i - 1] > 0) rets.push(equity[i] / equity[i - 1] - 1);
  }
  const mean = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const std = rets.length > 1
    ? Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1))
    : 0;
  const bpy = barsPerYearFor(trades, bars);
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(bpy) : 0;
  const annVol = std * Math.sqrt(bpy);

  // downside deviation (Sortino)
  const downs = rets.filter((r) => r < 0);
  const dstd = downs.length > 1
    ? Math.sqrt(downs.reduce((a, b) => a + (b - mean) ** 2, 0) / (downs.length - 1))
    : 0;
  const sortino = dstd > 0 ? (mean / dstd) * Math.sqrt(bpy) : 0;

  // CAGR + Calmar
  const years = bars.length > 0 ? bars.length / bpy : 0;
  const cagr = years > 0 && finalValue > 0 ? Math.pow(finalValue / startCash, 1 / years) - 1 : 0;
  const calmar = maxDrawdown > 0 ? cagr / maxDrawdown : 0;

  const sells = trades.filter((t) => t.side === 'SELL' && t.pnl != null);
  const wins = sells.filter((t) => (t.pnl ?? 0) > 0);
  const winRate = sells.length ? wins.length / sells.length : null;
  const grossProfit = sells.reduce((a, t) => a + Math.max(t.pnl ?? 0, 0), 0);
  const grossLoss = sells.reduce((a, t) => a + Math.max(-(t.pnl ?? 0), 0), 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null;

  return {
    totalReturn, cagr, buyHold, annVol, maxDrawdown, sharpe, sortino, calmar,
    winRate, profitFactor, trades: trades.length, finalValue, bars: bars.length,
  };
}

function barsPerYearFor(_trades: Trade[], bars: Bar[]): number {
  // infer annualization from the bar timestamps
  if (bars.length < 2) return 365;
  const dt = bars[1].t - bars[0].t;
  if (dt <= 0) return 365;
  return Math.max(1, Math.round((365 * 24 * 3600 * 1000) / dt));
}

// ── attribution ("what mattered?") ───────────────────────────────────────────

export interface Attribution {
  conditionId: string;
  text: string;
  impact: number; // change in final value / startCash when forced false
  fires: number;
}

export function attribute(strategy: Strategy, cfg: BacktestConfig, bars: Bar[], base: BacktestResult): Attribution[] {
  const condIds = collectConditions(strategy);
  const start = cfg.startCash;
  const out: Attribution[] = [];
  for (const cid of condIds) {
    const forced = runBacktest(strategy, cfg, bars, new Set([cid]));
    const impact = (forced.metrics.finalValue - base.metrics.finalValue) / start;
    const fires = countFires(base, cid);
    out.push({ conditionId: cid, text: explainValue(strategy, cid), impact, fires });
  }
  out.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  return out;
}

function collectConditions(strategy: Strategy): string[] {
  const out: string[] = [];
  const visit = (id: string) => {
    const b = strategy.blocks[id];
    if (!b) return;
    if ((b.type === 'if' || b.type === 'ifelse') && b.values?.condition) out.push(b.values.condition);
    if (b.statements) Object.values(b.statements).forEach((ids) => ids.forEach(visit));
    if (b.values) Object.values(b.values).forEach((cid) => cid && visit(cid));
  };
  strategy.onBar.forEach(visit);
  return out;
}

function countFires(base: BacktestResult, conditionId: string): number {
  return base.trades.filter((t) => t.reason?.conditionId === conditionId).length;
}
