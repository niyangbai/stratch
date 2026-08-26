// ─────────────────────────────────────────────────────────────────────────────
// Validation + export (JavaScript / natural language).
// ─────────────────────────────────────────────────────────────────────────────

import { BLOCKS, type Strategy, type Block, type FieldValue } from '../ir';
import { explainStrategy } from './explain';

export interface Issue {
  severity: 'error' | 'warning';
  blockId: string | null;
  message: string;
}

function num(v: FieldValue): number {
  return typeof v === 'number' ? v : parseFloat(String(v)) || 0;
}

export function validate(strategy: Strategy): Issue[] {
  const issues: Issue[] = [];
  const varIds = new Set(strategy.vars.map((v) => v.id));
  const fnIds = new Set(strategy.functions.map((f) => f.id));
  const isLiteral = (id: string | null) => id && strategy.blocks[id]?.type === 'number';

  // blocks reachable from a function return expression (where `param` is valid)
  const fnReturnBlocks = new Set<string>();
  const collect = (id: string) => {
    if (fnReturnBlocks.has(id)) return;
    fnReturnBlocks.add(id);
    const b = strategy.blocks[id];
    if (b?.values) Object.values(b.values).forEach((cid) => cid && collect(cid));
    if (b?.statements) Object.values(b.statements).forEach((ids) => ids.forEach(collect));
  };
  strategy.functions.forEach((f) => f.returnBlockId && collect(f.returnBlockId));

  const checkVar = (b: Block) => {
    const id = String(b.fields.var);
    if (!id || !varIds.has(id)) issues.push({ severity: 'error', blockId: b.id, message: 'Undefined variable — create it in the Variables panel first.' });
  };

  const visitValue = (b: Block, name: string, vt: 'number' | 'boolean', required = true) => {
    const childId = b.values?.[name] ?? null;
    if (!childId) {
      if (required) issues.push({ severity: 'error', blockId: b.id, message: `Missing ${vt === 'boolean' ? 'condition' : 'value'} — snap a block here.` });
      return;
    }
    const def = BLOCKS[strategy.blocks[childId]?.type];
    if (def?.kind !== 'value') {
      issues.push({ severity: 'error', blockId: childId, message: 'A statement block cannot be used as a value.' });
      return;
    }
    if (vt === 'boolean' && def.vt !== 'boolean') {
      issues.push({ severity: 'error', blockId: childId, message: 'Expected a boolean (comparison) block here.' });
    }
    visitValueBlock(childId);
  };

  const visitValueBlock = (id: string) => {
    const b = strategy.blocks[id];
    if (!b) return;
    switch (b.type) {
      case 'getVar':
      case 'setVar':
      case 'changeVar':
        checkVar(b);
        break;
      case 'param':
        if (!fnReturnBlocks.has(id)) issues.push({ severity: 'error', blockId: id, message: 'A parameter block is only valid inside a My Block.' });
        break;
      case 'priceAgo':
        if (isLiteral(b.values?.bars ?? null) && num(strategy.blocks[b.values!.bars!].fields.n) < 0) {
          issues.push({ severity: 'warning', blockId: id, message: '“bars ago” should not be negative.' });
        }
        break;
      case 'window':
        if (isLiteral(b.values?.n ?? null) && num(strategy.blocks[b.values!.n!].fields.n) < 1) {
          issues.push({ severity: 'error', blockId: id, message: 'Window length must be at least 1 bar.' });
        }
        break;
      case 'indicator':
        if (isLiteral(b.values?.period ?? null) && num(strategy.blocks[b.values!.period!].fields.n) < 1) {
          issues.push({ severity: 'error', blockId: id, message: 'Indicator period must be at least 1.' });
        }
        break;
      case 'arith':
        if (b.fields.op === '÷' && isLiteral(b.values?.a ?? null) === false) break;
        if (b.fields.op === '÷' && isLiteral(b.values?.b ?? null) && num(strategy.blocks[b.values!.b!].fields.n) === 0) {
          issues.push({ severity: 'warning', blockId: id, message: 'Division by zero.' });
        }
        break;
      case 'callFn': {
        const fid = String(b.fields.fn);
        if (!fid || !fnIds.has(fid)) {
          issues.push({ severity: 'error', blockId: id, message: 'Undefined function call.' });
          break;
        }
        const f = strategy.functions.find((x) => x.id === fid)!;
        if (!f.returnBlockId) issues.push({ severity: 'error', blockId: id, message: `“${f.name}” has no return value.` });
        for (const p of f.params) visitValue(b, p, 'number');
        break;
      }
      default:
        break;
    }
    // recurse into nested value inputs
    if (b.values) {
      const def = BLOCKS[b.type];
      for (const part of def.parts) {
        if (part.k === 'value') visitValue(b, part.name, part.vt);
      }
    }
  };

  const visitStatement = (id: string) => {
    const b = strategy.blocks[id];
    if (!b) return;
    const def = BLOCKS[b.type];
    if (def?.kind !== 'statement') {
      issues.push({ severity: 'error', blockId: id, message: 'A value block cannot stand alone as a statement.' });
      return;
    }
    // check each value input
    for (const part of def.parts) {
      if (part.k === 'value') visitValue(b, part.name, part.vt);
    }
    // type-specific checks
    switch (b.type) {
      case 'buy': {
        const lit = isLiteral(b.values?.amount ?? null);
        if (lit) {
          const amt = num(strategy.blocks[b.values!.amount!].fields.n);
          if (b.fields.unit === '% of cash' && amt > 100) issues.push({ severity: 'error', blockId: id, message: 'Cannot buy more than 100% of cash.' });
          else if (amt <= 0) issues.push({ severity: 'warning', blockId: id, message: 'Buy amount is zero or negative.' });
        }
        break;
      }
      case 'sell': {
        const lit = isLiteral(b.values?.amount ?? null);
        if (lit) {
          const amt = num(strategy.blocks[b.values!.amount!].fields.n);
          if (b.fields.unit === '% of position' && amt > 100) issues.push({ severity: 'error', blockId: id, message: 'Cannot sell more than 100% of position.' });
          else if (amt <= 0) issues.push({ severity: 'warning', blockId: id, message: 'Sell amount is zero or negative.' });
        }
        break;
      }
      default:
        break;
    }
    // recurse into statement stacks
    if (b.statements) {
      for (const ids of Object.values(b.statements)) ids.forEach(visitStatement);
    }
  };

  strategy.setup.forEach(visitStatement);
  strategy.onBar.forEach(visitStatement);
  strategy.functions.forEach((f) => {
    if (!f.returnBlockId) {
      issues.push({ severity: 'error', blockId: f.id, message: `Function “${f.name}” is missing a return value.` });
    } else {
      visitValueBlock(f.returnBlockId);
    }
  });

  if (strategy.onBar.length === 0) {
    issues.push({ severity: 'warning', blockId: null, message: 'ON EVERY BAR is empty — the strategy does nothing.' });
  }
  const hasTrade = Object.values(strategy.blocks).some((b) => b.type === 'buy' || b.type === 'sell' || b.type === 'sellAll');
  if (!hasTrade) {
    issues.push({ severity: 'warning', blockId: null, message: 'The strategy never trades — add a BUY or SELL block.' });
  }

  return issues;
}

