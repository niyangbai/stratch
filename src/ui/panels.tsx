// ─────────────────────────────────────────────────────────────────────────────
// Side-panel tab content — Build / Test / Backtest / Results / Export.
// ─────────────────────────────────────────────────────────────────────────────

import type { VarDef } from '../ir';
import type { BacktestResult, BacktestConfig, Attribution } from '../engine/run';
import type { Issue } from '../engine/tools';
import { PriceChart, EquityChart } from './Charts';
import { Icon } from './Icon';

export const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
export const money = (v: number) =>
  Math.abs(v) >= 1e6 ? v.toExponential(2) : v.toLocaleString('en-US', { maximumFractionDigits: 2 });
const sign = (v: number) => (v >= 0 ? 'pos' : 'neg');

// ── Build ────────────────────────────────────────────────────────────────────

export function BuildPanel(props: {
  vars: VarDef[];
  blockCount: number;
  onMakeVar: () => void;
  onRenameVar: (id: string, name: string) => void;
  onDeleteVar: (id: string) => void;
  onLoadJson: (file: File) => void;
}) {
  return (
    <div>
      <div className="card">
        <div className="card__title">Strategy</div>
        <div className="metric">
          <div className="metric__label">Blocks</div>
          <div className="metric__value">{props.blockCount}</div>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          SETUP defines variables and <span className="up">functions</span>; ON EVERY BAR is the main loop.
          Define a function with the <span className="up">define</span> block (My Blocks → Make a Block).
        </p>
      </div>

      <div className="card">
        <div className="card__title">Variables</div>
        {props.vars.length === 0 && <div className="empty-note">No variables yet.</div>}
        {props.vars.map((v) => (
          <div key={v.id} className="var-row">
            <span className="mono">{v.name}</span>
            <span className="var-actions">
              <button
                className="mini"
                onClick={() => {
                  const name = prompt('Rename variable', v.name);
                  if (name) props.onRenameVar(v.id, name);
                }}
              >
                <Icon name="pencil" size={12} />
              </button>
              <button className="mini danger" onClick={() => props.onDeleteVar(v.id)}>
                <Icon name="x" size={12} />
              </button>
            </span>
          </div>
        ))}
        <button className="palette__make" onClick={props.onMakeVar}>
          + Make a Variable
        </button>
      </div>

      <div className="card">
        <div className="card__title">Save / Load</div>
        <p className="hint" style={{ marginBottom: 10 }}>Load a strategy you exported as JSON to restore it.</p>
        <label className="btn" style={{ width: '100%', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="upload" size={14} /> Load strategy (.json)
          <input
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) props.onLoadJson(f); e.target.value = ''; }}
          />
        </label>
      </div>
    </div>
  );
}

// ── Test ─────────────────────────────────────────────────────────────────────

