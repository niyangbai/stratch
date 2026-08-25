// ─────────────────────────────────────────────────────────────────────────────
// Blockly serialization JSON -> Stratch Strategy IR.
// The Blockly workspace is only an editing surface; the IR stays the single
// source of truth for validate / run / explain / export.
// Block ids are preserved from Blockly so error highlighting can map back.
//
// Functions (My Blocks) are defined as `defineFn` blocks inside SETUP, the
// same way module-level `def` statements sit above `main` in a program.
// ─────────────────────────────────────────────────────────────────────────────

import { BLOCKS, newId, type Strategy, type Block, type VarDef, type FunctionDef, type FieldValue } from '../ir';

type FnRef = { id: string; params: string[] };

function defaultFields(type: string): Record<string, FieldValue> {
  const def = BLOCKS[type];
  const f: Record<string, FieldValue> = {};
  if (!def) return f;
  for (const p of def.parts) {
    if (p.k !== 'field') continue;
    if (p.f === 'dropdown' && p.options?.length) f[p.name] = p.options[0];
    else if (p.f === 'number') f[p.name] = 0;
    else if (p.f === 'text') f[p.name] = '';
    else if (p.f === 'var' || p.f === 'function') f[p.name] = '';
    else if (p.f === 'bool') f[p.name] = false;
  }
  Object.assign(f, def.defaults ?? {});
  return f;
}

type Json = any;

function convertBlock(json: Json, blocks: Record<string, Block>, functions: FnRef[]): string {
  const type: string = json.type;
  const def = BLOCKS[type];
  const id: string = json.id ?? newId();
  const block: Block = {
    id,
    type,
    fields: { ...defaultFields(type), ...(json.fields ?? {}) },
  };
  const valueNames = new Set((def?.parts ?? []).filter((p) => p.k === 'value').map((p) => p.name));
  const hasStatements = (def?.statements?.length ?? 0) > 0;
  if (hasStatements) block.statements = {};
  if (valueNames.size > 0) block.values = {};

  if (json.inputs) {
    for (const [name, inp] of Object.entries(json.inputs)) {
      const childJson = (inp as Json)?.block ?? (inp as Json)?.shadow;
      if (!childJson) continue;
      if (def?.statements?.includes(name)) {
        block.statements![name] = convertStack(childJson, blocks, functions);
      } else if (valueNames.has(name)) {
        block.values = block.values ?? {};
        block.values[name] = convertBlock(childJson, blocks, functions);
      } else if (type === 'callFn' && name.startsWith('arg')) {
        block.values = block.values ?? {};
        block.values[name] = convertBlock(childJson, blocks, functions);
      }
    }
  }

  // callFn: positional args -> parameter names
  if (type === 'callFn') {
    const fn = functions.find((f) => f.id === String(block.fields.fn));
    const values: Record<string, string | null> = {};
    if (fn) fn.params.forEach((p, i) => (values[p] = block.values?.['arg' + i] ?? null));
    block.values = values;
  }

  blocks[id] = block;
  return id;
}

function convertStack(json: Json, blocks: Record<string, Block>, functions: FnRef[]): string[] {
  const ids: string[] = [];
  let cur: Json = json;
  while (cur) {
    ids.push(convertBlock(cur, blocks, functions));
    cur = cur?.next?.block ?? null;
  }
  return ids;
}

function splitParams(raw: string): string[] {
  return String(raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** Build the full engine-facing Strategy IR from the editor state. */
export function buildStrategy(vars: VarDef[], setupJson: Json | null, onBarJson: Json | null): Strategy {
  const blocks: Record<string, Block> = {};

  // Pass 1: pre-scan SETUP for defineFn blocks to know the callable functions
  // (name + params live directly in the serialized fields).
  const functions: FunctionDef[] = [];
  const scan = (json: Json) => {
    let cur: Json = json;
    while (cur) {
      if (cur.type === 'defineFn') {
        const name = String(cur.fields?.name ?? '').trim() || 'myBlock';
        functions.push({ id: cur.id ?? newId(), name, params: splitParams(cur.fields?.params), returnBlockId: null });
      }
      cur = cur?.next?.block ?? null;
    }
  };
  (setupJson?.blocks?.blocks ?? []).forEach(scan);

  // Pass 2: convert everything (functions list now known, for callFn args).
  const setup: string[] = [];
  for (const topJson of setupJson?.blocks?.blocks ?? []) {
    const ids = convertStack(topJson, blocks, functions);
    for (const id of ids) {
      const b = blocks[id];
      if (b.type === 'defineFn') {
        const fn = functions.find((f) => f.id === id);
        if (fn) fn.returnBlockId = b.values?.return ?? null;
      } else {
        setup.push(id);
      }
    }
  }

  const onBar = onBarJson?.blocks?.blocks
    ? onBarJson.blocks.blocks.flatMap((b: Json) => convertStack(b, blocks, functions))
    : [];

  return { blocks, vars, functions, setup, onBar };
}
