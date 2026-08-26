// ─────────────────────────────────────────────────────────────────────────────
// Stratch — strategy intermediate representation (IR)
// The strategy model is fully independent of the block UI, so it can be
// rendered, validated, run, explained and exported from one source.
// ─────────────────────────────────────────────────────────────────────────────

export type Category =
  | 'control'
  | 'logic'
  | 'math'
  | 'variables'
  | 'market'
  | 'portfolio'
  | 'trade'
  | 'indicators'
  | 'myblocks';

export type ValueType = 'number' | 'boolean';
export type FieldType = 'dropdown' | 'number' | 'text' | 'var' | 'function' | 'bool';
export type FieldValue = string | number | boolean;

export type Part =
  | { k: 'label'; text: string }
  | { k: 'field'; name: string; f: FieldType; options?: string[] }
  | { k: 'value'; name: string; vt: ValueType };

export interface BlockDef {
  type: string;
  category: Category;
  kind: 'statement' | 'value';
  vt?: ValueType;
  color?: string;
  parts: Part[];
  statements?: string[];
  defaults?: Record<string, FieldValue>;
}

export interface Block {
  id: string;
  type: string;
  fields: Record<string, FieldValue>;
  statements?: Record<string, string[]>;
  values?: Record<string, string | null>;
}

export interface VarDef {
  id: string;
  name: string;
}

export interface FunctionDef {
  id: string;
  name: string;
  params: string[];
  returnBlockId: string | null;
}

export interface Strategy {
  blocks: Record<string, Block>;
  vars: VarDef[];
  functions: FunctionDef[];
  setup: string[];
  onBar: string[];
}

// ── colours ──────────────────────────────────────────────────────────────────

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  control: { label: 'Control', color: '#22d3ee' },
  logic: { label: 'Logic', color: '#34d399' },
  math: { label: 'Math', color: '#a78bfa' },
  variables: { label: 'Variables', color: '#fbbf24' },
  market: { label: 'Market', color: '#38bdf8' },
  portfolio: { label: 'Portfolio', color: '#f472b6' },
  trade: { label: 'Trade', color: '#f87171' },
  indicators: { label: 'Indicators', color: '#818cf8' },
  myblocks: { label: 'My Blocks', color: '#fb923c' },
};

export function blockColor(type: string): string {
  const def = BLOCKS[type];
  if (!def) return '#7dd3fc';
  return def.color ?? CATEGORY_META[def.category].color;
}

// ── block registry ───────────────────────────────────────────────────────────

const SRC = ['Open', 'High', 'Low', 'Close', 'Volume'];

export const INDICATORS = [
  'EMA', 'RSI', 'MACD', 'Bollinger Upper', 'Bollinger Middle', 'Bollinger Lower', 'ATR', 'VWAP', 'ROC',
];

