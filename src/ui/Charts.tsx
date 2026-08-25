// ─────────────────────────────────────────────────────────────────────────────
// Lightweight canvas charts (no deps) — crypto-terminal styling.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import type { Bar } from '../engine/data';
import type { Trade } from '../engine/run';

function useChartCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement!;
    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth || 300;
      const h = parent.clientHeight || 180;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      draw(ctx, w, h);
    };
    render();
    const ro = new ResizeObserver(render);
    ro.observe(parent);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

function grid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(140,175,220,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 40) {
    ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
  }
}

function range(values: number[]): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (!Number.isFinite(lo)) return [0, 1];
  if (lo === hi) return [lo * 0.99, hi * 1.01];
  return [lo, hi];
}

export function PriceChart({ bars, trades }: { bars: Bar[]; trades: Trade[] }) {
  const ref = useChartCanvas((ctx, w, h) => {
    const pad = 8;
    if (!bars.length) return;
    grid(ctx, w, h);
    const closes = bars.map((b) => b.close);
    const [lo, hi] = range(closes);
    const x = (i: number) => pad + (i / (bars.length - 1)) * (w - pad * 2);
    const y = (v: number) => h - pad - ((v - lo) / (hi - lo)) * (h - pad * 2);

    // line
    ctx.beginPath();
    bars.forEach((b, i) => (i === 0 ? ctx.moveTo(x(i), y(b.close)) : ctx.lineTo(x(i), y(b.close))));
    ctx.strokeStyle = '#00e6a8';
    ctx.lineWidth = 1.6;
    ctx.shadowColor = 'rgba(0,230,168,0.5)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // markers
    for (const t of trades) {
      const px = x(t.bar);
      const py = y(t.price);
      ctx.beginPath();
      if (t.side === 'BUY') {
        ctx.moveTo(px, py - 6); ctx.lineTo(px - 4, py + 2); ctx.lineTo(px + 4, py + 2); ctx.closePath();
        ctx.fillStyle = '#00e6a8';
      } else {
        ctx.moveTo(px, py + 6); ctx.lineTo(px - 4, py - 2); ctx.lineTo(px + 4, py - 2); ctx.closePath();
        ctx.fillStyle = '#ff4d5e';
      }
      ctx.fill();
    }
  }, [bars, trades]);

  return (
    <div className="chart">
      <div className="card__title">Price &amp; trade markers</div>
      <div className="chart__canvas"><canvas ref={ref} /></div>
    </div>
  );
}

export function EquityChart({ equity, startCash }: { equity: number[]; startCash: number }) {
  const ref = useChartCanvas((ctx, w, h) => {
    const pad = 8;
    if (equity.length < 2) return;
    grid(ctx, w, h);
    const values = [...equity, startCash];
    const [lo, hi] = range(values);
    const x = (i: number) => pad + (i / (equity.length - 1)) * (w - pad * 2);
    const y = (v: number) => h - pad - ((v - lo) / (hi - lo)) * (h - pad * 2);

    // area fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(34,211,238,0.18)');
    grad.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.beginPath();
    equity.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
    ctx.lineTo(x(equity.length - 1), h - pad);
    ctx.lineTo(x(0), h - pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    equity.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = 'rgba(34,211,238,0.5)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // baseline
    ctx.beginPath();
    ctx.moveTo(pad, y(startCash));
    ctx.lineTo(w - pad, y(startCash));
    ctx.strokeStyle = 'rgba(140,175,220,0.35)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }, [equity, startCash]);

  return (
    <div className="chart">
      <div className="card__title">Equity curve</div>
      <div className="chart__canvas"><canvas ref={ref} /></div>
    </div>
  );
}
