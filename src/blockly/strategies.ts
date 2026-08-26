// ─────────────────────────────────────────────────────────────────────────────
// Predefined strategies — a small library of well-known, long-only spot
// strategies. The blocks live in plain JSON files (exactly the export/import
// shape: { vars, setupJson, onBarJson }); names + descriptions are kept here
// so the picker can label them.
// ─────────────────────────────────────────────────────────────────────────────

import martingale from './strategies/martingale.json';
import buyhold from './strategies/buyhold.json';
import goldenCross from './strategies/golden-cross.json';
import rsiReversion from './strategies/rsi-reversion.json';
import bollingerBreakout from './strategies/bollinger-breakout.json';
import donchianBreakout from './strategies/donchian-breakout.json';

export interface PredefinedStrategy {
  id: string;
  name: string;
  description: string;
  vars: { id: string; name: string }[];
  setupJson: any;
  onBarJson: any;
}

const META: Record<string, { name: string; description: string }> = {
  martingale: {
    name: 'Martingale dip-buyer',
    description: 'Buy the dip, take profit at +5%, and double the bet after a −5% stop.',
  },
  buyhold: {
    name: 'Buy & Hold',
    description: 'Buy once with all cash and hold. The benchmark every strategy is measured against.',
  },
  'golden-cross': {
    name: 'Golden Cross (dual MA)',
    description: 'Trend-follow: go long when a fast moving average is above a slow one, exit when it flips.',
  },
  'rsi-reversion': {
    name: 'RSI Mean Reversion',
    description: 'Buy when oversold (RSI below 30) and sell when overbought (RSI above 70).',
  },
  'bollinger-breakout': {
    name: 'Bollinger Breakout',
    description: 'Buy when price breaks above the upper band and exit when it drops below the lower band.',
  },
  'donchian-breakout': {
    name: 'Donchian Breakout',
    description: 'Classic trend following: buy new 20-bar highs, exit on a 10-bar low.',
  },
};

export const PREDEFINED_STRATEGIES: PredefinedStrategy[] = [
  { id: 'martingale', ...META.martingale, ...martingale },
  { id: 'buyhold', ...META.buyhold, ...buyhold },
  { id: 'golden-cross', ...META['golden-cross'], ...goldenCross },
  { id: 'rsi-reversion', ...META['rsi-reversion'], ...rsiReversion },
  { id: 'bollinger-breakout', ...META['bollinger-breakout'], ...bollingerBreakout },
  { id: 'donchian-breakout', ...META['donchian-breakout'], ...donchianBreakout },
];

/** The strategy loaded on first run. */
export function starterStrategy(): PredefinedStrategy {
  return PREDEFINED_STRATEGIES[0];
}

/** Deep-copy a strategy payload before handing it to Blockly (which may mutate it). */
export function cloneJson(x: any): any {
  return JSON.parse(JSON.stringify(x));
}
