// ─────────────────────────────────────────────────────────────────────────────
// Blockly serialization JSON  ->  Stratch Strategy IR.
// The Blockly workspace is only an editing surface; the IR stays the single
// source of truth for validate / run / explain / export.
// Block ids are preserved from Blockly so error highlighting can map back.
// ─────────────────────────────────────────────────────────────────────────────

import { BLOCKS, newId, type Strategy, type Block, type VarDef, type FunctionDef, type FieldValue } from '../ir';

export interface EditableFunction {
  id: string;
  name: string;
  params: string[];
  returnJson: any | null;
}

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

function convertBlock(json: Json, blocks: Record<string, Block>, functions: EditableFunction[]): string {
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

function convertStack(json: Json, blocks: Record<string, Block>, functions: EditableFunction[]): string[] {
  const ids: string[] = [];
  let cur: Json = json;
  while (cur) {
    ids.push(convertBlock(cur, blocks, functions));
    cur = cur?.next?.block ?? null;
  }
  return ids;
}

/** Build the full engine-facing Strategy IR from the editor state. */
export function buildStrategy(
  vars: VarDef[],
  functions: EditableFunction[],
  setupJson: Json | null,
  onBarJson: Json | null,
): Strategy {
  const blocks: Record<string, Block> = {};

  const setup = setupJson?.blocks?.blocks
    ? setupJson.blocks.blocks.flatMap((b: Json) => convertStack(b, blocks, functions))
    : [];

  const onBar = onBarJson?.blocks?.blocks
    ? onBarJson.blocks.blocks.flatMap((b: Json) => convertStack(b, blocks, functions))
    : [];

  const resolved: FunctionDef[] = functions.map((f) => ({
    id: f.id,
    name: f.name,
    params: f.params,
    returnBlockId: f.returnJson ? convertBlock(f.returnJson, blocks, functions) : null,
  }));

  return { blocks, vars, functions: resolved, setup, onBar };
}

/** Convenience: default return expression for a freshly created function. */
export function defaultReturnJson(): Json {
  return { type: 'number', fields: { n: 0 } };
}
