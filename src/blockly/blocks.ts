// ─────────────────────────────────────────────────────────────────────────────
// Blockly block definitions, toolbox, theme and option providers.
// Blocks are generated from the IR registry (ir.ts) so the editor and the
// engine can never drift apart. Uses Scratch's Blockly lineage with a dark
// "crypto terminal" theme.
// ─────────────────────────────────────────────────────────────────────────────

import * as Blockly from 'blockly';
import { BLOCKS, CATEGORY_META, PALETTE, blockColor, type BlockDef, type Part } from '../ir';

// ── dynamic option providers (set by the editor component) ──────────────────

export interface VarOption { name: string; id: string }
export interface FnOption { name: string; id: string; params: string[] }

let varProvider: () => VarOption[] = () => [];
let fnProvider: () => FnOption[] = () => [];
let paramProvider: () => string[] = () => [];

export function setProviders(v: () => VarOption[], f: () => FnOption[]) {
  varProvider = v;
  fnProvider = f;
}
export function setParamProvider(p: () => string[]) {
  paramProvider = p;
}

function paramOptions(): [string, string][] {
  return paramProvider().map((p) => [p, p]);
}

function varOptions(): [string, string][] {
  return varProvider().map((v) => [v.name, v.id]);
}
function fnOptions(): [string, string][] {
  return fnProvider().map((f) => [f.name, f.id]);
}
function fnParams(id: string): string[] {
  return fnProvider().find((f) => f.id === id)?.params ?? [];
}

// ── colour helpers ───────────────────────────────────────────────────────────

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
const colour = (type: string) => shade(blockColor(type), 0.34);

// ── field factory ────────────────────────────────────────────────────────────

function makeField(p: Part, def: BlockDef): Blockly.Field {
  if (p.k !== 'field') return new Blockly.FieldLabel('…');
  const dflt = def.defaults?.[p.name];
  const f = p.f;
  if (f === 'dropdown') {
    const options = (p.options ?? []).map((o): [string, string] => [o, o]);
    const field = new Blockly.FieldDropdown(options);
    const val = typeof dflt === 'string' ? dflt : options[0]?.[1];
    if (val !== undefined) field.setValue(val);
    return field;
  }
  if (f === 'number') {
    const val = typeof dflt === 'number' ? dflt : 0;
    return new Blockly.FieldNumber(val);
  }
  if (f === 'var') {
    const field = new Blockly.FieldDropdown(() => varOptions());
    if (typeof dflt === 'string') field.setValue(dflt);
    return field;
  }
  if (f === 'function') {
    const field = new Blockly.FieldDropdown(() => fnOptions());
    if (typeof dflt === 'string') field.setValue(dflt);
    return field;
  }
  if (f === 'text') return new Blockly.FieldTextInput(typeof dflt === 'string' ? dflt : '');
  if (f === 'bool') return new Blockly.FieldCheckbox(Boolean(dflt));
  return new Blockly.FieldLabel(String(dflt ?? ''));
}

// ── block registration ───────────────────────────────────────────────────────

function appendParts(block: any, def: BlockDef) {
  let dummy: Blockly.Input | null = null;
  const ensureDummy = (): Blockly.Input => {
    if (!dummy) dummy = block.appendDummyInput();
    return dummy!;
  };
  for (const p of def.parts) {
    if (p.k === 'label') {
      ensureDummy().appendField(p.text);
    } else if (p.k === 'field') {
      ensureDummy().appendField(makeField(p, def), p.name);
    } else {
      block.appendValueInput(p.name).setCheck(p.vt === 'number' ? 'Number' : 'Boolean');
      dummy = null;
    }
  }
}

