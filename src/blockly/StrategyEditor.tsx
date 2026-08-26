// ─────────────────────────────────────────────────────────────────────────────
// StrategyEditor — two Blockly workspaces (SETUP / ON EVERY BAR) wrapped in a
// React component. Blockly owns drag/snap/nest/zoom/undo; the IR is derived on
// every change and pushed into the store.
//
// SETUP holds `defineFn` blocks (module-level function definitions); ON EVERY
// BAR is the entry point (`main`).
// ─────────────────────────────────────────────────────────────────────────────

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import {
  registerBlocks, setProviders, setParamProvider, buildToolbox, getTheme,
} from './blocks';
import { starterStrategy, cloneJson, type PredefinedStrategy } from './strategies';
import { getState, useEditorState, syncWorkspaces, saveState, loadState, resetState, setVars } from '../store';

export interface StrategyEditorHandle {
  highlightBlock: (id: string, message?: string) => void;
  clearHighlights: () => void;
  undo: () => void;
  redo: () => void;
  loadStrategy: (strat: PredefinedStrategy) => void;
  clearAll: () => void;
  loadJson: (setupJson: any, onBarJson: any) => void;
}

interface Props {
  onMakeVar: () => void;
}

function makeOptions(): Blockly.BlocklyOptions {
  return {
    theme: getTheme(),
    renderer: 'zelos',
    toolbox: buildToolbox(),
    trashcan: true,
    sounds: false,
    zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2, minScale: 0.4, scaleSpeed: 1.1, pinch: true },
    move: { scrollbars: true, drag: true, wheel: false },
    grid: { spacing: 26, length: 1, colour: '#131c2d', snap: true },
    maxTrashcanContents: 32,
  };
}

