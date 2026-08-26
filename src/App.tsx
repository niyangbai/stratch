// ─────────────────────────────────────────────────────────────────────────────
// Stratch — top-level app shell.
//   landing  ->  Build & Test (page 1)  ->  Simulate / Backtest (page 2)
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useRef, useState } from 'react';
import { StrategyEditor, type StrategyEditorHandle } from './blockly/StrategyEditor';
import { useEditorState, addVar, renameVar, deleteVar, importState, exportStateJson } from './store';
import type { BacktestResult, Attribution } from './engine/run';
import { computeRun, type RunSpec, type BacktestSpec, type SimulateSpec, type RunOutput, type SimulateResult } from './engine/compute';
import { validate, exportJs, exportNatural, type Issue } from './engine/tools';
import { TopBar } from './ui/TopBar';
import { StepIndicator } from './ui/StepIndicator';
import { Icon } from './ui/Icon';
import { Landing } from './ui/Landing';
import { BuildPanel, TestPanel, RunPanel, ResultsPanel, ExportPanel } from './ui/panels';
import { MakeVarModal } from './ui/Modals';

type Page = 'landing' | 'build' | 'backtest';
type BuildTab = 'build' | 'test' | 'export';
type RunMode = 'backtest' | 'simulate';
type ModalState = { type: 'var' } | null;

type BacktestCfg = Omit<BacktestSpec, 'mode'>;
type SimulateCfg = Omit<SimulateSpec, 'mode'>;

const DEFAULT_BACKTEST: BacktestCfg = {
  source: 'binance',
  pair: 'BTC/USDT',
  timeframe: '1d',
  bars: 500,
  startCash: 10000,
  feeBps: 10,
  slippageBps: 5,
};