export const BLOCKS: Record<string, BlockDef> = {
  // control
  if: {
    type: 'if', category: 'control', kind: 'statement',
    parts: [{ k: 'label', text: 'IF' }, { k: 'value', name: 'condition', vt: 'boolean' }, { k: 'label', text: 'THEN' }],
    statements: ['do'],
  },
  ifelse: {
    type: 'ifelse', category: 'control', kind: 'statement',
    parts: [{ k: 'label', text: 'IF' }, { k: 'value', name: 'condition', vt: 'boolean' }, { k: 'label', text: 'THEN' }],
    statements: ['do', 'else'],
  },

  // logic (boolean)
  and: {
    type: 'and', category: 'logic', kind: 'value', vt: 'boolean',
    parts: [{ k: 'value', name: 'a', vt: 'boolean' }, { k: 'label', text: 'AND' }, { k: 'value', name: 'b', vt: 'boolean' }],
  },
  or: {
    type: 'or', category: 'logic', kind: 'value', vt: 'boolean',
    parts: [{ k: 'value', name: 'a', vt: 'boolean' }, { k: 'label', text: 'OR' }, { k: 'value', name: 'b', vt: 'boolean' }],
  },
  not: {
    type: 'not', category: 'logic', kind: 'value', vt: 'boolean',
    parts: [{ k: 'label', text: 'NOT' }, { k: 'value', name: 'x', vt: 'boolean' }],
  },
  compare: {
    type: 'compare', category: 'logic', kind: 'value', vt: 'boolean',
    parts: [
      { k: 'value', name: 'a', vt: 'number' },
      { k: 'field', name: 'op', f: 'dropdown', options: ['>', '<', '=', '>=', '<=', '!='] },
      { k: 'value', name: 'b', vt: 'number' },
    ],
    defaults: { op: '>' },
  },

  // math (number)
  arith: {
    type: 'arith', category: 'math', kind: 'value', vt: 'number',
    parts: [
      { k: 'value', name: 'a', vt: 'number' },
      { k: 'field', name: 'op', f: 'dropdown', options: ['+', '−', '×', '÷'] },
      { k: 'value', name: 'b', vt: 'number' },
    ],
    defaults: { op: '+' },
  },
  minmax: {
    type: 'minmax', category: 'math', kind: 'value', vt: 'number',
    parts: [
      { k: 'field', name: 'op', f: 'dropdown', options: ['min', 'max'] },
      { k: 'label', text: '(' },
      { k: 'value', name: 'a', vt: 'number' },
      { k: 'label', text: ',' },
      { k: 'value', name: 'b', vt: 'number' },
      { k: 'label', text: ')' },
    ],
    defaults: { op: 'min' },
  },
  abs: {
    type: 'abs', category: 'math', kind: 'value', vt: 'number',
    parts: [{ k: 'label', text: 'abs' }, { k: 'value', name: 'x', vt: 'number' }],
  },
  round: {
    type: 'round', category: 'math', kind: 'value', vt: 'number',
    parts: [{ k: 'label', text: 'round' }, { k: 'value', name: 'x', vt: 'number' }],
  },
  number: {
    type: 'number', category: 'math', kind: 'value', vt: 'number',
    parts: [{ k: 'field', name: 'n', f: 'number' }],
    defaults: { n: 0 },
  },

  // variables
  setVar: {
    type: 'setVar', category: 'variables', kind: 'statement',
    parts: [
      { k: 'label', text: 'set' },
      { k: 'field', name: 'var', f: 'var' },
      { k: 'label', text: 'to' },
      { k: 'value', name: 'value', vt: 'number' },
    ],
  },
  changeVar: {
    type: 'changeVar', category: 'variables', kind: 'statement',
    parts: [
      { k: 'label', text: 'change' },
      { k: 'field', name: 'var', f: 'var' },
      { k: 'label', text: 'by' },
      { k: 'value', name: 'value', vt: 'number' },
    ],
  },
  getVar: {
    type: 'getVar', category: 'variables', kind: 'value', vt: 'number',
    parts: [{ k: 'field', name: 'var', f: 'var' }],
  },

  // market
  price: {
    type: 'price', category: 'market', kind: 'value', vt: 'number',
    parts: [{ k: 'field', name: 'src', f: 'dropdown', options: SRC }],
    defaults: { src: 'Close' },
  },
  priceAgo: {
    type: 'priceAgo', category: 'market', kind: 'value', vt: 'number',
    parts: [
      { k: 'field', name: 'src', f: 'dropdown', options: SRC },
      { k: 'value', name: 'bars', vt: 'number' },
      { k: 'label', text: 'bars ago' },
    ],
    defaults: { src: 'Close' },
  },
  window: {
    type: 'window', category: 'market', kind: 'value', vt: 'number',
    parts: [
      { k: 'field', name: 'fn', f: 'dropdown', options: ['average', 'sum', 'highest', 'lowest'] },
      { k: 'label', text: 'of' },
      { k: 'field', name: 'src', f: 'dropdown', options: SRC },
      { k: 'label', text: 'over' },
      { k: 'value', name: 'n', vt: 'number' },
      { k: 'label', text: 'bars' },
    ],
    defaults: { fn: 'average', src: 'Close' },
  },

  // indicators
  indicator: {
    type: 'indicator', category: 'indicators', kind: 'value', vt: 'number',
    parts: [
      { k: 'field', name: 'ind', f: 'dropdown', options: INDICATORS },
      { k: 'field', name: 'src', f: 'dropdown', options: SRC },
      { k: 'value', name: 'period', vt: 'number' },
      { k: 'label', text: 'bars' },
    ],
    defaults: { ind: 'EMA', src: 'Close' },
  },

  // portfolio
  portfolio: {
    type: 'portfolio', category: 'portfolio', kind: 'value', vt: 'number',
    parts: [{ k: 'field', name: 'item', f: 'dropdown', options: ['Cash', 'Position', 'Average Entry Price', 'Portfolio Value'] }],
    defaults: { item: 'Cash' },
  },

  // trade
  buy: {
    type: 'buy', category: 'trade', kind: 'statement', color: '#22c55e',
    parts: [
      { k: 'label', text: 'BUY' },
      { k: 'value', name: 'amount', vt: 'number' },
      { k: 'field', name: 'unit', f: 'dropdown', options: ['% of cash', 'USDT', 'BTC'] },
    ],
    defaults: { unit: '% of cash' },
  },
  sell: {
    type: 'sell', category: 'trade', kind: 'statement', color: '#ef4444',
    parts: [
      { k: 'label', text: 'SELL' },
      { k: 'value', name: 'amount', vt: 'number' },
      { k: 'field', name: 'unit', f: 'dropdown', options: ['% of position', 'BTC'] },
    ],
    defaults: { unit: '% of position' },
  },
  sellAll: {
    type: 'sellAll', category: 'trade', kind: 'statement', color: '#ef4444',
    parts: [{ k: 'label', text: 'Sell All' }],
  },

  // my blocks — the call block's params are dynamic (see callFnParts)
  callFn: {
    type: 'callFn', category: 'myblocks', kind: 'value', vt: 'number',
    parts: [{ k: 'field', name: 'fn', f: 'function' }],
  },
  // function definition — lives in SETUP (like a module-level `def`)
  defineFn: {
    type: 'defineFn', category: 'myblocks', kind: 'statement',
    parts: [
      { k: 'label', text: 'define' },
      { k: 'field', name: 'name', f: 'text' },
      { k: 'label', text: '(' },
      { k: 'field', name: 'params', f: 'text' },
      { k: 'label', text: ')' },
      { k: 'label', text: 'return' },
      { k: 'value', name: 'return', vt: 'number' },
    ],
    defaults: { name: 'myBlock', params: '' },
  },
  // parameter reference — only valid inside a My Block's return expression
  param: {
    type: 'param', category: 'myblocks', kind: 'value', vt: 'number',
    parts: [{ k: 'field', name: 'name', f: 'dropdown', options: [] }],
  },
};

