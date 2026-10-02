/**
 * Messages exchanged between the popup, the background script, and each frame's content script.
 * The popup has zero engine logic (FR4.3) — it only ever sends these and renders what comes back.
 */
export type Message =
  | { type: 'tsa:getFactor' }
  | { type: 'tsa:setFactor'; factor: number }
  | { type: 'tsa:increase' }
  | { type: 'tsa:decrease' }
  | { type: 'tsa:reset' }
  | { type: 'tsa:factorChanged'; factor: number }
  | { type: 'tsa:registerFrame' };

export interface FactorResponse {
  factor: number;
}

/** A factor received in a message: anything else (NaN, a string) would make every `calc()` invalid. */
export function isFactor(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