function scanDefines(ws: Blockly.WorkspaceSvg | null): { name: string; id: string; params: string[] }[] {
  if (!ws) return [];
  const out: { name: string; id: string; params: string[] }[] = [];
  for (const b of ws.getAllBlocks(false)) {
    if (b.type === 'defineFn') {
      const name = String(b.getFieldValue('name') ?? '').trim() || 'myBlock';
      const params = String(b.getFieldValue('params') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      out.push({ name, id: b.id, params });
    }
  }
  return out;
}

function allParams(ws: Blockly.WorkspaceSvg | null): string[] {
  const set = new Set<string>();
  for (const f of scanDefines(ws)) f.params.forEach((p) => set.add(p));
  return [...set];
}

let lastFocused: Blockly.WorkspaceSvg | null = null;
const activeWsRef: { current: Blockly.WorkspaceSvg | null } = { current: null };

export const StrategyEditor = forwardRef<StrategyEditorHandle, Props>(function StrategyEditor({ onMakeVar }, ref) {
  const setupRef = useRef<HTMLDivElement>(null);
  const onBarRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<{ setup: Blockly.WorkspaceSvg; onBar: Blockly.WorkspaceSvg } | null>(null);
  const callbacks = useRef({ onMakeVar });
  callbacks.current = { onMakeVar };

  const state = useEditorState();
  const fnSig = JSON.stringify(state.strategy.functions.map((f) => [f.name, f.params]));

  // resizable SETUP / ON EVERY BAR split
  const splitRef = useRef<HTMLDivElement>(null);
  const [setupPct, setSetupPct] = useState(50);
  function onSplitDown(e: React.PointerEvent) {
    e.preventDefault();
    const container = splitRef.current;
    if (!container) return;
    const onMove = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      setSetupPct(Math.min(82, Math.max(18, ((ev.clientY - rect.top) / rect.height) * 100)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
  }

  // refresh toolbox + callFn blocks when the function signature changes
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const tb = buildToolbox();
    ws.setup.updateToolbox(tb);
    ws.onBar.updateToolbox(tb);
    for (const w of [ws.setup, ws.onBar]) {
      for (const b of w.getAllBlocks(false)) {
        if (b.type === 'callFn') (b as any).rebuildArgs?.(b.getFieldValue('fn'));
      }
    }
  }, [fnSig]);

  // Keyboard shortcuts: Blockly binds them to a single "main workspace", which
  // is unreliable with two workspaces. Route any unhandled keypress to the
  // focused workspace through Blockly's own ShortcutRegistry.
  useEffect(() => {
    const isEditable = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      if (e.defaultPrevented) return; // Blockly already handled it natively
      const ws = activeWsRef.current;
      if (ws) Blockly.ShortcutRegistry.registry.onKeyDown(ws, e);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    registerBlocks();
    setProviders(
      () => getState().vars.map((v) => ({ name: v.name, id: v.id })),
      () => scanDefines(wsRef.current?.setup ?? null),
    );
    setParamProvider(() => allParams(wsRef.current?.setup ?? null));

    const setupWs = Blockly.inject(setupRef.current!, makeOptions());
    const onBarWs = Blockly.inject(onBarRef.current!, makeOptions());
    wsRef.current = { setup: setupWs, onBar: onBarWs };
    activeWsRef.current = setupWs;

    const mkVar = () => callbacks.current.onMakeVar();
    const mkFn = () => {
      const s = wsRef.current?.setup;
      if (!s) return;
      const block = Blockly.serialization.blocks.append(
        {
          type: 'defineFn',
          fields: { name: 'myBlock', params: '' },
          inputs: { return: { shadow: { type: 'number', fields: { n: 0 } } } },
        },
        s,
      );
      block?.moveBy(12, 12);
      syncWorkspaces(Blockly.serialization.workspaces.save(s), Blockly.serialization.workspaces.save(wsRef.current!.onBar));
      saveState();
    };
    setupWs.registerButtonCallback('MAKE_VAR', mkVar);
    setupWs.registerButtonCallback('MAKE_FN', mkFn);
    onBarWs.registerButtonCallback('MAKE_VAR', mkVar);
    onBarWs.registerButtonCallback('MAKE_FN', mkFn);

    // track the focused workspace for keyboard routing
    for (const ws of [setupWs, onBarWs]) {
      ws.getInjectionDiv().addEventListener('focusin', () => {
        activeWsRef.current = ws;
      });
    }

    // initial content — saved state or starter
    const loaded = loadState();
    const starter = starterStrategy();
    if (!loaded) setVars(starter.vars); // seed before loading blocks that reference variables
    const cur = getState();
    const sJson = loaded ? cur.setupJson : cloneJson(starter.setupJson);
    const oJson = loaded ? cur.onBarJson : cloneJson(starter.onBarJson);
    try {
      Blockly.serialization.workspaces.load(sJson, setupWs);
      Blockly.serialization.workspaces.load(oJson, onBarWs);
    } catch {
      /* fall through to empty */
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    const sync = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const s = Blockly.serialization.workspaces.save(setupWs);
        const o = Blockly.serialization.workspaces.save(onBarWs);
        syncWorkspaces(s, o);
        saveState();
      }, 120);
    };
    const focus = (w: Blockly.WorkspaceSvg) => () => { lastFocused = w; };
    setupWs.addChangeListener(focus(setupWs));
    onBarWs.addChangeListener(focus(onBarWs));
    setupWs.addChangeListener(sync);
    onBarWs.addChangeListener(sync);

    // resize handling
    const ro = new ResizeObserver(() => {
      Blockly.svgResize(setupWs);
      Blockly.svgResize(onBarWs);
    });
    ro.observe(setupRef.current!);
    ro.observe(onBarRef.current!);

    sync();

    return () => {
      ro.disconnect();
      setupWs.dispose();
      onBarWs.dispose();
      wsRef.current = null;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    highlightBlock(id: string, message?: string) {
      const ws = wsRef.current;
      if (!ws) return;
      for (const w of [ws.setup, ws.onBar]) {
        const b = w.getBlockById(id);
        if (b) {
          b.select();
          if (message) b.setWarningText(message);
          return;
        }
      }
    },
    clearHighlights() {
      const ws = wsRef.current;
      if (!ws) return;
      for (const w of [ws.setup, ws.onBar]) {
        for (const b of w.getAllBlocks(false)) b.setWarningText(null);
      }
    },
    undo() { lastFocused?.undo(false); },
    redo() { lastFocused?.undo(true); },
    loadStrategy(strat) {
      const ws = wsRef.current;
      if (!ws) return;
      resetState();
      if (strat.vars.length) setVars(strat.vars); // seed before loading blocks that reference variables
      Blockly.serialization.workspaces.load(cloneJson(strat.setupJson), ws.setup);
      Blockly.serialization.workspaces.load(cloneJson(strat.onBarJson), ws.onBar);
      const s = Blockly.serialization.workspaces.save(ws.setup);
      const o = Blockly.serialization.workspaces.save(ws.onBar);
      syncWorkspaces(s, o);
      saveState();
    },
    clearAll() {
      const ws = wsRef.current;
      if (!ws) return;
      resetState();
      ws.setup.clear();
      ws.onBar.clear();
      syncWorkspaces(Blockly.serialization.workspaces.save(ws.setup), Blockly.serialization.workspaces.save(ws.onBar));
      saveState();
    },
    loadJson(setupJson, onBarJson) {
      const ws = wsRef.current;
      if (!ws) return;
      ws.setup.clear();
      ws.onBar.clear();
      try {
        Blockly.serialization.workspaces.load(setupJson ?? { blocks: { blocks: [] } }, ws.setup);
        Blockly.serialization.workspaces.load(onBarJson ?? { blocks: { blocks: [] } }, ws.onBar);
      } catch {
        /* ignore malformed JSON */
      }
      syncWorkspaces(Blockly.serialization.workspaces.save(ws.setup), Blockly.serialization.workspaces.save(ws.onBar));
      saveState();
    },
  }));

  return (
    <div className="editor-split" ref={splitRef}>
      <div className="editor-region" style={{ flex: `0 0 ${setupPct}%` }}>
        <div className="region__head">
          <span className="bar" />
          <span>SETUP</span>
          <span className="region__sub">define variables &amp; functions — runs before the strategy starts</span>
        </div>
        <div className="editor-region__ws" ref={setupRef} />
      </div>
      <div className="editor-splitter" onPointerDown={onSplitDown} title="Drag to resize">
        <span className="editor-splitter__grip" />
      </div>
      <div className="editor-region" style={{ flex: '1 1 0%' }}>
        <div className="region__head">
          <span className="bar" />
          <span>ON EVERY BAR</span>
          <span className="region__sub">the main loop — runs once for each market bar</span>
        </div>
        <div className="editor-region__ws" ref={onBarRef} />
      </div>
    </div>
  );
});
