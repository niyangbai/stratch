// ─────────────────────────────────────────────────────────────────────────────
// Landing page — hero + how-it-works + CTA.
// ─────────────────────────────────────────────────────────────────────────────

import { Icon } from './Icon';

const CARDS = [
  { n: '01', title: 'Snap blocks', text: 'Write a strategy by dragging logic, market and trade blocks — no code, no forms.' },
  { n: '02', title: 'Test it', text: 'STRATCH validates your blocks and reads the strategy back to you in plain English.' },
  { n: '03', title: 'Backtest & score', text: 'Run it on crypto history, get a 0–100 score, and see exactly why it traded.' },
];

const TICKS: [string, number, number][] = [
  ['BTC/USDT', 43218.4, 1.24],
  ['ETH/USDT', 2417.9, -0.62],
  ['SOL/USDT', 112.3, 3.81],
  ['BNB/USDT', 318.5, 0.44],
  ['XRP/USDT', 0.512, -1.15],
  ['DOGE/USDT', 0.0812, 2.07],
];

export function Landing({ onStart }: { onStart: () => void }) {
  return (
    <div className="landing">
      <div className="landing__nav">
        <div className="brand">
          <div className="brand__logo">S</div>
          <div>
            <div>STRATCH</div>
            <div className="brand__tag">BUILD · TEST · TRADE</div>
          </div>
        </div>
        <div className="landing__nav-right">
          <a className="gh-link" href="https://github.com/niyangbai/stratch" target="_blank" rel="noreferrer" title="View on GitHub"><Icon name="github" size={18} /></a>
          <button className="btn btn--primary" onClick={onStart}>Start building</button>
        </div>
      </div>

      <div className="landing__hero">
        <div className="landing__eyebrow">SCRATCH-STYLE CRYPTO TRADING GAME</div>
        <h1 className="landing__title">
          Build a trading bot<br />
          <span className="accent">with blocks.</span>
        </h1>
        <p className="landing__sub">
          You're the quant. Snap blocks together to write a strategy, run it against real
          crypto history, and chase a 100 score. No code, no spreadsheets — just logic.
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

      <div className="landing__ticker">
        <div className="ticker">
          <div className="ticker__track">
            {[...TICKS, ...TICKS].map((t, i) => (
              <div className="tick" key={i}>
                <span className="tick__pair">{t[0]}</span>
                <span className="tick__px">{t[1].toLocaleString('en-US', { maximumFractionDigits: 4 })}</span>
                <span className={`tick__chg ${t[2] >= 0 ? 'up' : 'down'}`}><Icon name={t[2] >= 0 ? 'arrowUp' : 'arrowDown'} size={11} /> {Math.abs(t[2]).toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="landing__footer">
        <span>Long-only · spot · single asset · bar-based</span>
        <span className="spacer" />
        <span>Built on Blockly</span>
      </div>
    </div>
  );
}