function registerBlocks() {
  for (const type of Object.keys(BLOCKS)) {
    const def = BLOCKS[type];

    if (type === 'if') {
      Blockly.Blocks[type] = {
        init(this: any) {
          this.setPreviousStatement(true);
          this.setNextStatement(true);
          this.setColour(colour(type));
          this.setInputsInline(true);
          this.appendDummyInput().appendField('IF');
          this.appendValueInput('condition').setCheck('Boolean');
          this.appendDummyInput().appendField('THEN');
          this.appendStatementInput('do');
        },
      };
      continue;
    }

    if (type === 'ifelse') {
      Blockly.Blocks[type] = {
        init(this: any) {
          this.setPreviousStatement(true);
          this.setNextStatement(true);
          this.setColour(colour(type));
          this.setInputsInline(true);
          this.appendDummyInput().appendField('IF');
          this.appendValueInput('condition').setCheck('Boolean');
          this.appendDummyInput().appendField('THEN');
          this.appendStatementInput('do');
          this.appendDummyInput().appendField('ELSE');
          this.appendStatementInput('else');
        },
      };
      continue;
    }

    if (type === 'callFn') {
      Blockly.Blocks[type] = {
        init(this: any) {
          this.setOutput(true, 'Number');
          this.setColour(colour(type));
          this.setInputsInline(true);
          this.setTooltip('Call a My Block');
          const field = new Blockly.FieldDropdown(() => fnOptions());
          this.appendDummyInput().appendField(field, 'fn');
          this.rebuildArgs(field.getValue() ?? '');
          this.setOnChange((e: any) => {
            if (e.type === Blockly.Events.BLOCK_CHANGE && e.element === 'field' && e.name === 'fn') {
              this.rebuildArgs(e.newValue);
            }
          });
        },
        rebuildArgs(this: any, fnId: string) {
          const params = fnParams(fnId);
          const names = this.inputList.map((i: any) => i.name);
          names.forEach((n: string) => this.removeInput(n));
          const field = new Blockly.FieldDropdown(() => fnOptions());
          field.setValue(fnId);
          this.appendDummyInput().appendField(field, 'fn');
          params.forEach((p: string, i: number) => {
            this.appendDummyInput().appendField(p, 'PLBL' + i);
            this.appendValueInput('arg' + i).setCheck('Number');
          });
        },
      };
      continue;
    }

    if (type === 'param') {
      Blockly.Blocks[type] = {
        init(this: any) {
          this.setOutput(true, 'Number');
          this.setColour(colour(type));
          this.setInputsInline(true);
          this.appendDummyInput().appendField(new Blockly.FieldDropdown(() => paramOptions()), 'name');
        },
      };
      continue;
    }

    // generic block
    Blockly.Blocks[type] = {
      init(this: any) {
        this.setColour(colour(type));
        if (def.kind === 'value') {
          this.setOutput(true, def.vt === 'number' ? 'Number' : 'Boolean');
        } else {
          this.setPreviousStatement(true);
          this.setNextStatement(true);
        }
        this.setInputsInline(true);
        appendParts(this, def);
      },
    };
  }
}

// ── toolbox ──────────────────────────────────────────────────────────────────

// Value inputs that get a default `number` shadow block so they read as inline
// numbers but can still be replaced by a variable / parameter / expression.
const SHADOWS: Record<string, any> = {
  priceAgo: { inputs: { bars: { shadow: { type: 'number', fields: { n: 5 } } } } },
  window: { inputs: { n: { shadow: { type: 'number', fields: { n: 20 } } } } },
  indicator: { inputs: { period: { shadow: { type: 'number', fields: { n: 14 } } } } },
  defineFn: { inputs: { return: { shadow: { type: 'number', fields: { n: 0 } } } } },
};

function blockItem(type: string): any {
  return { kind: 'block', type, ...(SHADOWS[type] ?? {}) };
}

export function buildToolbox(): any {
  const contents: any[] = [];
  for (const group of PALETTE) {
    const meta = CATEGORY_META[group.category];
    contents.push({
      kind: 'category',
      name: meta.label,
      colour: meta.color,
      contents: group.items.map((item) => blockItem(item.type)),
    });
  }
  // Variables
  contents.push({
    kind: 'category',
    name: 'Variables',
    colour: CATEGORY_META.variables.color,
    contents: [
      { kind: 'button', text: 'Make a Variable', callbackkey: 'MAKE_VAR' },
      { kind: 'block', type: 'setVar' },
      { kind: 'block', type: 'changeVar' },
      { kind: 'block', type: 'getVar' },
    ],
  });
  // My Blocks
  const fnContents: any[] = [
    { kind: 'button', text: 'Make a Block', callbackkey: 'MAKE_FN' },
    { kind: 'block', type: 'defineFn' },
    { kind: 'block', type: 'param' },
  ];
  for (const f of fnProvider()) {
    fnContents.push({ kind: 'block', type: 'callFn', fields: { fn: f.id } });
  }
  contents.push({ kind: 'category', name: 'My Blocks', colour: CATEGORY_META.myblocks.color, contents: fnContents });

  return { kind: 'categoryToolbox', contents };
}

// ── theme ────────────────────────────────────────────────────────────────────

let _theme: Blockly.Theme | null = null;
export function getTheme(): Blockly.Theme {
  if (!_theme) _theme = makeTheme();
  return _theme;
}

export function makeTheme(): Blockly.Theme {
  return Blockly.Theme.defineTheme('stratch', {
    name: 'Stratch',
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#080d16',
      toolboxBackgroundColour: '#0b1220',
      toolboxForegroundColour: '#9fb2cc',
      flyoutBackgroundColour: '#0b1220',
      flyoutForegroundColour: '#9fb2cc',
      flyoutOpacity: 1,
      scrollbarColour: '#2a3d59',
      scrollbarOpacity: 0.8,
      insertionMarkerColour: '#00e6a8',
      insertionMarkerOpacity: 0.5,
      markerColour: '#00e6a8',
      cursorColour: '#00e6a8',
      selectedGlowColour: '#00e6a8',
      selectedGlowOpacity: 0.35,
      replacementGlowColour: '#00e6a8',
      replacementGlowOpacity: 0.3,
    },
    fontStyle: {
      family: "'JetBrains Mono', ui-monospace, Menlo, monospace",
      weight: '600',
      size: 12,
    },
    startHats: false,
  } as any);
}

export { registerBlocks };
