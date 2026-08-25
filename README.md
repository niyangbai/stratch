# STRATCH

**Build a crypto trading bot with blocks — no code, no forms.**

STRATCH is a game where you are the quant. Instead of filling in a strategy form, you snap blocks together like Scratch to write a trading strategy, then run it against real crypto history and see how it scores.

---

## The loop

```
Build → Test My Strategy → Backtest → Score → Improve → Export
```

The app is split into two screens, so the loop reads as two clear steps:

1. **Build & Test** — snap blocks, validate them and export, all on one screen.
2. **Backtest & Results** — choose the market and see your score, charts and trade history on the next screen.

You land on a welcome page first, then a two-step bar (`1 Build & Test · 2 Backtest & Results`) stays on top so you can jump between the two anytime.

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

### 3 · Backtest
Pick the environment — crypto pair, timeframe, date range, starting cash, fee and slippage — then **Run Backtest**. The same strategy can be tried instantly on BTC, ETH or SOL and on any timeframe.

### 4 · Score
You get a **0–100 strategy score** (not just raw return — it weighs performance, benchmark, risk, consistency, robustness and complexity), plus:

- total return vs. buy & hold, max drawdown, Sharpe, win rate, profit factor
- a price chart with your buy/sell markers
- an equity curve
- the full trade history

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

First version: crypto **spot**, **long-only**, **single asset**, bar-based, historical backtest, pure frontend. No login, no backend, no live trading. Data comes from a deterministic synthetic market (reproducible by seed) or live Binance klines — all computed in your browser, in a Web Worker so the UI stays responsive.

Under the hood it's React + TypeScript + [Blockly](https://github.com/google/blockly) (the project Scratch Blocks is forked from) with a dark crypto-terminal theme, and a Web Worker runs the backtest. The block editor compiles into a strategy model that is validated, run, explained, scored and exported from one source.

---

## License

STRATCH is licensed under **AGPL-3.0** (`LICENSE`). Blockly is Apache-2.0 and is used unmodified.
