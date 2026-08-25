// ─────────────────────────────────────────────────────────────────────────────
// Modals — Make a Variable.
// Function definitions live in SETUP as `defineFn` blocks (edited inline), so
// no modal is needed for them.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Icon } from './Icon';

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
