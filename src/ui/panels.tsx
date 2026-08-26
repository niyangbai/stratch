// ─────────────────────────────────────────────────────────────────────────────
// Side-panel tab content — Build / Test / Simulate-Backtest / Results / Export.
// ─────────────────────────────────────────────────────────────────────────────

import type { VarDef } from '../ir';
import type { BacktestResult, Attribution } from '../engine/run';
import type { Issue } from '../engine/tools';
import type { BacktestSpec, SimulateSpec, SimulateResult } from '../engine/compute';
import type { DataSource } from '../engine/data';
import type { ModelId } from '@stratch/market-sim';
import { PriceChart, EquityChart, MonteCarloChart } from './Charts';
import { Icon } from './Icon';

export const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
export const money = (v: number) =>
  Math.abs(v) >= 1e6 ? v.toExponential(2) : v.toLocaleString('en-US', { maximumFractionDigits: 2 });
const sign = (v: number) => (v >= 0 ? 'pos' : 'neg');

type BacktestCfg = Omit<BacktestSpec, 'mode'>;
type SimulateCfg = Omit<SimulateSpec, 'mode'>;

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

      {props.issues === null && <p className="hint">Run the test to validate the blocks.</p>}

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

    </div>
  );
}

// ── Simulate / Backtest ──────────────────────────────────────────────────────

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];
const LOOKBACKS = [
  { label: '~2 weeks', bars: 200 },
  { label: '~1 month', bars: 500 },
  { label: '~3 months', bars: 1000 },
  { label: '~1 year', bars: 2000 },
];
const MODELS: { id: ModelId; label: string }[] = [
  { id: 'gbm', label: 'GBM (Gaussian)' },
  { id: 'fatgbm', label: 'Fat-tailed GBM (Student-t)' },
  { id: 'heston', label: 'Heston (stoch. vol)' },
];
const BASE_PRICE: Record<string, number> = { 'BTC/USDT': 42000, 'ETH/USDT': 2400, 'SOL/USDT': 110 };
const DEFAULT_SIGMA: Record<string, number> = { 'BTC/USDT': 0.55, 'ETH/USDT': 0.65, 'SOL/USDT': 0.8 };
const DATA_SOURCES: { id: DataSource; label: string }[] = [
  { id: 'binance', label: 'Binance' },
  { id: 'coinbase', label: 'Coinbase' },
];

function field(label: string, node: React.ReactNode) {
  return (
    <div className="field-row">
      <label>{label}</label>
      {node}
    </div>
  );
}

function numInput(value: number, onChange: (v: number) => void, step = 0.01) {
  return <input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />;
}

export function RunPanel(props: {
  mode: 'backtest' | 'simulate';
  setMode: (m: 'backtest' | 'simulate') => void;
  backtestCfg: BacktestCfg;
  setBacktestCfg: (c: BacktestCfg) => void;
  simulateCfg: SimulateCfg;
  setSimulateCfg: (c: SimulateCfg) => void;
  onRun: () => void;
  running: boolean;
}) {
  const runLabel = props.mode === 'simulate' ? 'Run Simulation' : 'Run Backtest';
  return (
    <div>
      <div className="card">
        <div className="card__title">Simulate / Backtest</div>
        <div className="mode-toggle">
          <button className={`mode-toggle__btn ${props.mode === 'backtest' ? 'active' : ''}`} onClick={() => props.setMode('backtest')}>
            Backtest <span className="mode-toggle__sub">Live data</span>
          </button>
          <button className={`mode-toggle__btn ${props.mode === 'simulate' ? 'active' : ''}`} onClick={() => props.setMode('simulate')}>
            Simulate <span className="mode-toggle__sub">Monte Carlo</span>
          </button>
        </div>
      </div>

      {props.mode === 'backtest'
        ? <BacktestFields cfg={props.backtestCfg} set={props.setBacktestCfg} />
        : <SimulateFields cfg={props.simulateCfg} set={props.setSimulateCfg} />}

      <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center', height: 38 }} onClick={props.onRun} disabled={props.running}>
        {props.running ? 'Running…' : <><Icon name="play" size={14} /> {runLabel}</>}
      </button>
    </div>
  );
}

