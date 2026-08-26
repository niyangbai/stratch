# @stratch/market-sim

Dependency-free stochastic market simulator — GBM, fat-tailed GBM and Heston
Monte Carlo. Written in TypeScript, seeded for reproducibility, emits OHLCV bars
or raw price paths.

## Usage

```ts
import { simulateBars, simulatePaths, quantile } from '@stratch/market-sim';

const bars = simulateBars(
  {
    model: 'gbm',
    dt: 1 / 365,     // daily
    steps: 500,
    params: { s0: 42000, mu: 0.10, sigma: 0.55 },
  },
  42,
  { stepMs: 86_400_000 },
);

const paths = simulatePaths(
  { model: 'heston', dt: 1 / 365, steps: 252,
    params: { s0: 100, mu: 0.05, v0: 0.09, theta: 0.09, kappa: 2, xi: 0.3, rho: -0.7 } },
  1000,
);

const p95 = quantile(paths.map((p) => p[p.length - 1] / p[0] - 1), 0.95);
```

## Models

| id       | description                                              | extra params |
|----------|----------------------------------------------------------|--------------|
| `gbm`    | geometric Brownian motion, Gaussian log-returns          | `sigma`      |
| `fatgbm` | GBM with Student-t log-returns (heavy tails)             | `sigma`, `nu` |
| `heston` | stochastic volatility (variance mean-reverts)            | `v0 theta kappa xi rho` |

All params except `s0`, `mu` (`drift`) are documented on the exported types.
`simulateBars` / `simulatePath` / `simulatePaths` take an optional `seed` so any
run is reproducible.

## Notes

- Designed for bundler consumption (Vite, Next, esbuild). Build with
  `npm run build` to emit `dist/` (ESM + types).
