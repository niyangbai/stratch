// ─────────────────────────────────────────────────────────────────────────────
// Landing page — hero + how-it-works + CTA.
// ─────────────────────────────────────────────────────────────────────────────

import { Icon } from './Icon';
import { TopBar } from './TopBar';

const CARDS = [
  { n: '01', title: 'Snap blocks', text: 'Write a strategy by dragging logic, market and trade blocks — no code, no forms.' },
  { n: '02', title: 'Test it', text: 'STRATCH validates your blocks and reads the strategy back to you in plain English.' },
  { n: '03', title: 'Simulate & backtest', text: 'Backtest on real exchange history, or Monte-Carlo simulate it across many market paths.' },
];

export function Landing({ onStart, onHome }: { onStart: () => void; onHome: () => void }) {
  return (
    <div className="landing page-transition">
      <TopBar onHome={onHome} />

      <div className="landing__hero">
        <div className="landing__eyebrow">BUILD A TRADING BOT · BLOCK BY BLOCK</div>
        <h1 className="landing__title">
          Build a trading bot<br />
          <span className="accent">with blocks.</span>
        </h1>
        <p className="landing__sub">
          You're the quant. Snap blocks together, backtest on real exchange history or
          Monte-Carlo simulate thousands of markets. No code — just logic you can read.
        </p>
        <div className="landing__cta">
          <button className="btn btn--primary btn--big" onClick={onStart}>Start building <Icon name="arrowRight" size={16} /></button>
          <span className="landing__hint">free · runs in your browser · no signup</span>
        </div>
      </div>

      <div className="landing__cards">
        {CARDS.map((c) => (
          <div className="landing__card" key={c.n}>
            <div className="landing__card-n">{c.n}</div>
            <div className="landing__card-title">{c.title}</div>
            <div className="landing__card-text">{c.text}</div>
          </div>
        ))}
      </div>

      <div className="landing__footer">
        <span>Long-only · spot · single asset · bar-based</span>
        <span className="spacer" />
        <span>Built on Blockly</span>
      </div>
    </div>
  );
}
