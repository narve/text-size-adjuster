import { describe, expect, it } from 'vitest';
import { clampFactor } from './clamp.js';

describe('clampFactor', () => {
  it('passes values within range through unchanged', () => {
    expect(clampFactor(1.5, 0.5, 3)).toBe(1.5);
  });

  it('clamps below the minimum', () => {
    expect(clampFactor(0.1, 0.5, 3)).toBe(0.5);
  });

  it('clamps above the maximum', () => {
    expect(clampFactor(10, 0.5, 3)).toBe(3);
  });

  it('treats NaN as the minimum rather than propagating it', () => {
    expect(clampFactor(NaN, 0.5, 3)).toBe(0.5);
  });

  it('is inclusive at the boundaries', () => {
    expect(clampFactor(0.5, 0.5, 3)).toBe(0.5);
    expect(clampFactor(3, 0.5, 3)).toBe(3);
  });
});