// ── palette (static, ordered) ────────────────────────────────────────────────

export interface PaletteItem {
  type: string;
  label: string;
}

export interface PaletteGroup {
  category: Category;
  items: PaletteItem[];
}

export const PALETTE: PaletteGroup[] = [
  { category: 'control', items: [{ type: 'if', label: 'if' }, { type: 'ifelse', label: 'if / else' }] },
  {
    category: 'logic',
    items: [
      { type: 'and', label: 'AND' },
      { type: 'or', label: 'OR' },
      { type: 'not', label: 'NOT' },
      { type: 'compare', label: 'compare' },
    ],
  },
  {
    category: 'math',
    items: [
      { type: 'number', label: 'number' },
      { type: 'arith', label: 'arithmetic' },
      { type: 'minmax', label: 'min / max' },
      { type: 'abs', label: 'abs' },
      { type: 'round', label: 'round' },
    ],
  },
  {
    category: 'market',
    items: [
      { type: 'price', label: 'price' },
      { type: 'priceAgo', label: 'price N bars ago' },
      { type: 'window', label: 'window calc' },
    ],
  },
  { category: 'indicators', items: [{ type: 'indicator', label: 'indicator' }] },
  { category: 'portfolio', items: [{ type: 'portfolio', label: 'portfolio metric' }] },
  {
    category: 'trade',
    items: [
      { type: 'buy', label: 'BUY' },
      { type: 'sell', label: 'SELL' },
      { type: 'sellAll', label: 'Sell All' },
    ],
  },
];

// ── construction helpers ─────────────────────────────────────────────────────

let _seq = 0;
export function uid(prefix = 'b'): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq}_${Math.random().toString(36).slice(2, 7)}`;
}

export function newId(): string {
  return uid();
}

export function createBlock(type: string, overrides: Record<string, FieldValue> = {}): Block {
  const def = BLOCKS[type];
  const fields: Record<string, FieldValue> = {};
  for (const p of def.parts) {
    if (p.k !== 'field') continue;
    if (p.f === 'dropdown' && p.options?.length) fields[p.name] = p.options[0];
    else if (p.f === 'number') fields[p.name] = 0;
    else if (p.f === 'text') fields[p.name] = '';
    else if (p.f === 'var' || p.f === 'function') fields[p.name] = '';
    else if (p.f === 'bool') fields[p.name] = false;
  }
  Object.assign(fields, def.defaults ?? {}, overrides);

  const statements: Record<string, string[]> | undefined = def.statements
    ? Object.fromEntries(def.statements.map((s) => [s, [] as string[]]))
    : undefined;

  const values: Record<string, string | null> = {};
  for (const p of def.parts) if (p.k === 'value') values[p.name] = null;

  return { id: newId(), type, fields, statements, values };
}

export function emptyStrategy(): Strategy {
  return { blocks: {}, vars: [], functions: [], setup: [], onBar: [] };
}

/** Clone a subtree rooted at `rootId`, returning a fresh id map. */
export function cloneSubtree(strategy: Strategy, rootId: string, idMap: Map<string, string>): string {
  const src = strategy.blocks[rootId];
  const block: Block = {
    id: newId(),
    type: src.type,
    fields: { ...src.fields },
    statements: undefined,
    values: undefined,
  };
  idMap.set(rootId, block.id);
  if (src.statements) {
    block.statements = {};
    for (const [name, ids] of Object.entries(src.statements)) {
      block.statements[name] = ids.map((id) => cloneSubtree(strategy, id, idMap));
    }
  }
  if (src.values) {
    block.values = {};
    for (const [name, id] of Object.entries(src.values)) {
      block.values[name] = id ? cloneSubtree(strategy, id, idMap) : null;
    }
  }
  return block.id;
}

/** Collect every block id in the strategy (for validation / iteration). */
export function allBlockIds(strategy: Strategy): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
    const b = strategy.blocks[id];
    if (b?.statements) for (const ids of Object.values(b.statements)) ids.forEach(visit);
    if (b?.values) for (const cid of Object.values(b.values)) if (cid) visit(cid);
  };
  strategy.setup.forEach(visit);
  strategy.onBar.forEach(visit);
  strategy.functions.forEach((f) => f.returnBlockId && visit(f.returnBlockId));
  return out;
}
