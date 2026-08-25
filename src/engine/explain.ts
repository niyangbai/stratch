// ─────────────────────────────────────────────────────────────────────────────
// Natural-language explanation of a strategy (for "Test -> Explain" and
// for "Why did this trade happen?" attribution).
// ─────────────────────────────────────────────────────────────────────────────

import type { Strategy, Block, FieldValue } from '../ir';

export function fmtNumber(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 100) / 100;
  if (Math.abs(r) >= 1000) return r.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return String(r);
}

function num(v: FieldValue): number {
  return typeof v === 'number' ? v : parseFloat(String(v)) || 0;
}

function srcWord(src: string): string {
  switch (src) {
    case 'Open': return 'opening price';
    case 'High': return 'high';
    case 'Low': return 'low';
    case 'Volume': return 'volume';
    default: return 'closing price';
  }
}

function varName(strategy: Strategy, id: string): string {
  const v = strategy.vars.find((x) => x.id === id);
  return v ? v.name : 'undefined variable';
}

function fnName(strategy: Strategy, id: string): string {
  const f = strategy.functions.find((x) => x.id === id);
  return f ? f.name : 'undefined function';
}

const OP_WORD: Record<string, string> = {
  '>': 'is greater than',
  '<': 'is less than',
  '=': 'is equal to',
  '>=': 'is greater than or equal to',
  '<=': 'is less than or equal to',
  '!=': 'is not equal to',
};

const OP_SYM: Record<string, string> = { '+': 'plus', '−': 'minus', '×': 'times', '÷': 'divided by' };

/** Render a value/boolean block as a short English noun phrase. */
export function explainValue(strategy: Strategy, id: string | null | undefined): string {
  if (!id) return '…';
  const b = strategy.blocks[id];
  if (!b) return '…';
  const v = (name: string) => explainValue(strategy, b.values?.[name] ?? null);

  switch (b.type) {
    case 'number':
      return fmtNumber(num(b.fields.n));
    case 'arith':
      return `(${v('a')} ${OP_SYM[String(b.fields.op)]} ${v('b')})`;
    case 'minmax':
      return String(b.fields.op) === 'min' ? `the minimum of ${v('a')} and ${v('b')}` : `the maximum of ${v('a')} and ${v('b')}`;
    case 'abs':
      return `the absolute value of ${v('x')}`;
    case 'round':
      return `${v('x')} rounded to a whole number`;
    case 'getVar':
      return `the variable ${varName(strategy, String(b.fields.var))}`;
    case 'param':
      return String(b.fields.name);
    case 'price':
      return `the ${srcWord(String(b.fields.src))}`;
    case 'priceAgo':
      return `the ${srcWord(String(b.fields.src))} ${v('bars')} bars ago`;
    case 'window':
      return `the ${v('n')}-bar ${b.fields.fn} of the ${srcWord(String(b.fields.src))}`;
    case 'indicator':
      return `the ${v('period')}-bar ${b.fields.ind} of the ${srcWord(String(b.fields.src))}`;
    case 'portfolio':
      switch (b.fields.item) {
        case 'Cash': return 'the available cash';
        case 'Position': return 'the current position size';
        case 'Average Entry Price': return 'the average entry price';
        default: return 'the total portfolio value';
      }
    case 'callFn': {
      const f = strategy.functions.find((x) => x.id === String(b.fields.fn));
      const args = f ? f.params.map((p) => explainValue(strategy, b.values?.[p] ?? null)).join(', ') : '…';
      return `${f ? f.name : 'function'}(${args})`;
    }
    // boolean
    case 'compare':
      return `${v('a')} ${OP_WORD[String(b.fields.op)]} ${v('b')}`;
    case 'and':
      return `${v('a')} and ${v('b')}`;
    case 'or':
      return `${v('a')} or ${v('b')}`;
    case 'not':
      return `not ${v('x')}`;
    default:
      return b.type;
  }
}

function buyAmount(strategy: Strategy, b: Block): string {
  const amt = explainValue(strategy, b.values?.amount ?? null);
  const unit = String(b.fields.unit);
  if (unit === '% of cash') return `${amt}% of the available cash`;
  if (unit === 'USDT') return `${amt} USDT`;
  return `${amt} BTC`;
}

function sellAmount(strategy: Strategy, b: Block): string {
  const amt = explainValue(strategy, b.values?.amount ?? null);
  const unit = String(b.fields.unit);
  if (unit === '% of position') return `${amt}% of the current position`;
  return `${amt} BTC`;
}

/** Render a single statement block as one or more English sentences. */
export function explainStatement(strategy: Strategy, id: string): string[] {
  const b = strategy.blocks[id];
  if (!b) return [];
  const v = (name: string) => explainValue(strategy, b.values?.[name] ?? null);
  const body = (name: string) => (b.statements?.[name] ?? []).flatMap((cid) => explainStatement(strategy, cid));

  switch (b.type) {
    case 'if': {
      const cond = v('condition');
      const inner = body('do');
      if (inner.length === 0) return [`If ${cond}, do nothing yet.`];
      return [`If ${cond}:`, ...inner.map((s) => '  ' + s)];
    }
    case 'ifelse': {
      const cond = v('condition');
      const inner = body('do');
      const els = body('else');
      const lines = [`If ${cond}:`, ...inner.map((s) => '  ' + s)];
      if (els.length) lines.push('Otherwise:', ...els.map((s) => '  ' + s));
      return lines;
    }
    case 'setVar':
      return [`Set ${varName(strategy, String(b.fields.var))} to ${v('value')}.`];
    case 'changeVar':
      return [`Change ${varName(strategy, String(b.fields.var))} by ${v('value')}.`];
    case 'buy':
      return [`Buy ${buyAmount(strategy, b)} of the selected cryptocurrency.`];
    case 'sell':
      return [`Sell ${sellAmount(strategy, b)} of the selected cryptocurrency.`];
    case 'sellAll':
      return [`Sell the entire position.`];
    default:
      return [b.type];
  }
}

/** Render a full strategy as a readable English description. */
export function explainStrategy(strategy: Strategy): string {
  const parts: string[] = [];
  if (strategy.setup.length) {
    const lines = strategy.setup.flatMap((id) => explainStatement(strategy, id));
    parts.push('Before the strategy starts (SETUP):', ...lines.map((s) => '  ' + s));
  }
  parts.push('On every bar:', ...(strategy.onBar.flatMap((id) => explainStatement(strategy, id)) || ['  Do nothing.']).map((s) => '  ' + s));
  return parts.join('\n');
}