// ── JavaScript export ────────────────────────────────────────────────────────

function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return '0';
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000);
}

function varName(strategy: Strategy, id: string): string {
  return strategy.vars.find((v) => v.id === id)?.name ?? 'v';
}

function genExpr(strategy: Strategy, id: string | null, scope: Set<string>): string {
  if (!id) return '0';
  const b = strategy.blocks[id];
  if (!b) return '0';
  const v = (n: string) => genExpr(strategy, b.values?.[n] ?? null, scope);

  switch (b.type) {
    case 'number': return fmtNum(num(b.fields.n));
    case 'arith': {
      const op = { '+': '+', '−': '-', '×': '*', '÷': '/' }[String(b.fields.op)] ?? '+';
      return `(${v('a')} ${op} ${v('b')})`;
    }
    case 'minmax':
      return String(b.fields.op) === 'min' ? `Math.min(${v('a')}, ${v('b')})` : `Math.max(${v('a')}, ${v('b')})`;
    case 'abs': return `Math.abs(${v('x')})`;
    case 'round': return `Math.round(${v('x')})`;
    case 'getVar': {
      const name = varName(strategy, String(b.fields.var));
      return scope.has(name) ? name : `ctx.vars[${JSON.stringify(name)}]`;
    }
    case 'param':
      return String(b.fields.name);
    case 'price': return `ctx.price(${JSON.stringify(String(b.fields.src))})`;
    case 'priceAgo': return `ctx.price(${JSON.stringify(String(b.fields.src))}, ${v('bars')})`;
    case 'window': return `ctx.window(${JSON.stringify(String(b.fields.fn))}, ${JSON.stringify(String(b.fields.src))}, ${v('n')})`;
    case 'indicator': return `ctx.ind(${JSON.stringify(String(b.fields.ind))}, ${JSON.stringify(String(b.fields.src))}, ${v('period')})`;
    case 'portfolio':
      return b.fields.item === 'Cash' ? 'ctx.cash'
        : b.fields.item === 'Position' ? 'ctx.position'
        : b.fields.item === 'Average Entry Price' ? 'ctx.avgEntry'
        : 'ctx.value()';
    case 'callFn': {
      const f = strategy.functions.find((x) => x.id === String(b.fields.fn));
      const name = f ? f.name : 'fn';
      const args = f ? f.params.map((p) => genExpr(strategy, b.values?.[p] ?? null, scope)) : [];
      return `${name}(${[...args, 'ctx'].join(', ')})`;
    }
    case 'compare': {
      const op = { '>': '>', '<': '<', '=': '===', '>=': '>=', '<=': '<=', '!=': '!==' }[String(b.fields.op)] ?? '>';
      return `(${v('a')} ${op} ${v('b')})`;
    }
    case 'and': return `(${v('a')} && ${v('b')})`;
    case 'or': return `(${v('a')} || ${v('b')})`;
    case 'not': return `(!${v('x')})`;
    default: return '0';
  }
}