function BacktestFields({ cfg, set }: { cfg: BacktestCfg; set: (c: BacktestCfg) => void }) {
  const patch = (p: Partial<BacktestCfg>) => set({ ...cfg, ...p });
  return (
    <div className="card">
      <div className="card__title">Backtest · live data</div>
      <p className="hint" style={{ marginBottom: 10 }}>Run your strategy once on real exchange history.</p>
      {field('Data source', (
        <select value={cfg.source} onChange={(e) => patch({ source: e.target.value as DataSource })}>
          {DATA_SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      ))}
      {field('Crypto pair', (
        <select value={cfg.pair} onChange={(e) => patch({ pair: e.target.value })}>
          {PAIRS.map((p) => <option key={p}>{p}</option>)}
        </select>
      ))}
      {field('Timeframe', (
        <select value={cfg.timeframe} onChange={(e) => patch({ timeframe: e.target.value })}>
          {TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}
        </select>
      ))}
      {field('Date range (lookback)', (
        <select value={cfg.bars} onChange={(e) => patch({ bars: Number(e.target.value) })}>
          {LOOKBACKS.map((l) => <option key={l.bars} value={l.bars}>{l.label} · {l.bars} bars</option>)}
        </select>
      ))}
      {field('Starting cash', <input type="number" value={cfg.startCash} onChange={(e) => patch({ startCash: Number(e.target.value) })} />)}
      {field('Fee (bps)', <input type="number" value={cfg.feeBps} onChange={(e) => patch({ feeBps: Number(e.target.value) })} />)}
      {field('Slippage (bps)', <input type="number" value={cfg.slippageBps} onChange={(e) => patch({ slippageBps: Number(e.target.value) })} />)}
    </div>
  );
}

function SimulateFields({ cfg, set }: { cfg: SimulateCfg; set: (c: SimulateCfg) => void }) {
  const patch = (p: Partial<SimulateCfg>) => set({ ...cfg, ...p });
  return (
    <div className="card">
      <div className="card__title">Simulate · Monte Carlo</div>
      <p className="hint" style={{ marginBottom: 10 }}>Run the strategy over many simulated markets and read the outcome distribution.</p>

      {field('Crypto pair', (
        <select value={cfg.pair} onChange={(e) => patch({ pair: e.target.value, s0: BASE_PRICE[e.target.value] ?? cfg.s0, sigma: DEFAULT_SIGMA[e.target.value] ?? cfg.sigma })}>
          {PAIRS.map((p) => <option key={p}>{p}</option>)}
        </select>
      ))}
      {field('Model', (
        <select value={cfg.model} onChange={(e) => patch({ model: e.target.value as ModelId })}>
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      ))}

      {field('Initial price S₀', numInput(cfg.s0, (v) => patch({ s0: v })))}
      {field('Drift μ (annual)', numInput(cfg.mu, (v) => patch({ mu: v })))}
      {cfg.model === 'gbm' && field('Volatility σ (annual)', numInput(cfg.sigma, (v) => patch({ sigma: v })))}
      {cfg.model === 'fatgbm' && (
        <>
          {field('Volatility σ (annual)', numInput(cfg.sigma, (v) => patch({ sigma: v })))}
          {field('Tail ν (lower = fatter)', numInput(cfg.nu, (v) => patch({ nu: v }), 0.5))}
        </>
      )}
      {cfg.model === 'heston' && (
        <>
          {field('Initial variance v₀', numInput(cfg.v0, (v) => patch({ v0: v })))}
          {field('Long-run variance θ', numInput(cfg.theta, (v) => patch({ theta: v })))}
          {field('Mean reversion κ', numInput(cfg.kappa, (v) => patch({ kappa: v }), 0.1))}
          {field('Vol of vol ξ', numInput(cfg.xi, (v) => patch({ xi: v })))}
          {field('Correlation ρ', numInput(cfg.rho, (v) => patch({ rho: v }), 0.05))}
        </>
      )}

      {field('Timeframe (dt)', (
        <select value={cfg.timeframe} onChange={(e) => patch({ timeframe: e.target.value })}>
          {TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}
        </select>
      ))}
      {field('Horizon', (
        <select value={cfg.bars} onChange={(e) => patch({ bars: Number(e.target.value) })}>
          {LOOKBACKS.map((l) => <option key={l.bars} value={l.bars}>{l.label} · {l.bars} bars</option>)}
        </select>
      ))}
      {field('Paths', <input type="number" value={cfg.paths} onChange={(e) => patch({ paths: Number(e.target.value) })} />)}
      {field('Seed', <input type="number" value={cfg.seed} onChange={(e) => patch({ seed: Number(e.target.value) })} />)}
      {field('Starting cash', <input type="number" value={cfg.startCash} onChange={(e) => patch({ startCash: Number(e.target.value) })} />)}
      {field('Fee (bps)', <input type="number" value={cfg.feeBps} onChange={(e) => patch({ feeBps: Number(e.target.value) })} />)}
      {field('Slippage (bps)', <input type="number" value={cfg.slippageBps} onChange={(e) => patch({ slippageBps: Number(e.target.value) })} />)}
    </div>
  );
}

// ── Results ──────────────────────────────────────────────────────────────────

export function ResultsPanel(props: {
  mode: 'backtest' | 'simulate';
  result: BacktestResult | null;
  attribution: Attribution[] | null;
  mc: SimulateResult | null;
  startCash: number;
  expandedTrade: string | null;
  setExpandedTrade: (id: string | null) => void;
}) {
  if (props.mode === 'simulate') {
    return <SimulateResults mc={props.mc} startCash={props.startCash} />;
  }
  return (
    <BacktestResults
      result={props.result}
      attribution={props.attribution}
      startCash={props.startCash}
      expandedTrade={props.expandedTrade}
      setExpandedTrade={props.setExpandedTrade}
    />
  );
}

function BacktestResults(props: {
  result: BacktestResult | null;
  attribution: Attribution[] | null;
  startCash: number;
  expandedTrade: string | null;
  setExpandedTrade: (id: string | null) => void;
}) {
  const r = props.result;
  if (!r) return <p className="hint">Run a backtest to see results, charts and attribution.</p>;
  const m = r.metrics;
  const rows: [string, string, string][] = [
    ['Total Return', pct(m.totalReturn), sign(m.totalReturn)],
    ['CAGR', pct(m.cagr), sign(m.cagr)],
    ['Final Value', money(m.finalValue), sign(m.totalReturn)],
    ['Buy & Hold', pct(m.buyHold), sign(m.buyHold)],
    ['Ann. Volatility', pct(m.annVol), ''],
    ['Max Drawdown', pct(m.maxDrawdown), 'neg'],
    ['Sharpe Ratio', m.sharpe.toFixed(2), sign(m.sharpe)],
    ['Sortino Ratio', m.sortino.toFixed(2), sign(m.sortino)],
    ['Calmar Ratio', m.calmar.toFixed(2), sign(m.calmar)],
    ['Win Rate', m.winRate == null ? '—' : pct(m.winRate), m.winRate == null ? 'neg' : sign(m.winRate)],
    ['Profit Factor', m.profitFactor == null ? '—' : Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : '∞', 'pos'],
    ['Trades', String(m.trades), ''],
  ];
  const vs = m.totalReturn - m.buyHold;
  return (
    <div>
      <div className="kpi-hero">
        <div className="kpi-hero__main">
          <div className="kpi-hero__label">Total Return</div>
          <div className={`kpi-hero__value ${sign(m.totalReturn)}`}>{pct(m.totalReturn)}</div>
        </div>
        <div className="kpi-hero__side">
          <div><span className="muted">Final</span> <span className="mono">{money(m.finalValue)}</span></div>
          <div><span className="muted">vs B&amp;H</span> <span className={`mono ${sign(vs)}`}>{vs >= 0 ? '+' : ''}{pct(vs)}</span></div>
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

function SimulateResults({ mc, startCash }: { mc: SimulateResult | null; startCash: number }) {
  if (!mc) return <p className="hint">Run a simulation to see the Monte-Carlo distribution.</p>;
  const fr = mc.finalReturn;
  const modelLabel = MODELS.find((m) => m.id === mc.model)?.label ?? mc.model;
  const rows: [string, string, string][] = [
    ['Median Return', pct(fr.median), sign(fr.median)],
    ['Mean Return', pct(fr.mean), sign(fr.mean)],
    ['5th percentile', pct(fr.p05), sign(fr.p05)],
    ['95th percentile', pct(fr.p95), sign(fr.p95)],
    ['Positive paths', pct(fr.positiveRate), sign(fr.positiveRate)],
    ['Paths', String(mc.paths), ''],
  ];
  return (
    <div>
      <div className="card">
        <div className="card__title">Monte-Carlo distribution · {modelLabel}</div>
        <div className="grid2">
          {rows.map(([l, v, cls]) => (
            <div className="metric" key={l}>
              <div className="metric__label">{l}</div>
              <div className={`metric__value ${cls}`}>{v}</div>
            </div>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          {mc.paths} simulated paths · shaded bands are the 5–95% and 25–75% equity range; solid lines mark the 25/50/75 percentiles; faint lines are individual paths.
        </p>
      </div>
      <MonteCarloChart equityQuantiles={mc.equityQuantiles} sampleEquity={mc.sampleEquity} startCash={startCash} />
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
