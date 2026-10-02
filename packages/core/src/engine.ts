import type { EngineOptions, EngineChangeEvent, EngineListener, TextSizeEngine } from './types.js';
import { clampFactor } from './clamp.js';
import { buildOverrideCss } from './specificity.js';
import { ensureStyleSheet } from './style-injector.js';
import { captureElements } from './capture.js';

const DEFAULTS = {
  min: 0.5,
  max: 3,
  step: 0.1,
  scaledAttr: 'data-tsa-scaled',
  lineHeightAttr: 'data-tsa-lh',
};

const FACTOR_VAR = '--tsa-k';
const BASE_SIZE_VAR = '--tsa-fz0';
const BASE_LH_VAR = '--tsa-lh0';
const STYLE_ID = 'tsa-style';

/**
 * Creates a text-scaling engine for `options.root` (defaults to `document`). A child engine is
 * created automatically for every open shadow root and reachable same-origin iframe document
 * discovered within the root, and kept in lock-step with the parent's factor — this is what lets
 * `setFactor` scale a whole page, shadow DOM and same-origin iframes included, from one call.
 */
export function createEngine(options: EngineOptions = {}): TextSizeEngine {
  const opts = { ...DEFAULTS, ...options };
  const root: Document | ShadowRoot = options.root ?? document;
  const doc = root instanceof Document ? root : root.ownerDocument;
  if (!doc) throw new Error('createEngine: root has no owner document');

  const styleTarget = (root instanceof Document ? root.documentElement : root.host) as HTMLElement;

  const overrideCss = buildOverrideCss({
    scaledAttr: opts.scaledAttr,
    lineHeightAttr: opts.lineHeightAttr,
    factorVar: FACTOR_VAR,
    baseSizeVar: BASE_SIZE_VAR,
    baseLineHeightVar: BASE_LH_VAR,
  });

  let factor = 1;
  let attached = false;
  let observer: MutationObserver | null = null;
  const listeners = new Set<EngineListener>();
  const children = new Set<TextSizeEngine>();
  const scannedShadowHosts = new WeakSet<Element>();
  const scannedIframes = new WeakSet<Element>();

  function origin(): string {
    try {
      return doc!.defaultView?.location.origin ?? 'null';
    } catch {
      return 'null';
    }
  }

  function notify(type: 'change' | 'reset'): void {
    const event: EngineChangeEvent = { type, factor, origin: origin() };
    for (const listener of listeners) listener(event);
  }

  function captureNew(elements: Element[]): void {
    const unscaled = elements.filter((el) => !el.hasAttribute(opts.scaledAttr));
    if (unscaled.length === 0) return;
    ensureStyleSheet(root, STYLE_ID, overrideCss);
    captureElements(unscaled, styleTarget, FACTOR_VAR, {
      scaledAttr: opts.scaledAttr,
      lineHeightAttr: opts.lineHeightAttr,
      baseSizeVar: BASE_SIZE_VAR,
      baseLineHeightVar: BASE_LH_VAR,
    });
  }

  function attachChildFor(childRoot: Document | ShadowRoot): void {
    const child = createEngine({ ...options, root: childRoot });
    children.add(child);
    child.setFactor(factor);
    child.attach();
  }

  /** Scans the given elements (not their ancestors) for open shadow roots and same-origin iframes. */
  function discoverChildrenIn(elements: Iterable<Element>): void {
    for (const el of elements) {
      const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (shadow && !scannedShadowHosts.has(el)) {
        scannedShadowHosts.add(el);
        attachChildFor(shadow);
      }
      if (el.tagName === 'IFRAME' && !scannedIframes.has(el)) {
        scannedIframes.add(el);
        attachIframe(el as HTMLIFrameElement);
      }
    }
  }

  function attachIframe(iframe: HTMLIFrameElement): void {
    try {
      const childDoc = iframe.contentDocument;
      if (!childDoc) return; // cross-origin: inaccessible by design (FR6.1), skip silently
      if (childDoc.readyState === 'loading') {
        iframe.addEventListener(
          'load',
          () => {
            try {
              if (iframe.contentDocument) attachChildFor(iframe.contentDocument);
            } catch {
              /* became cross-origin after a redirect; ignore */
            }
          },
          { once: true },
        );
      } else {
        attachChildFor(childDoc);
      }
    } catch {
      // cross-origin iframe: `contentDocument` access throws, skip silently (FR6.1)
    }
  }

  function applyFactor(k: number, eventType: 'change' | 'reset'): number {
    factor = clampFactor(k, opts.min, opts.max);
    styleTarget.style.setProperty(FACTOR_VAR, String(factor));
    for (const child of children) child.setFactor(factor);
    notify(eventType);
    return factor;
  }

  function setFactor(k: number): number {
    return applyFactor(k, 'change');
  }

  function increase(step: number = opts.step): number {
    return setFactor(factor + step);
  }

  function decrease(step: number = opts.step): number {
    return setFactor(factor - step);
  }

  function reset(): number {
    return applyFactor(1, 'reset');
  }

  function rescan(): void {
    const elements = Array.from(root.querySelectorAll('*'));
    captureNew(elements);
    discoverChildrenIn(elements);
  }

  function startObserving(): void {
    observer = new MutationObserver((mutations) => {
      const added: Element[] = [];
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          const el = node as Element;
          added.push(el);
          el.querySelectorAll('*').forEach((descendant) => added.push(descendant));
        });
      }
      if (added.length === 0) return;
      captureNew(added);
      discoverChildrenIn(added);
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function attach(): void {
    if (attached) return;
    attached = true;
    rescan();
    startObserving();
  }

  function detach(): void {
    attached = false;
    observer?.disconnect();
    observer = null;
    for (const child of children) child.detach();
  }

  function onChange(listener: EngineListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    increase,
    decrease,
    reset,
    setFactor,
    getFactor: () => factor,
    onChange,
    attach,
    detach,
    rescan,
  };
}
