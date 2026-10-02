import { isPxLineHeight } from './line-height.js';

export interface CaptureOptions {
  scaledAttr: string;
}

/**
 * Captures each element's *unscaled* computed font-size (and px line-height) and reapplies it as
 * an inline `calc(original * factor) !important` style.
 *
 * An inline `!important` declaration (rather than a shared stylesheet rule matched by selector)
 * means CSS specificity never has to be fought: an element's own inline `!important` outranks
 * every external stylesheet declaration regardless of its specificity, including ID-selector
 * `!important` rules. (An earlier version of this tried to win via a high-specificity injected
 * selector — repeating an attribute selector many times — but CSS specificity is tiered, not
 * additive: any number of class/attribute selectors still loses to a single ID selector, so that
 * approach silently failed against ID-based page rules. Confirmed broken by the
 * `important-high-specificity` fixture in the Layer 1 Playwright suite before switching to this.)
 * The one thing that still beats an inline `!important` is the page's own *inline* `!important`
 * on that same element — an accepted, documented limitation (FR6.4).
 *
 * All reads happen before any writes (read phase, then write phase) to avoid layout-thrashing —
 * interleaving `getComputedStyle` with style mutations forces a synchronous reflow per element on
 * a large page.
 *
 * `styleTarget`'s `factorVar` is temporarily forced to `1` for the duration of the read phase.
 * Without this, an element that merely *inherits* font-size (rather than declaring its own) would
 * read an already-scaled value when this runs after the first scale change (e.g. via the
 * MutationObserver path in `engine.ts`), and capturing that as its "original" size would compound
 * the scaling on every subsequent change.
 */
export function captureElements(
  elements: Element[],
  styleTarget: HTMLElement,
  factorVar: string,
  opts: CaptureOptions,
): void {
  if (elements.length === 0) return;

  const prevFactor = styleTarget.style.getPropertyValue(factorVar);
  styleTarget.style.setProperty(factorVar, '1');

  const reads = elements.map((el) => {
    const computed = getComputedStyle(el);
    return { el, fontSize: computed.fontSize, lineHeight: computed.lineHeight };
  });

  for (const { el, fontSize, lineHeight } of reads) {
    const htmlEl = el as HTMLElement;
    htmlEl.style.setProperty('font-size', `calc(${fontSize} * var(${factorVar}, 1))`, 'important');
    if (isPxLineHeight(lineHeight)) {
      htmlEl.style.setProperty(
        'line-height',
        `calc(${lineHeight} * var(${factorVar}, 1))`,
        'important',
      );
    }
    el.setAttribute(opts.scaledAttr, '');
  }

  if (prevFactor) styleTarget.style.setProperty(factorVar, prevFactor);
  else styleTarget.style.removeProperty(factorVar);
}