export function TestPanel(props: {
  issues: Issue[] | null;
  explanation: string | null;
  onTest: () => void;
  onHighlight: (blockId: string) => void;
}) {
  const errors = (props.issues ?? []).filter((i) => i.severity === 'error');
  const warnings = (props.issues ?? []).filter((i) => i.severity === 'warning');
  return (
    <div>
      <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center', height: 38, marginBottom: 14 }} onClick={props.onTest}>
        <Icon name="zap" size={14} /> Test My Strategy
      </button>

      {props.issues === null && <p className="hint">Run the test to validate the blocks and read an English explanation.</p>}

      {props.issues !== null && (
        <div className="card">
          <div className="card__title">
            Validate — {errors.length} error{errors.length === 1 ? '' : 's'}, {warnings.length} warning{warnings.length === 1 ? '' : 's'}
          </div>
          {props.issues.length === 0 && <div className="empty-note" style={{ color: '#00e6a8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="check" size={14} /> All checks passed.</div>}
          {props.issues.map((iss, i) => (
            <div key={i} className={`issue issue--${iss.severity}`}>
              <div className="issue__icon">{iss.severity === 'error' ? '!' : '!'}</div>
              <div style={{ flex: 1 }}>
                <div>{iss.message}</div>
                {iss.blockId && (
                  <button className="link" onClick={() => props.onHighlight(iss.blockId!)}>
                    highlight block <Icon name="arrowRight" size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {props.explanation !== null && (
        <div className="card">
          <div className="card__title">Explain</div>
          <div className="explain-box">{props.explanation}</div>
        </div>
      )}
    </div>
  );
}

// ── Backtest ─────────────────────────────────────────────────────────────────

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];
const LOOKBACKS = [
  { label: '~2 weeks', bars: 200 },
  { label: '~1 month', bars: 500 },
  { label: '~3 months', bars: 1000 },
  { label: '~1 year', bars: 2000 },
];

export function BacktestPanel(props: {
  config: BacktestConfig;
  setConfig: (c: BacktestConfig) => void;
  onRun: () => void;
  running: boolean;
}) {
  const c = props.config;
  const set = (patch: Partial<BacktestConfig>) => props.setConfig({ ...c, ...patch });
  const field = (label: string, node: React.ReactNode) => (
    <div className="field-row">
      <label>{label}</label>
      {node}
    </div>
  );
  return (
    <div>
      <div className="card">
        <div className="card__title">Backtest environment</div>
        <p className="hint" style={{ marginBottom: 10 }}>These are runtime settings — they are not part of the strategy.</p>
        {field('Crypto pair', (
          <select value={c.pair} onChange={(e) => set({ pair: e.target.value })}>
            {PAIRS.map((p) => <option key={p}>{p}</option>)}
          </select>
        ))}
        {field('Timeframe', (
          <select value={c.timeframe} onChange={(e) => set({ timeframe: e.target.value })}>
            {TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}
          </select>
        ))}
        {field('Date range (lookback)', (
          <select value={c.bars} onChange={(e) => set({ bars: Number(e.target.value) })}>
            {LOOKBACKS.map((l) => <option key={l.bars} value={l.bars}>{l.label} · {l.bars} bars</option>)}
          </select>
        ))}
        {field('Data source', (
          <select value={c.source} onChange={(e) => set({ source: e.target.value as any })}>
            <option value="synthetic">Synthetic (deterministic)</option>
            <option value="binance">Binance (live OHLCV)</option>
          </select>
        ))}
        <div className="grid2">
          {field('Starting cash', <input type="number" value={c.startCash} onChange={(e) => set({ startCash: Number(e.target.value) })} />)}
          {field('Seed', <input type="number" value={c.seed} onChange={(e) => set({ seed: Number(e.target.value) })} />)}
          {field('Fee (bps)', <input type="number" value={c.feeBps} onChange={(e) => set({ feeBps: Number(e.target.value) })} />)}
          {field('Slippage (bps)', <input type="number" value={c.slippageBps} onChange={(e) => set({ slippageBps: Number(e.target.value) })} />)}
        </div>
      </div>
      <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center', height: 38 }} onClick={props.onRun} disabled={props.running}>
        {props.running ? 'Running…' : <><Icon name="play" size={14} /> Run Backtest</>}
      </button>
    </div>
  );
}

// ── Results ──────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const cx = 37, cy = 37, r = 25;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - score / 100);
  const color = score >= 70 ? '#00ff9c' : score >= 45 ? '#35d6e8' : '#ffb454';
  // gauge ticks around the ring
  const ticks = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 - Math.PI / 2;
    const major = i % 9 === 0;
    const len = major ? 5 : 2.5;
    const r1 = r + 5, r2 = r + 5 + len;
    ticks.push(
      <line
        key={i}
        x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1}
        x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2}
        stroke={major ? 'rgba(148,186,231,0.5)' : 'rgba(148,186,231,0.22)'}
        strokeWidth={major ? 1.6 : 1}
      />,
    );
  }
  return (
    <div className="score__ring">
      <svg width={84} height={84} viewBox="0 0 74 74">
        {ticks}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={off}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div className="val">{score}</div>
        <div className="lbl">/ 100</div>
      </div>
    </div>
  );
}

export function ResultsPanel(props: {
  result: BacktestResult | null;
  attribution: Attribution[] | null;
  startCash: number;
  expandedTrade: string | null;
  setExpandedTrade: (id: string | null) => void;
}) {
  const r = props.result;
  if (!r) return <p className="hint">Run a backtest to see results, charts, score and attribution.</p>;
  const m = r.metrics;
  const rows: [string, string, string][] = [
    ['Total Return', pct(m.totalReturn), sign(m.totalReturn)],
    ['Buy & Hold', pct(m.buyHold), sign(m.buyHold)],
    ['Max Drawdown', pct(m.maxDrawdown), 'neg'],
    ['Sharpe Ratio', m.sharpe.toFixed(2), sign(m.sharpe)],
    ['Win Rate', m.winRate == null ? '—' : pct(m.winRate), m.winRate == null ? 'neg' : sign(m.winRate)],
    ['Profit Factor', m.profitFactor == null ? '—' : Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : '∞', 'pos'],
    ['Trades', String(m.trades), ''],
    ['Final Value', money(m.finalValue), sign(m.totalReturn)],
  ];
  return (
    <div>
      <div className="score">
        <ScoreRing score={r.score.total} />
        <div className="score__bars">
          {r.score.breakdown.map((b) => (
            <div className="score__bar-row" key={b.label} title={b.detail}>
              <span className="score__bar-label">{b.label}</span>
              <span className="score__bar-track">
                <span className="score__bar-fill" style={{ width: `${(b.points / b.max) * 100}%` }} />
              </span>
              <span className="mono muted">{Math.round(b.points)}/{b.max}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card__title">Metrics</div>
        <div className="grid2">
          {rows.map(([l, v, cls]) => (
            <div className="metric" key={l}>
              <div className="metric__label">{l}</div>
              <div className={`metric__value ${cls}`}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <PriceChart bars={r.bars} trades={r.trades} />
      <EquityChart equity={r.equity} startCash={props.startCash} />

      <div className="card">
        <div className="card__title">Trade history · tap a trade for “why?”</div>
        {r.trades.length === 0 && <div className="empty-note">No trades were made.</div>}
        {r.trades.slice(-40).reverse().map((t, i) => {
          const key = `${t.bar}-${i}`;
          const open = props.expandedTrade === key;
          return (
            <div key={key} style={{ marginBottom: 4 }}>
              <div className="trade-row" onClick={() => props.setExpandedTrade(open ? null : key)} style={{ cursor: 'pointer' }}>
                <span className={`side ${t.side === 'BUY' ? 'buy' : 'sell'}`}>{t.side}</span>
                <span className="qty">{t.qty.toFixed(6)} @ {money(t.price)}</span>
                {t.pnl != null && <span className={`pnl ${t.pnl >= 0 ? 'pos' : 'neg'}`}>{t.pnl >= 0 ? '+' : ''}{money(t.pnl)}</span>}
                <span className="mono muted" style={{ fontSize: 9 }}>bar {t.bar}</span>
              </div>
              {open && t.reason && (
                <div className="trade-reason">
                  <div className="mono" style={{ color: '#cfe0f2' }}>{t.reason.text}</div>
                  {t.reason.leaves.map((l, j) => (
                    <div key={j} className="mono" style={{ fontSize: 11, color: l.result ? '#00e6a8' : '#ff4d5e' }}>
                      {l.label}: {money(l.a)} {l.op} {money(l.b)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {props.attribution && props.attribution.length > 0 && (
        <div className="card">
          <div className="card__title">What mattered?</div>
          <p className="hint" style={{ marginBottom: 10 }}>Impact of flipping each condition off, measured on final portfolio value.</p>
          {props.attribution.map((a) => {
            const mag = Math.min(1, Math.abs(a.impact) / 0.5);
            const col = a.impact > 0 ? '#ff4d5e' : '#00e6a8';
            return (
              <div className="attribution-row" key={a.conditionId}>
                <div className="txt">{a.text}</div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${mag * 100}%`, background: col }} /></div>
                <div className="meta">{a.impact >= 0 ? '+' : ''}{(a.impact * 100).toFixed(2)}% · fired {a.fires}×</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────

export function ExportPanel(props: { natural: string; js: string; json: string }) {
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => alert('Copied to clipboard'));
  };
  const download = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div>
      <div className="card">
        <div className="card__title" style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: 1 }}>Strategy JSON</span>
          <button className="btn" onClick={() => copy(props.json)}>Copy</button>
          <button className="btn btn--primary" onClick={() => download(props.json, 'stratch-strategy.json')}><Icon name="download" size={14} /> Download</button>
        </div>
        <p className="hint" style={{ marginBottom: 8 }}>Save your strategy as a file, then load it back from the Build tab.</p>
        <pre className="code" style={{ maxHeight: 220 }}>{props.json}</pre>
      </div>
      <div className="card">
        <div className="card__title" style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: 1 }}>Natural language</span>
          <button className="btn" onClick={() => copy(props.natural)}>Copy</button>
        </div>
        <div className="explain-box" style={{ maxHeight: 240, overflow: 'auto' }}>{props.natural}</div>
      </div>
      <div className="card">
        <div className="card__title" style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: 1 }}>JavaScript</span>
          <button className="btn" onClick={() => copy(props.js)}>Copy</button>
        </div>
        <pre className="code">{props.js}</pre>
      </div>
    </div>
  );
}
