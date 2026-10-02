import { describe, expect, it } from 'vitest';
import { parsePosition, parseShow } from './settings.js';

describe('parsePosition', () => {
  it('accepts long forms', () => {
    expect(parsePosition('top-left')).toBe('top-left');
    expect(parsePosition('bottom-right')).toBe('bottom-right');
  });

  it('accepts short forms, case-insensitively and with surrounding space', () => {
    expect(parsePosition('TL')).toBe('top-left');
    expect(parsePosition(' br ')).toBe('bottom-right');
    expect(parsePosition('tr')).toBe('top-right');
    expect(parsePosition('bl')).toBe('bottom-left');
  });

  it('returns null for missing or unknown values', () => {
    expect(parsePosition(null)).toBeNull();
    expect(parsePosition('')).toBeNull();
    expect(parsePosition('middle')).toBeNull();
  });
});

describe('parseShow', () => {
  it('accepts always and on-zoom, case-insensitively', () => {
    expect(parseShow('always')).toBe('always');
    expect(parseShow(' On-Zoom ')).toBe('on-zoom');
  });

  it('returns null for missing or unknown values', () => {
    expect(parseShow(undefined)).toBeNull();
    expect(parseShow('sometimes')).toBeNull();
  });
});
