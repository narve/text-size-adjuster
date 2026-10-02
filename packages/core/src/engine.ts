import type { EngineOptions, EngineChangeEvent, EngineListener, TextSizeEngine } from './types.js';
import { clampFactor } from './clamp.js';
import { captureElements } from './capture.js';
import { DEFAULT_IGNORE_ATTR, DEFAULT_SCALED_ATTR } from './constants.js';

const DEFAULTS = {
  min: 0.5,
  max: 3,
  step: 0.1,
  scaledAttr: DEFAULT_SCALED_ATTR,
  ignoreAttr: DEFAULT_IGNORE_ATTR,
};

const FACTOR_VAR = '--tsa-k';

/**
 * Creates a text-scaling engine for `options.root` (defaults to `document`). A child engine is
 * created automatically for every open shadow root and reachable same-origin iframe document
 * discovered within the root, and kept in lock-step with the parent's factor — this is what lets
 * `setFactor` scale a whole page, shadow DOM and same-origin iframes included, from one call.
 */
export function createEngine(options: EngineOptions = {}): TextSizeEngine {
  const opts = { ...DEFAULTS, ...options };
  const root: Document | ShadowRoot = options.root ?? document;
  // `root instanceof Document` would silently be false for a same-origin iframe's document: it's
  // an instance of *that frame's own* Document constructor, not this realm's, since each frame
  // has its own global scope. nodeType is a plain number, unaffected by which realm's
  // constructors are in scope, so it's the realm-safe way to tell Document from ShadowRoot here.
  const isDocument = root.nodeType === 9; // Node.DOCUMENT_NODE
  const doc = isDocument ? (root as Document) : root.ownerDocument;
  if (!doc) throw new Error('createEngine: root has no owner document');

  const styleTarget = (isDocument ? (root as Document).documentElement : (root as ShadowRoot).host) as HTMLElement;

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
    captureElements(unscaled, styleTarget, FACTOR_VAR, { scaledAttr: opts.scaledAttr });
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

  /**
   * Only the `contentDocument` read is wrapped in a try/catch — that's the one part that can
   * legitimately fail for a cross-origin iframe (FR6.1), and should fail silently. Anything that
   * goes wrong inside `attachChildFor` afterwards is a real bug and should surface normally
   * rather than being swallowed along with the expected cross-origin case.
   */
  function readSameOriginContentDocument(iframe: HTMLIFrameElement): Document | null {
    try {
      return iframe.contentDocument;
    } catch {
      return null; // cross-origin: inaccessible by design, skip silently (FR6.1)
    }
  }

  function attachIframe(iframe: HTMLIFrameElement): void {
    const childDoc = readSameOriginContentDocument(iframe);
    if (!childDoc) return;
    if (childDoc.readyState === 'loading') {
      iframe.addEventListener(
        'load',
        () => {
          const doc = readSameOriginContentDocument(iframe);
          if (doc) attachChildFor(doc);
        },
        { once: true },
      );
    } else {
      attachChildFor(childDoc);
    }
  }

  function applyFactor(k: number, eventType: 'change' | 'reset'): number {
    // Rounded so repeated ±step arithmetic (1 + 0.1 - 0.1 = 1.0000000000000002) lands back on
    // exact values — "back to 100%" must compare equal to 1.
    factor = Math.round(clampFactor(k, opts.min, opts.max) * 1000) / 1000;
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

  /** True for an element inside (or equal to) an `ignoreAttr`-marked subtree (see EngineOptions). */
  function isIgnored(el: Element): boolean {
    return el.closest(`[${opts.ignoreAttr}]`) !== null;
  }

  function rescan(): void {
    const elements = Array.from(root.querySelectorAll('*')).filter((el) => !isIgnored(el));
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
      const relevant = added.filter((el) => !isIgnored(el));
      if (relevant.length === 0) return;
      captureNew(relevant);
      discoverChildrenIn(relevant);
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
