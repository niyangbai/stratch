// ─────────────────────────────────────────────────────────────────────────────
// Stratch — top-level app shell.
//   landing  ->  Build & Test (page 1)  ->  Backtest & Results (page 2)
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useRef, useState } from 'react';
import { StrategyEditor, type StrategyEditorHandle } from './blockly/StrategyEditor';
import { useEditorState, addVar, renameVar, deleteVar, addFunction, deleteFunction, importState, exportStateJson } from './store';
import type { BacktestConfig, BacktestResult, Attribution } from './engine/run';
import { validate, exportJs, exportNatural, type Issue } from './engine/tools';
import { explainStrategy } from './engine/explain';
import { TopBar } from './ui/TopBar';
import { StepIndicator } from './ui/StepIndicator';
import { Icon } from './ui/Icon';
import { Landing } from './ui/Landing';
import { BuildPanel, TestPanel, BacktestPanel, ResultsPanel, ExportPanel } from './ui/panels';
import { MakeVarModal, MakeFnModal, FunctionEditorModal } from './ui/Modals';

type Page = 'landing' | 'build' | 'backtest';
type BuildTab = 'build' | 'test' | 'export';
type ModalState = { type: 'var' } | { type: 'makefn' } | { type: 'editfn'; fnId: string } | null;

const DEFAULT_CONFIG: BacktestConfig = {
  pair: 'BTC/USDT',
  timeframe: '1d',
  bars: 500,
  startCash: 10000,
  feeBps: 10,
  slippageBps: 5,
  seed: 42,
  source: 'synthetic',
};

export default function App() {
  const state = useEditorState();
  const editorRef = useRef<StrategyEditorHandle>(null);
  const workerRef = useRef<Worker | null>(null);

  const [page, setPage] = useState<Page>('landing');
  const [buildTab, setBuildTab] = useState<BuildTab>('build');
  const [config, setConfig] = useState<BacktestConfig>(DEFAULT_CONFIG);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [attribution, setAttribution] = useState<Attribution[] | null>(null);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [sourceNote, setSourceNote] = useState<string | null>(null);
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

  function getWorker(): Worker {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('./engine/worker.ts', import.meta.url), { type: 'module' });
    }
    return workerRef.current;
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
    setExplanation(explainStrategy(strategy));
    setPage('build');
    setBuildTab('test');
    highlightIssues(list);
  }

  function runBacktest() {
    const list = validate(strategy);
    if (list.some((i) => i.severity === 'error')) {
      setIssues(list);
      setExplanation(explainStrategy(strategy));
      setPage('build');
      setBuildTab('test');
      highlightIssues(list);
      return;
    }
    setRunning(true);
    setIssues(list);
    setSourceNote(null);

    const worker = getWorker();
    worker.onmessage = (e: MessageEvent<{ ok: boolean; result?: BacktestResult; attribution?: Attribution[]; source?: 'synthetic' | 'binance'; error?: string }>) => {
      const data = e.data;
      setRunning(false);
      if (data.ok && data.result) {
        setResult(data.result);
        setAttribution(data.attribution ?? null);
        if (config.source === 'binance' && data.source === 'synthetic') {
          setSourceNote('Binance unavailable — fell back to synthetic data');
        }
        setPage('backtest');
      } else {
        setSourceNote('Backtest failed');
        alert('Backtest failed: ' + (data.error ?? 'unknown error'));
      }
    };
    worker.onerror = (e) => {
      setRunning(false);
      setSourceNote('Backtest failed');
      alert('Backtest worker error: ' + e.message);
    };
    worker.postMessage({ strategy, config });
  }

  const editFn = modal?.type === 'editfn' ? state.functions.find((f) => f.id === modal.fnId) : null;

  if (page === 'landing') {
    return <Landing onStart={() => setPage('build')} />;
  }

  const statusBar = (
    <div className="statusbar">
      <span className="dot" />
      <span>{blockCount} blocks</span>
      <span className="spacer" />
      {sourceNote && <span style={{ color: 'var(--amber)' }}>{sourceNote}</span>}
      <span>{config.pair} · {config.timeframe} · {config.bars} bars · {config.source}</span>
    </div>
  );

  const modals = (
    <>
      {modal?.type === 'var' && <MakeVarModal onClose={() => setModal(null)} onConfirm={(n) => addVar(n)} />}
      {modal?.type === 'makefn' && <MakeFnModal onClose={() => setModal(null)} onConfirm={(n, p) => addFunction(n, p)} />}
      {modal?.type === 'editfn' && editFn && <FunctionEditorModal fn={editFn} onClose={() => setModal(null)} />}
    </>
  );

  return (
    <div className="app">
      {page === 'build' ? (
        <>
          <TopBar>
            <StepIndicator current={currentStep} onStep={gotoStep} />
            <button className="btn btn--primary" onClick={() => setPage('backtest')}>Run Backtest <Icon name="arrowRight" size={14} /></button>
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
                    onMakeFn={() => setModal({ type: 'makefn' })}
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
                    functions={state.functions}
                    blockCount={blockCount}
                    onMakeVar={() => setModal({ type: 'var' })}
                    onMakeFn={() => setModal({ type: 'makefn' })}
                    onRenameVar={renameVar}
                    onDeleteVar={deleteVar}
                    onEditFn={(id) => setModal({ type: 'editfn', fnId: id })}
                    onDeleteFn={deleteFunction}
                    onLoadJson={handleImportFile}
                  />
                )}
                {buildTab === 'test' && (
                  <TestPanel issues={issues} explanation={explanation} onTest={runTest} onHighlight={(id) => editorRef.current?.highlightBlock(id)} />
                )}
                {buildTab === 'export' && <ExportPanel natural={natural} js={js} json={strategyJson} />}
              </div>
            </div>
          </div>

          {statusBar}
        </>
      ) : (
        <>
          <TopBar>
            <StepIndicator current={currentStep} onStep={gotoStep} />
            <button className="btn" onClick={() => setPage('build')}><Icon name="arrowLeft" size={14} /> Edit strategy</button>
          </TopBar>

          <div className="main">
            <div className="backtest-left">
              <BacktestPanel config={config} setConfig={setConfig} onRun={runBacktest} running={running} />
            </div>
            <div className="results-right">
              <ResultsPanel
                result={result}
                attribution={attribution}
                startCash={config.startCash}
                expandedTrade={expandedTrade}
                setExpandedTrade={setExpandedTrade}
              />
            </div>
          </div>

          {statusBar}
        </>
      )}

      {modals}
    </div>
  );
}
