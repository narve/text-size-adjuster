import { describe, expect, it } from 'vitest';
import { isPxLineHeight } from './line-height.js';

describe('isPxLineHeight', () => {
  it('is true for a px-resolved computed value', () => {
    expect(isPxLineHeight('24px')).toBe(true);
    expect(isPxLineHeight('0px')).toBe(true);
  });

  it('is false for the normal keyword', () => {
    expect(isPxLineHeight('normal')).toBe(false);
  });

  it('is false for a bare-number string', () => {
    // In practice getComputedStyle resolves a unitless declaration (e.g. `1.5`) to a used px
    // value, not to this literal form (see engine.ts's capture docs) — this just documents the
    // function's behavior for the input shape, not a claim about what the browser returns.
    expect(isPxLineHeight('1.5')).toBe(false);
    expect(isPxLineHeight('2')).toBe(false);
  });
});
