/**
 * Per the CSS spec, the *computed* value of `line-height` stays a bare number for a unitless
 * declaration (e.g. `1.5`) and stays `normal` for the keyword — both already scale automatically
 * as font-size changes. Only a `px`-resolved computed value (from an explicit length, or
 * inherited from an ancestor's length) needs to be captured and rescaled explicitly.
 */
export function isPxLineHeight(computedLineHeight: string): boolean {
  return computedLineHeight.endsWith('px');
}
