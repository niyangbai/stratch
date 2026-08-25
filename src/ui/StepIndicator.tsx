// ─────────────────────────────────────────────────────────────────────────────
// Step indicator — Build · Test · Backtest · Results
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = ['Build', 'Test', 'Backtest', 'Results'];

export function StepIndicator({ current, onStep }: { current: number; onStep: (n: number) => void }) {
  return (
    <div className="steps">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <div key={label} className={`step ${active ? 'active' : ''} ${done ? 'done' : ''}`} onClick={() => onStep(n)} role="button">
            <span className="step__num">{done ? '✓' : n}</span>
            <span className="step__label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
