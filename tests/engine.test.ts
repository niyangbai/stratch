// ─────────────────────────────────────────────────────────────────────────────
// Headless smoke tests for the Stratch engine (IR → validate → backtest →
// explain → export). Run with:  npm run test:engine
// ─────────────────────────────────────────────────────────────────────────────

import { buildStrategy } from '../src/blockly/generator';
import { generateBars } from '../src/engine/data';
import { fullBacktest, attribute } from '../src/engine/run';
import { validate, exportJs } from '../src/engine/tools';
import { explainStrategy } from '../src/engine/explain';

let failures = 0;
function check(name: string, cond: boolean, extra?: string) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${extra ? ' — ' + extra : ''}`);
  }
}

const CFG: any = {
  pair: 'BTC/USDT',
  timeframe: '1d',
  bars: 500,
  startCash: 10000,
  feeBps: 10,
  slippageBps: 5,
  seed: 42,
  source: 'synthetic',
};

// 1) classic moving-average cross (uses a shadow number block for `n`)
console.log('\n[1] moving-average cross');
{
  const onBar = {
    blocks: {
      blocks: [
        {
          type: 'if',
          inputs: {
            condition: {
              block: {
                type: 'compare',
                fields: { op: '>' },
                inputs: {
                  a: { block: { type: 'price', fields: { src: 'Close' } } },
                  b: {
                    block: {
                      type: 'window',
                      fields: { fn: 'average', src: 'Close' },
                      inputs: { n: { shadow: { type: 'number', fields: { n: 20 } } } },
                    },
                  },
                },
              },
            },
            do: {
              block: {
                type: 'buy',
                fields: { unit: '% of cash' },
                inputs: { amount: { block: { type: 'number', fields: { n: 50 } } } },
              },
            },
          },
        },
      ],
    },
  };
  const strategy = buildStrategy([], [], { blocks: { blocks: [] } }, onBar);
  check('builds the expected blocks (incl. shadow number)', Object.keys(strategy.blocks).length === 7, `got ${Object.keys(strategy.blocks).length}`);
  check('validate passes', validate(strategy).length === 0, JSON.stringify(validate(strategy)));

  const bars = generateBars(CFG.pair, CFG.timeframe, CFG.bars, CFG.seed);
  const res = fullBacktest(strategy, CFG, bars);
  check('produces trades', res.metrics.trades > 0, `trades=${res.metrics.trades}`);
  check('produces a final value', res.metrics.finalValue > 0);
  check('scores between 0 and 100', res.score.total >= 0 && res.score.total <= 100, `score=${res.score.total}`);

  const attr = attribute(strategy, CFG, bars, res);
  check('attribution has one condition', attr.length === 1);
  check('explanation mentions closing price', explainStrategy(strategy).includes('closing price'));
  check('js export contains ctx.window', exportJs(strategy).includes('ctx.window'));
}

// 2) My Block: Momentum(period) = Close / Close[period] ago - 1
console.log('\n[2] My Block with a parameter');
{
  const functions = [
    {
      id: 'f1',
      name: 'Momentum',
      params: ['period'],
      returnJson: {
        type: 'arith',
        fields: { op: '−' },
        inputs: {
          a: {
            block: {
              type: 'arith',
              fields: { op: '÷' },
              inputs: {
                a: { block: { type: 'price', fields: { src: 'Close' } } },
                b: {
                  block: {
                    type: 'priceAgo',
                    fields: { src: 'Close' },
                    inputs: { bars: { block: { type: 'param', fields: { name: 'period' } } } },
                  },
                },
              },
            },
          },
          b: { block: { type: 'number', fields: { n: 1 } } },
        },
      },
    },
  ];
  const onBar = {
    blocks: {
      blocks: [
        {
          type: 'if',
          inputs: {
            condition: {
              block: {
                type: 'compare',
                fields: { op: '>' },
                inputs: {
                  a: { block: { type: 'callFn', fields: { fn: 'f1' }, inputs: { arg0: { block: { type: 'number', fields: { n: 10 } } } } } },
                  b: { block: { type: 'number', fields: { n: 0 } } },
                },
              },
            },
            do: {
              block: {
                type: 'buy',
                fields: { unit: '% of cash' },
                inputs: { amount: { block: { type: 'number', fields: { n: 50 } } } },
              },
            },
          },
        },
      ],
    },
  };
  const strategy = buildStrategy([], functions as any, { blocks: { blocks: [] } }, onBar);
  const issues = validate(strategy);
  check('validate passes with a function + param', issues.length === 0, JSON.stringify(issues));

  const bars = generateBars(CFG.pair, CFG.timeframe, CFG.bars, CFG.seed);
  const res = fullBacktest(strategy, CFG, bars);
  check('function strategy trades', res.metrics.trades > 0, `trades=${res.metrics.trades}`);

  const js = exportJs(strategy);
  check('js export defines the function', js.includes('function Momentum(period, ctx)'));
  check('js export binds the parameter', js.includes('ctx.price("Close", period)'));
}

// 3) validation catches a missing amount
console.log('\n[3] validation');
{
  const onBar = {
    blocks: {
      blocks: [{ type: 'buy', fields: { unit: '% of cash' } }],
    },
  };
  const strategy = buildStrategy([], [], { blocks: { blocks: [] } }, onBar);
  const issues = validate(strategy);
  check('flags missing amount', issues.some((i) => i.severity === 'error' && i.message.includes('value')));
}

console.log('\n' + (failures === 0 ? 'ALL TESTS PASSED' : `${failures} TEST(S) FAILED`));
if (failures > 0) throw new Error('engine tests failed');
