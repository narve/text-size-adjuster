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

  it('is false for a unitless computed value', () => {
    expect(isPxLineHeight('1.5')).toBe(false);
    expect(isPxLineHeight('2')).toBe(false);
  });
});
