// ─────────────────────────────────────────────────────────────────────────────
// Top bar — brand + scrolling market ticker + page-specific actions (children).
// ─────────────────────────────────────────────────────────────────────────────

import { Icon } from './Icon';

const TICKS: [string, number, number][] = [
  ['BTC/USDT', 43218.4, 1.24],
  ['ETH/USDT', 2417.9, -0.62],
  ['SOL/USDT', 112.3, 3.81],
  ['BNB/USDT', 318.5, 0.44],
  ['XRP/USDT', 0.512, -1.15],
  ['DOGE/USDT', 0.0812, 2.07],
  ['ADA/USDT', 0.384, -0.33],
  ['AVAX/USDT', 27.4, 1.92],
  ['LINK/USDT', 13.85, 0.71],
  ['DOT/USDT', 5.62, -2.4],
];

export function TopBar({ children }: { children?: React.ReactNode }) {
  const doubled = [...TICKS, ...TICKS];
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand__logo">S</div>
        <div>
          <div>STRATCH</div>
          <div className="brand__tag">BUILD · TEST · TRADE</div>
        </div>
      </div>
      <div className="ticker">
        <div className="ticker__track">
          {doubled.map((t, i) => (
            <div className="tick" key={i}>
              <span className="tick__pair">{t[0]}</span>
              <span className="tick__px">{t[1].toLocaleString('en-US', { maximumFractionDigits: 4 })}</span>
              <span className={`tick__chg ${t[2] >= 0 ? 'up' : 'down'}`}><Icon name={t[2] >= 0 ? 'arrowUp' : 'arrowDown'} size={11} /> {Math.abs(t[2]).toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </div>
      {children}
      <a className="gh-link" href="https://github.com/niyangbai/stratch" target="_blank" rel="noreferrer" title="View on GitHub"><Icon name="github" size={18} /></a>
    </div>
  );
}