function genStatements(strategy: Strategy, ids: string[], level: number, scope: Set<string>): string {
  const pad = '  '.repeat(level);
  const out: string[] = [];
  for (const id of ids) {
    const b = strategy.blocks[id];
    if (!b) continue;
    const v = (n: string) => genExpr(strategy, b.values?.[n] ?? null, scope);
    const body = (n: string) => genStatements(strategy, b.statements?.[n] ?? [], level + 1, scope);
    switch (b.type) {
      case 'if':
        out.push(`${pad}if (${v('condition')}) {`);
        out.push(body('do'));
        out.push(`${pad}}`);
        break;
      case 'ifelse':
        out.push(`${pad}if (${v('condition')}) {`);
        out.push(body('do'));
        out.push(`${pad}} else {`);
        out.push(body('else'));
        out.push(`${pad}}`);
        break;
      case 'setVar':
        out.push(`${pad}ctx.vars[${JSON.stringify(varName(strategy, String(b.fields.var)))}] = ${v('value')};`);
        break;
      case 'changeVar':
        out.push(`${pad}ctx.vars[${JSON.stringify(varName(strategy, String(b.fields.var)))}] += ${v('value')};`);
        break;
      case 'buy':
        out.push(`${pad}ctx.buy(${v('amount')}, ${JSON.stringify(String(b.fields.unit))});`);
        break;
      case 'sell':
        out.push(`${pad}ctx.sell(${v('amount')}, ${JSON.stringify(String(b.fields.unit))});`);
        break;
      case 'sellAll':
        out.push(`${pad}ctx.sellAll();`);
        break;
      default:
        out.push(`${pad}// ${b.type}`);
    }
  }
  return out.join('\n');
}

