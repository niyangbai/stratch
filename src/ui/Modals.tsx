// ─────────────────────────────────────────────────────────────────────────────
// Modals — Make a Variable, Make a Block, and the My Block return-expression
// editor (a mini Blockly workspace).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { registerBlocks, setParamProvider, getTheme, buildFnToolbox } from '../blockly/blocks';
import { setFunctionReturnJson, deleteFunction } from '../store';
import type { EditableFunction } from '../blockly/generator';

function Modal({ title, children, onClose, width = 520 }: { title: string; children: React.ReactNode; onClose: () => void; width?: number }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }}>
        <div className="modal__head">
          {title}
          <span className="close" onClick={onClose}>✕</span>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

export function MakeVarModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <Modal title="Make a Variable" onClose={onClose} width={400}>
      <div className="field-row">
        <label>Variable name</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. highestPrice" onKeyDown={(e) => e.key === 'Enter' && name.trim() && (onConfirm(name), onClose())} />
      </div>
      <div className="modal__foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" disabled={!name.trim()} onClick={() => { onConfirm(name); onClose(); }}>Create</button>
      </div>
    </Modal>
  );
}

export function MakeFnModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (name: string, params: string[]) => void }) {
  const [name, setName] = useState('');
  const [params, setParams] = useState('');
  const parsed = params.split(',').map((p) => p.trim()).filter(Boolean);
  return (
    <Modal title="Make a Block" onClose={onClose} width={440}>
      <div className="field-row">
        <label>Block name</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Momentum" />
      </div>
      <div className="field-row">
        <label>Parameters (comma-separated)</label>
        <input value={params} onChange={(e) => setParams(e.target.value)} placeholder="e.g. period" />
      </div>
      <p className="hint">The block returns a single value. You can edit its expression afterwards.</p>
      <div className="modal__foot">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn--primary" disabled={!name.trim()} onClick={() => { onConfirm(name, parsed); onClose(); }}>Create</button>
      </div>
    </Modal>
  );
}

export function FunctionEditorModal({ fn, onClose }: { fn: EditableFunction; onClose: () => void }) {
  const divRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);

  useEffect(() => {
    registerBlocks();
    setParamProvider(() => fn.params);
    const ws = Blockly.inject(divRef.current!, {
      theme: getTheme(),
      renderer: 'zelos',
      toolbox: buildFnToolbox(fn.params),
      trashcan: true,
      sounds: false,
      zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2, minScale: 0.4, scaleSpeed: 1.1, pinch: true },
      move: { scrollbars: true, drag: true, wheel: false },
      grid: { spacing: 26, length: 1, colour: '#131c2d', snap: true },
    });
    wsRef.current = ws;
    if (fn.returnJson) {
      try { Blockly.serialization.blocks.append(fn.returnJson, ws); } catch { /* ignore */ }
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    ws.addChangeListener(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const tops = ws.getTopBlocks(false);
        const json = tops.length === 1 ? Blockly.serialization.blocks.save(tops[0]) : null;
        setFunctionReturnJson(fn.id, json);
      }, 100);
    });
    const ro = new ResizeObserver(() => Blockly.svgResize(ws));
    ro.observe(divRef.current!);
    return () => {
      ro.disconnect();
      ws.dispose();
      wsRef.current = null;
      setParamProvider(() => []);
      if (timer) clearTimeout(timer);
    };
  }, [fn.id]);

  return (
    <Modal title={`My Block — ${fn.name}(${fn.params.join(', ')})`} onClose={onClose} width={640}>
      <p className="hint" style={{ marginBottom: 10 }}>Build the return expression. Parameters are available as <span className="up">param</span> blocks.</p>
      <div className="fn-editor__ws" ref={divRef} />
      <div className="modal__foot">
        <button className="btn" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => { deleteFunction(fn.id); onClose(); }}>Delete</button>
        <button className="btn btn--primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}
