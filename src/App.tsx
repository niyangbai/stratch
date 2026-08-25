// ─────────────────────────────────────────────────────────────────────────────
// Stratch — top-level app shell.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useRef, useState } from 'react';
import { StrategyEditor, type StrategyEditorHandle } from './blockly/StrategyEditor';
import { useEditorState, addVar, renameVar, deleteVar, addFunction, deleteFunction } from './store';
import type { BacktestConfig, BacktestResult, Attribution } from './engine/run';
import { validate, exportJs, exportNatural, type Issue } from './engine/tools';
import { explainStrategy } from './engine/explain';
import { TopBar } from './ui/TopBar';
import { BuildPanel, TestPanel, BacktestPanel, ResultsPanel, ExportPanel } from './ui/panels';
import { MakeVarModal, MakeFnModal, FunctionEditorModal } from './ui/Modals';

type Tab = 'build' | 'test' | 'backtest' | 'results' | 'export';
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

  const [tab, setTab] = useState<Tab>('build');
  const [config, setConfig] = useState<BacktestConfig>(DEFAULT_CONFIG);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [attribution, setAttribution] = useState<Attribution[] | null>(null);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [sourceNote, setSourceNote] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);

  function getWorker(): Worker {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('./engine/worker.ts', import.meta.url), { type: 'module' });
    }
    return workerRef.current;
  }

  const strategy = state.strategy;
  const blockCount = Object.keys(strategy.blocks).length;
  const natural = useMemo(() => exportNatural(strategy), [strategy]);
  const js = useMemo(() => exportJs(strategy), [strategy]);

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
    setTab('test');
    highlightIssues(list);
  }

  function runBacktest() {
    const list = validate(strategy);
    if (list.some((i) => i.severity === 'error')) {
      setIssues(list);
      setExplanation(explainStrategy(strategy));
      setTab('test');
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
        setTab('results');
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

  return (
    <div className="app">
      <TopBar onTest={runTest} onBacktest={runBacktest} onExport={() => setTab('export')} />

      <div className="main">
        {/* Blockly workspace */}
        <div className="workspace-wrap">
          <div className="ws-toolbar">
            <button className="iconbtn" title="Undo (Ctrl+Z)" onClick={() => editorRef.current?.undo()}>↶</button>
            <button className="iconbtn" title="Redo (Ctrl+Shift+Z)" onClick={() => editorRef.current?.redo()}>↷</button>
            <span className="divider" />
            <button className="iconbtn" title="Load example" onClick={() => editorRef.current?.loadExample()}>⚡</button>
            <button className="iconbtn" title="Clear all" onClick={() => editorRef.current?.clearAll()}>🗑</button>
            <span className="spacer" />
            <span className="mono muted" style={{ fontSize: 10 }}>drag from toolbox → snap blocks · right-click a block for menu</span>
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

        {/* Side panel */}
        <div className="side">
          <div className="side__tabs">
            {(['build', 'test', 'backtest', 'results', 'export'] as Tab[]).map((t) => (
              <div key={t} className={`side__tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'backtest' ? 'Backtest' : t === 'results' ? 'Results' : t.charAt(0).toUpperCase() + t.slice(1)}
              </div>
            ))}
          </div>
          <div className="side__body">
            {tab === 'build' && (
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
              />
            )}
            {tab === 'test' && (
              <TestPanel issues={issues} explanation={explanation} onTest={runTest} onHighlight={(id) => editorRef.current?.highlightBlock(id)} />
            )}
            {tab === 'backtest' && <BacktestPanel config={config} setConfig={setConfig} onRun={runBacktest} running={running} />}
            {tab === 'results' && (
              <ResultsPanel
                result={result}
                attribution={attribution}
                startCash={config.startCash}
                expandedTrade={expandedTrade}
                setExpandedTrade={setExpandedTrade}
              />
            )}
            {tab === 'export' && <ExportPanel natural={natural} js={js} />}
          </div>
        </div>
      </div>

      <div className="statusbar">
        <span className="dot" />
        <span>READY</span>
        <span>· {blockCount} blocks</span>
        <span>· {state.vars.length} vars</span>
        <span>· {state.functions.length} my blocks</span>
        <span className="spacer" />
        {sourceNote && <span style={{ color: 'var(--amber)' }}>{sourceNote}</span>}
        <span>{config.pair} · {config.timeframe} · {config.bars} bars · source {config.source}</span>
      </div>

      {modal?.type === 'var' && <MakeVarModal onClose={() => setModal(null)} onConfirm={(n) => addVar(n)} />}
      {modal?.type === 'makefn' && <MakeFnModal onClose={() => setModal(null)} onConfirm={(n, p) => addFunction(n, p)} />}
      {modal?.type === 'editfn' && editFn && <FunctionEditorModal fn={editFn} onClose={() => setModal(null)} />}
    </div>
  );
}