const RUNTIME = `// ── minimal runtime (long-only spot, bar-based) ──────────────────────────────
function run(candles, { cash = 1000, feeRate = 0, slipRate = 0 } = {}) {
  const ctx = {
    vars: {}, cash, position: 0, avgEntry: 0, cost: 0, i: 0, bar: null,
    _ind: {},
    srcOf(src) { const b = this.bar || {}; return b[src.toLowerCase()] ?? b.close ?? 0; },
    price(src, ago = 0) { const j = Math.max(0, this.i - Math.round(ago)); const b = candles[j] || {}; return b[src.toLowerCase()] ?? b.close ?? 0; },
    window(fn, src, n) {
      n = Math.max(1, Math.round(n));
      const from = Math.max(0, this.i - n + 1);
      let acc = this.price(src, this.i - from);
      let best = acc;
      for (let j = from + 1; j <= this.i; j++) {
        const s = this.price(src, this.i - j);
        if (fn === 'sum' || fn === 'average') acc += s;
        if (fn === 'highest') best = Math.max(best, s);
        if (fn === 'lowest') best = Math.min(best, s);
      }
      if (fn === 'average') return acc / n;
      if (fn === 'sum') return acc;
      return best;
    },
    ind(name, src, p) {
      const key = name + '|' + src + '|' + p;
      if (this._ind[key]) return this._ind[key][this.i];
      const n = candles.length;
      const series = candles.map((b) => b[src.toLowerCase()] ?? b.close ?? 0);
      const out = new Array(n).fill(0);
      const k = 2 / (p + 1);
      out[0] = series[0];
      if (name === 'EMA') { for (let i = 1; i < n; i++) out[i] = series[i] * k + out[i - 1] * (1 - k); }
      else if (name.startsWith('Bollinger')) {
        const band = name.replace('Bollinger ', '');
        for (let i = 0; i < n; i++) {
          const win = series.slice(Math.max(0, i - p + 1), i + 1);
          const m = win.reduce((a, b) => a + b, 0) / win.length;
          const s = Math.sqrt(win.reduce((a, b) => a + (b - m) ** 2, 0) / win.length);
          out[i] = band === 'Upper' ? m + 2 * s : band === 'Lower' ? m - 2 * s : m;
        }
      } else if (name === 'RSI') {
        let g = 0, l = 0;
        for (let i = 1; i < n; i++) { const ch = series[i] - series[i - 1]; g = (g * (p - 1) + Math.max(ch, 0)) / p; l = (l * (p - 1) + Math.max(-ch, 0)) / p; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
      } else if (name === 'MACD') {
        const ema = (len) => { const e = [series[0]]; const kk = 2 / (len + 1); for (let i = 1; i < n; i++) e.push(series[i] * kk + e[i - 1] * (1 - kk)); return e; };
        const f = ema(12), s = ema(26); for (let i = 0; i < n; i++) out[i] = f[i] - s[i];
      } else if (name === 'ATR') {
        let atr = 0; for (let i = 0; i < n; i++) { const b = candles[i]; const tr = Math.max(b.high - b.low, i ? Math.abs(b.high - candles[i - 1].close) : 0, i ? Math.abs(b.low - candles[i - 1].close) : 0); atr = i === 0 ? tr : (atr * (p - 1) + tr) / p; out[i] = atr; }
      } else if (name === 'VWAP') {
        let tpv = 0, tv = 0; for (let i = 0; i < n; i++) { const tp = (candles[i].high + candles[i].low + candles[i].close) / 3; tpv += tp * candles[i].volume; tv += candles[i].volume; out[i] = tv ? tpv / tv : tp; }
      } else if (name === 'ROC') {
        for (let i = 0; i < n; i++) { const j = Math.max(0, i - p); out[i] = series[j] ? ((series[i] - series[j]) / series[j]) * 100 : 0; }
      }
      this._ind[key] = out;
      return out[this.i];
    },
    value() { return this.cash + this.position * (this.bar?.close ?? 0); },
    buy(amount, unit) {
      const price = (this.bar.close ?? 0) * (1 + slipRate);
      let notional = unit === '% of cash' ? this.cash * Math.min(100, Math.max(0, amount)) / 100
        : unit === 'USDT' ? Math.min(amount, this.cash) : Math.min(amount * price, this.cash);
      const fee = notional * feeRate;
      const qty = (notional - fee) / price;
      if (qty <= 0) return;
      this.cash -= notional; this.cost += notional; this.position += qty; this.avgEntry = this.cost / this.position;
    },
    sell(amount, unit) {
      if (this.position <= 0) return;
      const price = (this.bar.close ?? 0) * (1 - slipRate);
      const qty = unit === '% of position' ? this.position * Math.min(100, Math.max(0, amount)) / 100 : Math.min(amount, this.position);
      if (qty <= 0) return;
      const fee = qty * price * feeRate;
      this.cash += qty * price - fee;
      this.position -= qty; this.cost -= this.avgEntry * qty;
      if (this.position <= 1e-12) { this.position = 0; this.avgEntry = 0; this.cost = 0; } else this.avgEntry = this.cost / this.position;
    },
    sellAll() { this.sell(this.position, 'BTC'); },
  };
  setup(ctx);
  for (ctx.i = 0; ctx.i < candles.length; ctx.i++) { ctx.bar = candles[ctx.i]; onBar(ctx); }
  return ctx.value();
}
`;

export function exportJs(strategy: Strategy): string {
  const fns = strategy.functions
    .filter((f) => f.returnBlockId)
    .map((f) => {
      const scope = new Set(f.params);
      return `function ${f.name}(${[...f.params, 'ctx'].join(', ')}) {\n  return ${genExpr(strategy, f.returnBlockId, scope)};\n}`;
    })
    .join('\n\n');

  const setup = genStatements(strategy, strategy.setup, 1, new Set());
  const onBar = genStatements(strategy, strategy.onBar, 1, new Set());

  const header = `// Strategy exported from STRATCH
// Long-only spot, single asset, bar-based. For education, not production.

${fns ? fns + '\n\n' : ''}function setup(ctx) {
${setup || '  // (no setup)\n'}
}

function onBar(ctx) {
${onBar || '  // (do nothing)\n'}
}

${RUNTIME}`;

  return header;
}

// ── natural-language export ──────────────────────────────────────────────────

// Static glossary prepended to the natural-language export, so the generated
// description reads clearly even to readers unfamiliar with trading terms.
const GLOSSARY = `Definitions
-----------
bar — one step of market data (e.g. one day on a daily timeframe).
opening price — price at the start of a bar.
closing price — price at the end of a bar.
high / low — highest / lowest price within a bar.
volume — amount of the asset traded during a bar.
cash — money not currently invested.
position — amount of the asset currently held.
average entry price — average price paid for the current position.
portfolio value — cash plus the value of the current position.
SETUP — runs once before trading starts.
ON EVERY BAR — the main loop; runs once per bar.
EMA, RSI, MACD, Bollinger, ATR, VWAP, ROC — technical indicators computed from past bars.

`;

export function exportNatural(strategy: Strategy): string {
  return GLOSSARY + explainStrategy(strategy);
}
