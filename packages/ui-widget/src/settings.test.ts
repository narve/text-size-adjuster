import { describe, expect, it } from 'vitest';
import { formatFactor, normalizeWidgetSettings, parsePosition, parseShow } from './settings.js';

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

describe('normalizeWidgetSettings', () => {
  const defaults = { position: 'bottom-right', show: 'always' } as const;

  it('keeps valid values and falls back per field', () => {
    expect(normalizeWidgetSettings({ position: 'tl', show: 'nonsense' }, defaults)).toEqual({
      position: 'top-left',
      show: 'always',
    });
  });

  it('treats missing or non-object input as empty', () => {
    expect(normalizeWidgetSettings(undefined, defaults)).toEqual(defaults);
    expect(normalizeWidgetSettings({ position: 42 }, defaults)).toEqual(defaults);
  });
});

describe('formatFactor', () => {
  it('shows a rounded percentage', () => {
    expect(formatFactor(1)).toBe('100%');
    expect(formatFactor(1.249)).toBe('125%');
  });
});
