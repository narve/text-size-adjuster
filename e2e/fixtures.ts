export interface FixtureDef {
  id: string;
  /** Path relative to the Playwright config's baseURL. */
  path: string;
}

/**
 * Fixtures validated with the generic "small/large reference ratio is preserved" check (TR2).
 * `spa-mutation` and `iframe-cross-origin` have their own dedicated test blocks in
 * engine.spec.ts because they need extra interaction/assertions beyond that generic check.
 */
export const STANDARD_FIXTURES: FixtureDef[] = [
  { id: 'plain-px', path: '/plain-px/' },
  { id: 'rem-em', path: '/rem-em/' },
  { id: 'nested-em', path: '/nested-em/' },
  { id: 'shadow-dom-open', path: '/shadow-dom-open/' },
  { id: 'overflow-clipping', path: '/overflow-clipping/' },
  { id: 'important-high-specificity', path: '/important-high-specificity/' },
  { id: 'line-height-mixed', path: '/line-height-mixed/' },
  { id: 'large-dom-performance', path: '/large-dom-performance/' },
];

export const FACTORS = [0.5, 0.8, 1.0, 1.5, 2.0, 3.0];
