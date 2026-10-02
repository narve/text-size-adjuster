import { isPxLineHeight } from './line-height.js';

export interface CaptureOptions {
  scaledAttr: string;
  lineHeightAttr: string;
  baseSizeVar: string;
  baseLineHeightVar: string;
}

/**
 * Captures each element's *unscaled* computed font-size (and px line-height) and stores it as a
 * per-element CSS custom property, so the injected override rule can reapply `original * factor`
 * without ever needing to re-walk the DOM to change the factor later (see `engine.ts`).
 *
 * All reads happen before any writes (read phase, then write phase) to avoid layout-thrashing —
 * interleaving `getComputedStyle` with style mutations forces a synchronous reflow per element on
 * a large page.
 *
 * `styleTarget`'s `factorVar` is temporarily forced to `1` for the duration of the read phase.
 * Without this, an element that merely *inherits* font-size (rather than declaring its own) would
 * read an already-scaled value when this runs after the first scale change (e.g. via the
 * MutationObserver path in `engine.ts`), and capturing that as its "original" size would
 * compound the scaling on every subsequent change.
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
    htmlEl.style.setProperty(opts.baseSizeVar, fontSize);
    el.setAttribute(opts.scaledAttr, '');
    if (isPxLineHeight(lineHeight)) {
      htmlEl.style.setProperty(opts.baseLineHeightVar, lineHeight);
      el.setAttribute(opts.lineHeightAttr, '');
    }
  }

  if (prevFactor) styleTarget.style.setProperty(factorVar, prevFactor);
  else styleTarget.style.removeProperty(factorVar);
}
