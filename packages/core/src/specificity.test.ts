import { describe, expect, it } from 'vitest';
import { buildOverrideCss } from './specificity.js';

const baseOpts = {
  scaledAttr: 'data-tsa-scaled',
  lineHeightAttr: 'data-tsa-lh',
  factorVar: '--tsa-k',
  baseSizeVar: '--tsa-fz0',
  baseLineHeightVar: '--tsa-lh0',
};

describe('buildOverrideCss', () => {
  it('repeats the attribute selector the default 10 times to stack specificity', () => {
    const css = buildOverrideCss(baseOpts);
    const fontSizeSelector = css.split('{')[0]!;
    expect(fontSizeSelector.match(/\[data-tsa-scaled\]/g)).toHaveLength(10);
  });

  it('honors a custom repeat count', () => {
    const css = buildOverrideCss({ ...baseOpts, repeat: 3 });
    const fontSizeSelector = css.split('{')[0]!;
    expect(fontSizeSelector.match(/\[data-tsa-scaled\]/g)).toHaveLength(3);
  });

  it('clamps repeat to at least 1', () => {
    const css = buildOverrideCss({ ...baseOpts, repeat: 0 });
    const fontSizeSelector = css.split('{')[0]!;
    expect(fontSizeSelector.match(/\[data-tsa-scaled\]/g)).toHaveLength(1);
  });

  it('references the factor variable with a fallback of 1', () => {
    const css = buildOverrideCss(baseOpts);
    expect(css).toContain('var(--tsa-k, 1)');
  });

  it('multiplies the base size and line-height variables, marked !important', () => {
    const css = buildOverrideCss(baseOpts);
    expect(css).toContain('font-size:calc(var(--tsa-fz0) * var(--tsa-k, 1))!important');
    expect(css).toContain('line-height:calc(var(--tsa-lh0) * var(--tsa-k, 1))!important');
  });

  it('produces a separate rule for the line-height attribute selector', () => {
    const css = buildOverrideCss(baseOpts);
    const lineHeightSelector = css.split('\n')[1]!.split('{')[0]!;
    expect(lineHeightSelector.match(/\[data-tsa-lh\]/g)).toHaveLength(10);
  });
});
