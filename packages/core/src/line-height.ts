/**
 * Per the CSSOM resolved-value algorithm, `line-height: normal` is the one case whose resolved
 * value stays the literal keyword `"normal"` — safe to leave untouched, since its *rendered*
 * height already tracks font-size on its own. Every other declaration (an explicit length like
 * `24px`, *and*, somewhat surprisingly, a unitless multiplier like `1.5`) resolves through
 * `getComputedStyle` to a used pixel value instead of staying as authored — confirmed empirically
 * against real Firefox/Chromium in the Layer 1 Playwright suite, which is why this only special-
 * cases `normal` rather than trying to detect "was this unitless" from the resolved string.
 * Capturing and rescaling that resolved px value (rather than leaving it alone) reproduces
 * exactly what the browser would already do on its own as font-size changes, so there's no
 * behavioral difference — it just makes the rescaling explicit instead of incidental.
 */
export function isPxLineHeight(computedLineHeight: string): boolean {
  return computedLineHeight.endsWith('px');
}
