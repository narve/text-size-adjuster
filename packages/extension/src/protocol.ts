/**
 * Messages exchanged between the popup, the background script, and each frame's content script.
 * The popup has zero engine logic (FR4.3) — it only ever sends these and renders what comes back.
 */
export type Message =
  // Popup → the tab's top frame (frameId 0), answered with a FactorResponse.
  | { type: 'tsa:getFactor' }
  | { type: 'tsa:increase' }
  | { type: 'tsa:decrease' }
  | { type: 'tsa:reset' }
  // Top frame → background: the tab's size changed.
  | { type: 'tsa:factorChanged'; factor: number }
  // Background → every frame of the tab: follow the top frame (subframes only).
  | { type: 'tsa:setFactor'; factor: number }
  // Subframe → background, answered with the top frame's FactorResponse (or nothing).
  | { type: 'tsa:getTopFactor' }
  // Top frame → background: open the options page (a content script can't do that itself).
  | { type: 'tsa:openOptions' };

export interface FactorResponse {
  factor: number;
}

/** A factor received in a message: anything else (NaN, a string) would make every `calc()` invalid. */
export function isFactor(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
