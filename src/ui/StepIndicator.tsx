// ─────────────────────────────────────────────────────────────────────────────
// Step indicator — two steps: Build & Test · Backtest & Results
// ─────────────────────────────────────────────────────────────────────────────

import { Icon } from './Icon';

const STEPS = ['Build & Test', 'Simulate & Results'];

export function StepIndicator({ current, onStep }: { current: number; onStep: (n: number) => void }) {
  return (
    <div className="steps">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <div key={label} className={`step ${active ? 'active' : ''} ${done ? 'done' : ''}`} onClick={() => onStep(n)} role="button">
            <span className="step__num">{done ? <Icon name="check" size={11} /> : n}</span>
            <span className="step__label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
