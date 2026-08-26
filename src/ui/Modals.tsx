// ─────────────────────────────────────────────────────────────────────────────
// Modals — Make a Variable.
// Function definitions live in SETUP as `defineFn` blocks (edited inline), so
// no modal is needed for them.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Icon } from './Icon';
import { PREDEFINED_STRATEGIES, type PredefinedStrategy } from '../blockly/strategies';

function Modal({ title, children, onClose, width = 520 }: { title: string; children: React.ReactNode; onClose: () => void; width?: number }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }}>
        <div className="modal__head">
          {title}
          <span className="close" onClick={onClose}><Icon name="x" size={16} /></span>
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

export function StratPickerModal({ onClose, onPick }: { onClose: () => void; onPick: (strat: PredefinedStrategy) => void }) {
  return (
    <Modal title="Load a strategy" onClose={onClose} width={520}>
      <p className="hint" style={{ marginBottom: 12 }}>Pick a well-known strategy to load. This replaces your current blocks.</p>
      <div className="strat-list">
        {PREDEFINED_STRATEGIES.map((s) => (
          <button key={s.id} type="button" className="strat-item" onClick={() => onPick(s)}>
            <span className="strat-item__name">{s.name}</span>
            <span className="strat-item__desc">{s.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
