// ─────────────────────────────────────────────────────────────────────────────
// Editor state — variables, functions (My Blocks), and the resolved Strategy IR.
// Blockly owns the block editing surface; the IR is derived on every change and
// is the single source of truth for validate / run / explain / export.
// ─────────────────────────────────────────────────────────────────────────────

import { useSyncExternalStore } from 'react';
import { emptyStrategy, newId, type Strategy, type VarDef } from './ir';
import { buildStrategy, defaultReturnJson, type EditableFunction } from './blockly/generator';

export interface EditorState {
  vars: VarDef[];
  functions: EditableFunction[];
  strategy: Strategy;
  setupJson: any;
  onBarJson: any;
}

const EMPTY_WS = { blocks: { blocks: [] } };

let state: EditorState = {
  vars: [],
  functions: [],
  strategy: emptyStrategy(),
  setupJson: EMPTY_WS,
  onBarJson: EMPTY_WS,
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot(): EditorState {
  return state;
}

export function useEditorState(): EditorState {
  return useSyncExternalStore(subscribe, getSnapshot);
}
export function getState(): EditorState {
  return state;
}
export function useStrategy(): Strategy {
  return useEditorState().strategy;
}

function rebuild(): EditorState {
  state = { ...state, strategy: buildStrategy(state.vars, state.functions, state.setupJson, state.onBarJson) };
  return state;
}
function commit(mut: (s: EditorState) => EditorState) {
  state = mut(state);
  state = rebuild();
  emit();
}

// ── variables ────────────────────────────────────────────────────────────────

export function addVar(name: string): boolean {
  const clean = name.trim();
  if (!clean) return false;
  if (state.vars.some((v) => v.name.toLowerCase() === clean.toLowerCase())) return false;
  commit((s) => ({ ...s, vars: [...s.vars, { id: newId(), name: clean }] }));
  return true;
}
export function renameVar(id: string, name: string) {
  const clean = name.trim();
  if (!clean) return;
  commit((s) => ({ ...s, vars: s.vars.map((v) => (v.id === id ? { ...v, name: clean } : v)) }));
}
export function deleteVar(id: string) {
  commit((s) => ({ ...s, vars: s.vars.filter((v) => v.id !== id) }));
}

// ── functions (My Blocks) ────────────────────────────────────────────────────

export function addFunction(name: string, params: string[]): string {
  const clean = name.trim() || 'myBlock';
  const id = newId();
  commit((s) => ({ ...s, functions: [...s.functions, { id, name: clean, params, returnJson: defaultReturnJson() }] }));
  return id;
}
export function renameFunction(id: string, name: string) {
  const clean = name.trim();
  if (!clean) return;
  commit((s) => ({ ...s, functions: s.functions.map((f) => (f.id === id ? { ...f, name: clean } : f)) }));
}
export function deleteFunction(id: string) {
  commit((s) => ({ ...s, functions: s.functions.filter((f) => f.id !== id) }));
}
export function setFunctionParams(id: string, params: string[]) {
  commit((s) => ({ ...s, functions: s.functions.map((f) => (f.id === id ? { ...f, params } : f)) }));
}
export function setFunctionReturnJson(id: string, returnJson: any) {
  commit((s) => ({ ...s, functions: s.functions.map((f) => (f.id === id ? { ...f, returnJson } : f)) }));
}

// ── workspace sync (called by the editor on every Blockly change) ────────────

export function syncWorkspaces(setupJson: any, onBarJson: any) {
  state = { ...state, setupJson, onBarJson };
  state = rebuild();
  emit();
}

// ── JSON export / import ─────────────────────────────────────────────────────

export function exportStateJson(): string {
  return JSON.stringify(
    { version: 1, vars: state.vars, functions: state.functions, setupJson: state.setupJson, onBarJson: state.onBarJson },
    null,
    2,
  );
}

/** Import vars + functions from a saved payload. The block workspaces are
 *  loaded separately by the editor (so Blockly can re-render them). */
export function importState(payload: any): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const rawVars = Array.isArray(payload.vars) ? payload.vars : [];
  const rawFns = Array.isArray(payload.functions) ? payload.functions : [];
  const vars: VarDef[] = rawVars
    .filter((v: any) => v && typeof v.name === 'string' && v.name.trim())
    .map((v: any) => ({ id: typeof v.id === 'string' ? v.id : newId(), name: v.name }));
  const functions: EditableFunction[] = rawFns
    .filter((f: any) => f && typeof f.name === 'string' && f.name.trim())
    .map((f: any) => ({
      id: typeof f.id === 'string' ? f.id : newId(),
      name: f.name,
      params: Array.isArray(f.params) ? f.params.filter((p: any) => typeof p === 'string') : [],
      returnJson: f.returnJson ?? null,
    }));
  state = { ...state, vars, functions };
  state = rebuild();
  emit();
  return true;
}

// ── persistence ──────────────────────────────────────────────────────────────

const LS_KEY = 'stratch:v1';

export function saveState() {
  const payload = { vars: state.vars, functions: state.functions, setupJson: state.setupJson, onBarJson: state.onBarJson };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota errors */
  }
}
export function loadState(): boolean {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    state = {
      vars: Array.isArray(data.vars) ? data.vars : [],
      functions: Array.isArray(data.functions) ? data.functions : [],
      setupJson: data.setupJson ?? EMPTY_WS,
      onBarJson: data.onBarJson ?? EMPTY_WS,
      strategy: emptyStrategy(),
    };
    state = rebuild();
    emit();
    return true;
  } catch {
    return false;
  }
}
export function resetState() {
  state = { vars: [], functions: [], strategy: emptyStrategy(), setupJson: EMPTY_WS, onBarJson: EMPTY_WS };
  emit();
  saveState();
}
