import { isPxLineHeight } from './line-height.js';

export interface CaptureOptions {
  scaledAttr: string;
}

export interface CaptureContext extends CaptureOptions {
  /**
   * Whether the text is currently scaled (a factor other than 1), wherever the factor variable is
   * set: on `styleTarget` or, for a shadow root that follows its page, further up.
   */
  scaled: boolean;
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
 * A page's own inline `!important` on the same element is simply replaced by `setProperty`. What
 * can still undo the scaling is a page script rewriting that element's `style` attribute later —
 * the MutationObserver only watches for added nodes (an accepted, documented limitation, FR6.4).
 *
 * The element's own inline font-size/line-height (if any) is recorded in the `scaledAttr`
 * attribute's value before being replaced, so `releaseElements` can put it back exactly. It lives
 * in the DOM rather than in this engine's memory because a frame can be scaled by more than one
 * engine instance (the top page's, and the frame's own content script's in the extension), each in
 * its own JS realm, and whichever of them releases an element needs the original.
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
 *
 * That only works if the sizes follow the variable at once. A page's own `transition` on
 * `font-size` (`transition: all` on links and buttons is common) would have the read return the
 * size the transition starts from: the scaled one. So while the text is scaled, transitions are
 * switched off on the elements being read and on their ancestors (whose size they may inherit),
 * and switched back on only after the styles have settled at the restored factor — otherwise the
 * way back would be animated on every capture.
 */
export function captureElements(
  elements: Element[],
  styleTarget: HTMLElement,
  factorVar: string,
  opts: CaptureContext,
): void {
  if (elements.length === 0) return;

  const restoreTransitions = opts.scaled ? suppressTransitions(elements, styleTarget) : null;

  const prevFactor = styleTarget.style.getPropertyValue(factorVar);
  styleTarget.style.setProperty(factorVar, '1');

  const reads = elements.map((el) => {
    const computed = getComputedStyle(el);
    return { el, fontSize: computed.fontSize, lineHeight: computed.lineHeight };
  });

  for (const { el, fontSize, lineHeight } of reads) {
    const htmlEl = el as HTMLElement;
    const original = recordOriginal(htmlEl);
    htmlEl.style.setProperty('font-size', `calc(${fontSize} * var(${factorVar}, 1))`, 'important');
    if (isPxLineHeight(lineHeight)) {
      htmlEl.style.setProperty(
        'line-height',
        `calc(${lineHeight} * var(${factorVar}, 1))`,
        'important',
      );
    }
    el.setAttribute(opts.scaledAttr, original);
  }

  if (prevFactor) styleTarget.style.setProperty(factorVar, prevFactor);
  else styleTarget.style.removeProperty(factorVar);

  if (restoreTransitions) {
    // Reading an element's style settles it and its ancestors: everything switched off above.
    for (const { el } of reads) void getComputedStyle(el).fontSize;
    restoreTransitions();
  }
}

/**
 * Switches transitions off, inline, on `elements`, their ancestors and `styleTarget`. Returns a
 * function that puts each element's own inline `transition-property` back.
 */
function suppressTransitions(elements: Element[], styleTarget: HTMLElement): () => void {
  const PROP = 'transition-property';
  const seen = new Set<Element>([styleTarget]);
  for (const el of elements) {
    for (let node: Element | null = el; node && !seen.has(node); node = node.parentElement) seen.add(node);
  }
  const saved: Array<[style: CSSStyleDeclaration, value: string, priority: string]> = [];
  for (const el of seen) {
    const style = (el as Partial<ElementCSSInlineStyle>).style;
    if (!style) continue;
    saved.push([style, style.getPropertyValue(PROP), style.getPropertyPriority(PROP)]);
    style.setProperty(PROP, 'none', 'important');
  }
  return () => {
    for (const [style, value, priority] of saved) {
      if (value) style.setProperty(PROP, value, priority);
      else style.removeProperty(PROP);
    }
  };
}

const SCALED_PROPS = ['font-size', 'line-height'] as const;
type ScaledProp = (typeof SCALED_PROPS)[number];
/** An element's own inline value and priority for each scaled property it had one for. */
type Original = Partial<Record<ScaledProp, [value: string, priority: string]>>;

/** The element's own inline declarations, as the `scaledAttr` value ('' when it had none). */
function recordOriginal(el: HTMLElement): string {
  const original: Original = {};
  for (const prop of SCALED_PROPS) {
    const value = el.style.getPropertyValue(prop);
    if (value) original[prop] = [value, el.style.getPropertyPriority(prop)];
  }
  return Object.keys(original).length > 0 ? JSON.stringify(original) : '';
}

function parseOriginal(raw: string | null): Original {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Original;
  } catch {
    return {};
  }
}

/**
 * Undoes `captureElements` for these elements: each scaled declaration that is still ours goes
 * back to the element's own original inline value (or is removed), and the marker attribute is
 * removed, so a later capture reads the page's own current styling again. A declaration a page
 * script has since replaced with its own is left as the page set it.
 */
export function releaseElements(elements: Element[], factorVar: string, opts: CaptureOptions): void {
  for (const el of elements) {
    const htmlEl = el as HTMLElement;
    const original = parseOriginal(el.getAttribute(opts.scaledAttr));
    for (const prop of SCALED_PROPS) {
      if (!htmlEl.style.getPropertyValue(prop).includes(`var(${factorVar}`)) continue;
      const own = original[prop];
      if (own) htmlEl.style.setProperty(prop, own[0], own[1]);
      else htmlEl.style.removeProperty(prop);
    }
    el.removeAttribute(opts.scaledAttr);
  }
}
