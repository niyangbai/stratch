# STRATCH

**Build a crypto trading bot with blocks — no code, no forms.**

STRATCH is a game where you are the quant. Instead of filling in a strategy form, you snap blocks together like Scratch to write a trading strategy, then backtest it on real crypto history or Monte-Carlo simulate it.

---

## The loop

```
Build → Test My Strategy → Simulate / Backtest → Metrics → Improve → Export
```

The app is split into two screens, so the loop reads as two clear steps:

1. **Build & Test** — snap blocks, validate them and export, all on one screen.
2. **Simulate & Results** — backtest on Binance history or Monte-Carlo simulate, then read metrics, distribution charts and trade history.

You land on a welcome page first, then a two-step bar (`1 Build & Test · 2 Simulate & Results`) stays on top so you can jump between the two anytime.

Every strategy lives in two fixed zones — you never create them:

| Zone | What it does |
|------|--------------|
| **SETUP** | Runs once, before trading starts. Define variables and **functions** here (like module-level `def`s). |
| **ON EVERY BAR** | The entry point — the `main` loop. Runs once for every market bar. |

---

## How to play

### 1 · Build
Drag blocks from the toolbox on the left into the two zones. Blocks snap together and nest, just like Scratch.

Your pieces:

- **Logic** — `if` / `if / else`, `AND`, `OR`, `NOT`, and comparisons (`>`, `<`, `=`, `>=`, `<=`, `≠`).
- **Math** — `+`, `−`, `×`, `÷`, `min`, `max`, `abs`, `round`.
- **Variables** — make a variable, then `set` it, `change` it, or read it.
- **Market** — price (Open / High / Low / Close / Volume), price N bars ago, and window calcs (`average`, `sum`, `highest`, `lowest`).
- **Indicators** — `EMA`, `RSI`, `MACD`, `Bollinger Bands`, `ATR`, `VWAP`, `ROC`.
- **Portfolio** — `Cash`, `Position`, `Average Entry Price`, `Portfolio Value`.
- **Trade** — `BUY` (as % of cash, USDT, or BTC), `SELL`, and `Sell All`.
- **My Blocks** — define a function in SETUP (name + parameters + a return value), then call it anywhere.

The starter strategy is a **Martingale** dip-buyer:

```
SETUP        set bet to 2
ON EVERY BAR if flat and Close dips → BUY bet% of cash
             if up 5%  → Sell All, reset bet
             if down 5% → Sell All, double bet
```

Buy the dip with a base bet, take profit at +5%, and double the bet after a −5% stop loss.

### 2 · Test My Strategy
Hit **Test My Strategy**. STRATCH validates your blocks (it will point at any block that's broken) and reads your strategy back to you in plain English — so you know the machine understood exactly what you meant.

### 3 · Simulate / Backtest
Pick a mode — **Backtest** (real Binance history) or **Simulate** (Monte-Carlo). Backtest runs once on the pair/timeframe you pick. Simulate runs your strategy across many market paths drawn from a GBM, fat-tailed GBM or Heston model, each with its own parameters (drift, volatility, tail degrees of freedom, variance, …).

### 4 · Metrics
No single score — you get the real numbers:

- backtest: total return, CAGR, annualized volatility, max drawdown, Sharpe, Sortino, Calmar, win rate, profit factor — plus a price chart, an equity curve and the full trade history
- simulate: the distribution of outcomes — median / mean / 5th–95th percentile return and positive-path rate — with a quantile fan chart and faint individual paths

### 5 · Improve
Click any trade to see **why it happened** — the exact condition and the numbers at that bar. Then read **What mattered?** to see which conditions actually moved your result. Tighten your blocks and re-run.

### 6 · Export
Export your strategy as **plain English** or as **readable JavaScript** — STRATCH shows you that your blocks *are* real programming logic.

---

## Run it

```bash
npm install
npm run dev
```

Open the printed URL (usually http://localhost:5173). A Martingale starter strategy is loaded on first run, and your work autosaves in the browser.

```bash
npm run build       # production build into dist/
npm run preview     # serve the build
npm run test:engine # headless tests for the strategy engine
```

---

## Scope

First version: crypto **spot**, **long-only**, **single asset**, bar-based, pure frontend. No login, no backend, no live trading. Data comes from live Binance klines (backtest) or a seeded Monte-Carlo simulator (GBM / fat-tailed GBM / Heston) — all computed in your browser, with the run happening in a Web Worker (and a synchronous fallback).

Under the hood it's React + TypeScript + [Blockly](https://github.com/google/blockly) (the project Scratch Blocks is forked from) with a dark crypto-terminal theme. The block editor compiles into a strategy model that is validated, run, explained and exported from one source. The stochastic simulator is a separate workspace package, [`@stratch/market-sim`](packages/market-sim), so it can be reused in other projects.

---

## License

STRATCH is licensed under **AGPL-3.0** (`LICENSE`). Blockly is Apache-2.0 and is used unmodified.