const DEFAULT_SIMULATE: SimulateCfg = {
  pair: 'BTC/USDT',
  model: 'gbm',
  s0: 42000,
  mu: 0.1,
  sigma: 0.55,
  nu: 4,
  v0: 0.09,
  theta: 0.09,
  kappa: 2,
  xi: 0.3,
  rho: -0.7,
  timeframe: '1d',
  bars: 500,
  paths: 150,
  seed: 42,
  startCash: 10000,
  feeBps: 10,
  slippageBps: 5,
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function App() {
  const state = useEditorState();
  const editorRef = useRef<StrategyEditorHandle>(null);
  const workerRef = useRef<Worker | null>(null);

  const [page, setPage] = useState<Page>('landing');
  const [buildTab, setBuildTab] = useState<BuildTab>('build');
  const [mode, setMode] = useState<RunMode>('backtest');
  const [backtestCfg, setBacktestCfg] = useState<BacktestCfg>(DEFAULT_BACKTEST);
  const [simulateCfg, setSimulateCfg] = useState<SimulateCfg>(DEFAULT_SIMULATE);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [attribution, setAttribution] = useState<Attribution[] | null>(null);
  const [mc, setMc] = useState<SimulateResult | null>(null);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [running, setRunning] = useState(false);
  const [btError, setBtError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [sideWidth, setSideWidth] = useState(380);

  const strategy = state.strategy;
  const blockCount = Object.keys(strategy.blocks).length;
  const natural = useMemo(() => exportNatural(strategy), [strategy]);
  const js = useMemo(() => exportJs(strategy), [strategy]);
  const strategyJson = useMemo(() => exportStateJson(), [state]);

  function onSideDown(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sideWidth;
    const onMove = (ev: PointerEvent) => {
      setSideWidth(Math.min(720, Math.max(280, startW - (ev.clientX - startX))));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!importState(data)) throw new Error('invalid strategy payload');
        editorRef.current?.loadJson(data.setupJson ?? null, data.onBarJson ?? null);
      } catch (err) {
        alert('Could not load strategy: ' + (err instanceof Error ? err.message : 'invalid file'));
      }
    };
    reader.readAsText(file);
  }

  const currentStep = page === 'backtest' ? 2 : 1;

  function gotoStep(n: number) {
    setPage(n === 1 ? 'build' : 'backtest');
  }

  function highlightIssues(list: Issue[]) {
    editorRef.current?.clearHighlights();
    for (const iss of list) {
      if (iss.blockId) editorRef.current?.highlightBlock(iss.blockId, iss.message);
    }
  }

  function runTest() {
    const list = validate(strategy);
    setIssues(list);
    setPage('build');
    setBuildTab('test');
    highlightIssues(list);
  }

  function getWorker(): Worker {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('./engine/worker.ts', import.meta.url), { type: 'module' });
    }
    return workerRef.current;
  }

  function runInWorker(spec: RunSpec): Promise<RunOutput> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const worker = getWorker();
      const timer = setTimeout(() => {
        if (!settled) { settled = true; reject(new Error('worker timeout')); }
      }, 60_000);
      worker.onmessage = (e: MessageEvent<{ ok: boolean } & Partial<RunOutput> & { error?: string }>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (e.data.ok && e.data.kind) resolve(e.data as RunOutput);
        else reject(new Error(e.data.error ?? 'worker returned no result'));
      };
      worker.onerror = (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(e.message || 'worker failed to load'));
      };
      try {
        worker.postMessage({ strategy, spec });
      } catch (err) {
        if (!settled) { settled = true; clearTimeout(timer); reject(err instanceof Error ? err : new Error(String(err))); }
      }
    });
  }

  function runNow() {
    setRunning(true);
    setBtError(null);

    const spec: RunSpec = mode === 'simulate'
      ? { mode: 'simulate', ...simulateCfg }
      : { mode: 'backtest', ...backtestCfg };

    // Yield so the "Running…" state paints first.
    new Promise((r) => setTimeout(r, 30))
      .then(() => runInWorker(spec).catch(() => computeRun(strategy, spec))) // worker first, sync fallback
      .then((out) => {
        if (out.kind === 'simulate') {
          setMc(out.mc);
          setResult(null);
          setAttribution(null);
        } else {
          setResult(out.result);
          setAttribution(out.attribution);
          setMc(null);
        }
        setPage('backtest');
      })
      .catch((err) => {
        console.error('[run] failed:', err);
        setBtError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setRunning(false));
  }

  if (page === 'landing') {
    return <Landing onStart={() => setPage('build')} onHome={() => setPage('landing')} />;
  }

  const statusBar = (
    <div className="statusbar">
      <span className="dot" />
      <span>{blockCount} blocks</span>
      <span className="spacer" />
      {mode === 'simulate'
        ? <span>{simulateCfg.pair} · {simulateCfg.model} · {simulateCfg.bars} bars · {simulateCfg.paths} paths</span>
        : <span>{backtestCfg.pair} · {backtestCfg.timeframe} · {backtestCfg.bars} bars · {cap(backtestCfg.source)}</span>}
    </div>
  );

  const modals = (
    <>
      {modal?.type === 'var' && <MakeVarModal onClose={() => setModal(null)} onConfirm={(n) => addVar(n)} />}
    </>
  );

  return (
    <div className="app">
      <div className="page-transition" key={page}>
      {page === 'build' ? (
        <>
          <TopBar onHome={() => setPage('landing')}>
            <StepIndicator current={currentStep} onStep={gotoStep} />
            <button className="btn btn--primary" onClick={() => setPage('backtest')}>Run <Icon name="arrowRight" size={14} /></button>
          </TopBar>

          <div className="main">
            <div className="workspace-wrap">
              <div className="ws-toolbar">
                <button className="iconbtn" title="Undo (Ctrl+Z)" onClick={() => editorRef.current?.undo()}><Icon name="undo" size={15} /></button>
                <button className="iconbtn" title="Redo (Ctrl+Shift+Z)" onClick={() => editorRef.current?.redo()}><Icon name="redo" size={15} /></button>
                <span className="divider" />
                <button className="iconbtn" title="Load example" onClick={() => editorRef.current?.loadExample()}><Icon name="zap" size={15} /></button>
                <button className="iconbtn" title="Clear all" onClick={() => editorRef.current?.clearAll()}><Icon name="trash" size={15} /></button>
                <span className="spacer" />
                <span className="mono muted" style={{ fontSize: 10 }}>drag from the toolbox · right-click a block for menu</span>
              </div>
              <div className="canvas">
                <div className="canvas-inner">
                  <StrategyEditor
                    ref={editorRef}
                    onMakeVar={() => setModal({ type: 'var' })}
                  />
                </div>
              </div>
            </div>

            <div className="resizer resizer--v" onPointerDown={onSideDown} />

            <div className="side" style={{ width: sideWidth }}>
              <div className="side__tabs">
                <div className={`side__tab ${buildTab === 'build' ? 'active' : ''}`} onClick={() => setBuildTab('build')}>Build</div>
                <div className={`side__tab ${buildTab === 'test' ? 'active' : ''}`} onClick={() => setBuildTab('test')}>Test</div>
                <div className={`side__tab ${buildTab === 'export' ? 'active' : ''}`} onClick={() => setBuildTab('export')}>Export</div>
              </div>
              <div className="side__body">
                {buildTab === 'build' && (
                  <BuildPanel
                    vars={state.vars}
                    blockCount={blockCount}
                    onMakeVar={() => setModal({ type: 'var' })}
                    onRenameVar={renameVar}
                    onDeleteVar={deleteVar}
                    onLoadJson={handleImportFile}
                  />
                )}
                {buildTab === 'test' && (
                  <TestPanel issues={issues} onTest={runTest} onHighlight={(id) => editorRef.current?.highlightBlock(id)} />
                )}
                {buildTab === 'export' && <ExportPanel natural={natural} js={js} json={strategyJson} />}
              </div>
            </div>
          </div>

          {statusBar}
        </>
      ) : (
        <>
          <TopBar onHome={() => setPage('landing')}>
            <StepIndicator current={currentStep} onStep={gotoStep} />
            <button className="btn" onClick={() => setPage('build')}><Icon name="arrowLeft" size={14} /> Edit strategy</button>
          </TopBar>

          <div className="main">
            <div className="backtest-left">
              <RunPanel
                mode={mode}
                setMode={setMode}
                backtestCfg={backtestCfg}
                setBacktestCfg={setBacktestCfg}
                simulateCfg={simulateCfg}
                setSimulateCfg={setSimulateCfg}
                onRun={runNow}
                running={running}
              />
            </div>
            <div className="results-right">
              {btError && (
                <div className="card issue issue--error" style={{ maxWidth: 640 }}>
                  <div className="issue__icon">!</div>
                  <div>
                    <div>Run failed</div>
                    <div className="mono" style={{ fontSize: 12, marginTop: 4 }}>{btError}</div>
                    <div className="hint" style={{ marginTop: 6 }}>Open the browser console for details, or go back and fix the blocks.</div>
                  </div>
                </div>
              )}
              <ResultsPanel
                mode={mode}
                result={result}
                attribution={attribution}
                mc={mc}
                startCash={mode === 'simulate' ? simulateCfg.startCash : backtestCfg.startCash}
                expandedTrade={expandedTrade}
                setExpandedTrade={setExpandedTrade}
              />
            </div>
          </div>

          {statusBar}
        </>
      )}
      </div>

      {modals}
    </div>
  );
}
