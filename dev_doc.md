# Stratch — Lean Dev Doc

## 1. 产品定位

Stratch 是一个 **Scratch-style crypto trading strategy game**。

用户通过拖拽积木编写策略，而不是填写策略表单。

核心流程：

```text id="j17i4q"
Build
→ Test My Strategy
→ Backtest
→ Score
→ Improve
→ Export
```

整个 App 使用 **English**。

本文档仅用于开发说明，因此使用中文。

---

## 2. 第一版范围

只做：

* Crypto Spot
* Long only
* Single asset
* Bar-based strategy
* Historical backtest
* Pure frontend
* Visual block programming

不要做：

* Stocks / Forex
* Factors
* Derivatives
* Short / Leverage / Margin
* Live trading
* Backend
* Login
* Multi-asset portfolio
* Order book / HFT

---

## 3. Strategy Workspace

不要让用户自己创建程序入口。

每个 Strategy 固定有两个区域：

```text id="gcs8o6"
SETUP
────────────────
Run once before the strategy starts.


ON EVERY BAR
────────────────
Run once for each market bar.
```

`SETUP` 用于初始化变量。

例如：

```text id="ca724f"
set bet to 100
set highestPrice to 0
```

`ON EVERY BAR` 是策略主体。

例如：

```text id="cx954y"
if Close > Average(Close, 20)
    Buy 50% of Cash
```

这两个区域始终存在，不需要作为 Block 拖入。

---

## 4. Block Palette

保持精简，只提供基础 building blocks。

### Logic

```text id="xcd760"
if
if / else

AND
OR
NOT

>
<
=
>=
<=
!=
```

### Math

```text id="qtfk4l"
+
-
×
÷

min
max
abs
round
```

### Variables

```text id="7h3w2q"
Make Variable

set [variable] to [value]

change [variable] by [value]

[variable]
```

### Market

基础值：

```text id="0md1ol"
[ Close ▼ ]
```

可选择：

```text id="2zix1x"
Open
High
Low
Close
Volume
```

历史值：

```text id="13l8sy"
[ Close ▼ ] [5] bars ago
```

窗口计算：

```text id="etgwy0"
[ average ▼ ] of [ Close ▼ ] over [20] bars
```

可选择：

```text id="v2wzdq"
average
sum
highest
lowest
```

### Portfolio

```text id="h86nt8"
Cash

Position

Average Entry Price

Portfolio Value
```

### Trade

```text id="ypnx4g"
BUY [value] [unit ▼]

SELL [value] [unit ▼]
```

常用单位例如：

```text id="yqwf5h"
% of cash
USDT
BTC

% of position
BTC
```

可以提供：

```text id="fmvm9x"
Sell All
```

作为 convenience block。

### My Blocks

用户可以创建自己的 function。

支持：

* Name
* Parameters
* Return value
* Call

例如：

```text id="bs3wdi"
define Momentum(period)

return
    Close / Close [period] bars ago - 1
```

之后 `Momentum(20)` 成为可重复使用的 Block。

---

## 5. Indicators

Indicators 是 convenience blocks，不是语言核心。

第一版提供少量常用指标即可：

```text id="lye9nc"
EMA
RSI
MACD
Bollinger Bands
ATR
VWAP
ROC
```

SMA 不一定需要特殊实现，因为：

```text id="nnquv1"
average of Close over 20 bars
```

已经等价于 SMA(20)。

如果为了用户熟悉，也可以显示 `SMA / Average`。

不要加入：

```text id="wq4zhd"
Golden Cross Strategy
RSI Strategy
Trailing Stop Strategy
```

策略必须由用户自己组合出来。

---

## 6. Visual Interaction

视觉和操作全面采用 Scratch-style block programming：

* Drag & drop
* Snap
* Nested blocks
* Typed block shapes
* Duplicate
* Delete
* Undo / redo
* Zoom / pan
* Variables
* My Blocks

不要做成 node graph。

不要使用 wire connections。

不要做成 Entry / Exit form。

优先基于 Scratch / Blockly ecosystem 实现，而不是从零开发 block editor。

---

## 7. Test My Strategy

用户完成策略后点击：

**Test My Strategy**

这一步不是 Backtest。

Test 做两件事。

### Validate

检查：

* Invalid block connections
* Undefined variables
* Invalid function calls
* Missing return
* Invalid trade amount
* Unsafe execution

错误直接高亮对应 Block。

### Explain

把 Strategy 转换成简单英文，确认系统理解是否正确。

例如：

```text id="02xl4p"
if Close >
average of Close over 20 bars

    Buy 50% of Cash
```

显示：

```text id="6et3s9"
On every bar, compare the closing price with its
20-bar average.

If the closing price is higher, use 50% of the
available cash to buy the selected cryptocurrency.
```

---

## 8. Backtest

Test 通过后进入 Backtest。

这时用户才选择：

```text id="45gydn"
Crypto Pair
Timeframe
Date Range
Starting Cash
Fee
Slippage
```

这些是运行环境，不属于 Strategy。

同一个 Strategy 应该可以直接测试：

```text id="3puxwz"
BTC/USDT
ETH/USDT
SOL/USDT
```

以及不同 timeframe。

Backtest 使用免费公开 crypto historical OHLCV data，并全部在浏览器运行。

---

## 9. Results & Game Score

Backtest 后展示：

```text id="bltg4x"
Total Return
Buy & Hold
Max Drawdown
Sharpe Ratio
Win Rate
Profit Factor
Trades
Final Value
```

并提供：

* Price chart + Buy/Sell markers
* Equity curve
* Trade history

同时给：

```text id="cc2q3v"
STRATEGY SCORE

82 / 100
```

Score 不只看 Return。

应综合考虑：

* Performance
* Risk
* Drawdown
* Benchmark
* Consistency
* Robustness
* Complexity

具体公式后续决定，不要写死。

---

## 10. Explain / Attribution

用户应能点击交易查看：

**Why did this trade happen?**

显示触发交易的具体条件以及当时实际数值。

结果页还可以提供：

**What Mattered?**

用于显示 Strategy 中不同条件的影响程度。

可以采用 SHAP-style attribution 或其他更适合纯前端的 contribution analysis。

实现方法不要锁死，产品目标是让用户知道：

> 哪些条件真正影响了 Strategy。

---

## 11. Export My Strategy

用户可以导出：

### Natural Language

忠实描述当前 Blocks。

### JavaScript

生成逻辑等价、可读的 JavaScript。

例如：

```javascript id="lo3xte"
function onBar(ctx) {
  const avg20 = average(ctx.close, 20);

  if (ctx.close > avg20) {
    ctx.buyPercentOfCash(50);
  }
}
```

目的不是生成 production bot，而是帮助用户理解：

> Blocks 就是真实 programming logic。

---

## 12. 技术方向

第一版纯前端。

建议：

* React
* TypeScript
* Scratch Blocks / Blockly
* localStorage / IndexedDB
* Web Worker for backtest
* Free public crypto OHLCV API

内部 Strategy representation 应独立于 UI。

同一个 Strategy 应能够：

```text id="6vt9rs"
Render as Blocks

Validate

Run

Explain

Backtest

Score

Export to Natural Language

Export to JavaScript
```

---

## 13. 核心原则

Stratch 的语言结构保持：

```text id="494b2s"
SETUP
+
ON EVERY BAR

        ↓

Market
Portfolio
Variables

        ↓

Logic + Math

        ↓

Buy / Sell
```

尽量使用少量 primitive blocks 组合复杂 Strategy。

最终判断标准：

> **The user should feel: “I programmed this strategy myself.”**
