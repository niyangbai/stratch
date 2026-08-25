// ─────────────────────────────────────────────────────────────────────────────
// StrategyEditor — two Blockly workspaces (SETUP / ON EVERY BAR) wrapped in a
// React component. Blockly owns drag/snap/nest/zoom/undo; the IR is derived on
// every change and pushed into the store.
// ─────────────────────────────────────────────────────────────────────────────

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as Blockly from 'blockly';
import {
  registerBlocks, setProviders, buildToolbox, getTheme, starterSetupJson, starterOnBarJson,
} from './blocks';
import { getState, useEditorState, syncWorkspaces, saveState, loadState, resetState } from '../store';

export interface StrategyEditorHandle {
  highlightBlock: (id: string, message?: string) => void;
  clearHighlights: () => void;
  undo: () => void;
  redo: () => void;
  loadExample: () => void;
  clearAll: () => void;
}

interface Props {
  onMakeVar: () => void;
  onMakeFn: () => void;
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

let lastFocused: Blockly.WorkspaceSvg | null = null;

export const StrategyEditor = forwardRef<StrategyEditorHandle, Props>(function StrategyEditor({ onMakeVar, onMakeFn }, ref) {
  const setupRef = useRef<HTMLDivElement>(null);
  const onBarRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<{ setup: Blockly.WorkspaceSvg; onBar: Blockly.WorkspaceSvg } | null>(null);
  const callbacks = useRef({ onMakeVar, onMakeFn });
  callbacks.current = { onMakeVar, onMakeFn };

  const state = useEditorState();

  // refresh toolbox + callFn blocks when functions change
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
  }, [state.functions]);

  useEffect(() => {
    registerBlocks();
    setProviders(
      () => getState().vars.map((v) => ({ name: v.name, id: v.id })),
      () => getState().functions.map((f) => ({ name: f.name, id: f.id, params: f.params })),
    );

    const setupWs = Blockly.inject(setupRef.current!, makeOptions());
    const onBarWs = Blockly.inject(onBarRef.current!, makeOptions());
    wsRef.current = { setup: setupWs, onBar: onBarWs };

    const mkVar = () => callbacks.current.onMakeVar();
    const mkFn = () => callbacks.current.onMakeFn();
    setupWs.registerButtonCallback('MAKE_VAR', mkVar);
    setupWs.registerButtonCallback('MAKE_FN', mkFn);
    onBarWs.registerButtonCallback('MAKE_VAR', mkVar);
    onBarWs.registerButtonCallback('MAKE_FN', mkFn);

    // initial content — saved state or starter
    const loaded = loadState();
    const cur = getState();
    const sJson = loaded ? cur.setupJson : starterSetupJson();
    const oJson = loaded ? cur.onBarJson : starterOnBarJson();
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
    loadExample() {
      const ws = wsRef.current;
      if (!ws) return;
      resetState();
      Blockly.serialization.workspaces.load(starterSetupJson(), ws.setup);
      Blockly.serialization.workspaces.load(starterOnBarJson(), ws.onBar);
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
  }));

  return (
    <>
      <div className="editor-region">
        <div className="region__head">
          <span className="bar" />
          <span>SETUP</span>
          <span className="region__sub">run once before the strategy starts</span>
        </div>
        <div className="editor-region__ws" ref={setupRef} />
      </div>
      <div className="editor-region">
        <div className="region__head">
          <span className="bar" />
          <span>ON EVERY BAR</span>
          <span className="region__sub">run once for each market bar</span>
        </div>
        <div className="editor-region__ws" ref={onBarRef} />
      </div>
    </>
  );
});
