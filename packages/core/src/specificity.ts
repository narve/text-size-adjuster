export interface OverrideCssOptions {
  scaledAttr: string;
  lineHeightAttr: string;
  factorVar: string;
  baseSizeVar: string;
  baseLineHeightVar: string;
  /** How many times to repeat the attribute selector to stack specificity. Default 10. */
  repeat?: number;
}

/**
 * Builds the injected override rule. `!important` alone doesn't guarantee a win against a page
 * rule that's also `!important` with higher specificity (e.g. an ID selector) — specificity is
 * still compared among `!important` declarations. Repeating the same attribute selector N times
 * stacks specificity without changing what it matches, which beats realistic page rules
 * (including ID+class combinations) without resorting to brittle tricks. It cannot beat a
 * literal inline `style="...!important"` on the element itself — CSS gives that the highest
 * possible priority regardless of any stylesheet's specificity. That narrower case is an
 * accepted, documented limitation (see docs/functional-requirements.md FR6.4).
 */
export function buildOverrideCss(opts: OverrideCssOptions): string {
  const repeat = Math.max(1, opts.repeat ?? 10);
  const sizeSelector = `[${opts.scaledAttr}]`.repeat(repeat);
  const lhSelector = `[${opts.lineHeightAttr}]`.repeat(repeat);
  return (
    `${sizeSelector}{font-size:calc(var(${opts.baseSizeVar}) * var(${opts.factorVar}, 1))!important}\n` +
    `${lhSelector}{line-height:calc(var(${opts.baseLineHeightVar}) * var(${opts.factorVar}, 1))!important}`
  );
}
