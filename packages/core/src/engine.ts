import type { EngineOptions, EngineChangeEvent, EngineListener, TextSizeEngine } from './types.js';
import { clampFactor } from './clamp.js';
import { captureElements, releaseElements } from './capture.js';
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
 * Elements that never render text of their own: everything that lives in <head>, line-break
 * opportunities, and inert containers. Capturing them only adds attribute churn.
 */
const NON_TEXT_TAGS = new Set([
  'HEAD', 'META', 'TITLE', 'STYLE', 'SCRIPT', 'LINK', 'BASE', 'NOSCRIPT', 'TEMPLATE', 'BR', 'WBR',
]);
const SVG_NS = 'http://www.w3.org/2000/svg';
/** How long the viewport width has to stay put before sizes are captured again. */
const RECAPTURE_DELAY_MS = 250;

/** A child engine for an open shadow root or a same-origin iframe's document. */
interface Child {
  engine: TextSizeEngine;
  root: Document | ShadowRoot;
  /** The iframe whose document `root` is, for iframe children. */
  iframe?: HTMLIFrameElement;
}

/**
 * Creates a text-scaling engine for `options.root` (defaults to `document`). A child engine is
 * created automatically for every open shadow root and reachable same-origin iframe document
 * discovered within the root, and kept in lock-step with the parent's factor — this is what lets
 * `setFactor` scale a whole page, shadow DOM and same-origin iframes included, from one call.
 */
export function createEngine(options: EngineOptions = {}): TextSizeEngine {
  return createEngineFor(options, false);
}

/**
 * `followsPage` is for the child engine of a shadow root: it doesn't set the factor variable on
 * its host, because the host inherits it from the page's root element, which the engine that
 * created this one keeps at the same factor. A copy on the host would stay at the scaled factor
 * while the page's engine reads unscaled sizes (see `captureElements`), so the host's own
 * children, which that engine captures, would be read scaled and then scaled once more.
 */
function createEngineFor(options: EngineOptions, followsPage: boolean): TextSizeEngine {
  const opts = { ...DEFAULTS, ...options };
  const root: Document | ShadowRoot = options.root ?? document;
  // `root instanceof Document` would silently be false for a same-origin iframe's document: it's
  // an instance of *that frame's own* Document constructor, not this realm's, since each frame
  // has its own global scope. nodeType is a plain number, unaffected by which realm's
  // constructors are in scope, so it's the realm-safe way to tell Document from ShadowRoot here.
  const isDocument = root.nodeType === 9; // Node.DOCUMENT_NODE
  const doc = isDocument ? (root as Document) : root.ownerDocument;
  if (!doc) throw new Error('createEngine: root has no owner document');

  const shadowHost = isDocument ? null : (root as ShadowRoot).host;

  /**
   * Where the factor variable lives: the shadow host, or the document's *current* root element.
   * Read on every use rather than once, because `document.open()` (e.g. `document.write` into an
   * about:blank iframe) replaces a document's root element.
   */
  function styleTarget(): HTMLElement | null {
    return (shadowHost ?? doc!.documentElement) as HTMLElement | null;
  }

  let factor = 1;
  let attached = false;
  let observer: MutationObserver | null = null;
  const listeners = new Set<EngineListener>();
  const children = new Set<Child>();
  /** The child engine for each iframe's current document (absent: none, or not reachable). */
  const iframeChildren = new Map<HTMLIFrameElement, Child>();
  const scannedShadowHosts = new WeakSet<Element>();
  /** Custom element names this engine is waiting to see defined (see watchForDefinition). */
  const awaitedTags = new Set<string>();
  /** Iframes that have a `load` listener — not "done": a frame is re-examined on every load. */
  const watchedIframes = new WeakSet<Element>();

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

  /**
   * Whether an element's text size is captured. Not the document's root element: each element
   * gets its own size, so text never needs the root scaled, and the root's font size is what
   * `rem` resolves against — pages size layout in rem too (widths, grid tracks, gaps), which would
   * otherwise grow with the text and spill sideways (FR1.3). Not SVG either: an SVG is a picture
   * (a logo, a chart), and pictures keep their size.
   */
  function isScalable(el: Element): boolean {
    return (
      !el.hasAttribute(opts.scaledAttr) &&
      el !== doc!.documentElement &&
      !NON_TEXT_TAGS.has(el.tagName) &&
      el.namespaceURI !== SVG_NS
    );
  }

  function captureNew(elements: Element[]): void {
    const target = styleTarget();
    if (!target) return;
    const unscaled = elements.filter(isScalable);
    if (unscaled.length === 0) return;
    captureElements(unscaled, target, FACTOR_VAR, { scaledAttr: opts.scaledAttr, scaled: factor !== 1 });
    // A root element that replaced the one the factor was written to (document.open) starts
    // without the variable.
    if (factor !== 1 && !followsPage) target.style.setProperty(FACTOR_VAR, String(factor));
  }

  function attachChildFor(childRoot: Document | ShadowRoot, iframe?: HTMLIFrameElement): Child {
    // An iframe's document has a root element of its own; a shadow root's host inherits ours.
    const engine = createEngineFor({ ...options, root: childRoot }, !iframe);
    const child: Child = { engine, root: childRoot, iframe };
    children.add(child);
    child.engine.setFactor(factor);
    child.engine.attach();
    return child;
  }

  /**
   * Forgets a child engine. Its document may already be gone: in Firefox's content scripts, a
   * navigated-away frame's document becomes a "dead object" whose every use throws, so this (and
   * every other call into a child) must never let that escape and break the parent.
   */
  function dropChild(child: Child): void {
    children.delete(child);
    if (child.iframe && iframeChildren.get(child.iframe) === child) iframeChildren.delete(child.iframe);
    try {
      child.engine.detach();
    } catch {
      // dead document: nothing left to detach from
    }
  }

  /**
   * A custom element that's in the page before its definition has loaded (code-split components,
   * lazy widgets) gets its shadow root only when it's upgraded, which no MutationObserver on the
   * document sees. So for each not-yet-defined custom element name, wait for the definition and
   * then look at that name's elements again. (Shadow roots attached at some other later moment are
   * still missed — a documented limitation.)
   */
  function watchForDefinition(el: Element): void {
    const name = el.localName;
    if (!name.includes('-') || awaitedTags.has(name)) return;
    let registry: CustomElementRegistry | null | undefined;
    try {
      registry = doc!.defaultView?.customElements;
      if (!registry || registry.get(name)) return;
    } catch {
      return; // not available here (e.g. some extension content-script contexts)
    }
    awaitedTags.add(name);
    registry
      .whenDefined(name)
      .then(() => {
        awaitedTags.delete(name);
        if (!attached) return;
        const hosts = Array.from(root.querySelectorAll(name)).filter((host) => !isIgnored(host));
        discoverChildrenIn(hosts);
      })
      .catch(() => {});
  }

  /** Scans the given elements (not their ancestors) for open shadow roots and same-origin iframes. */
  function discoverChildrenIn(elements: Iterable<Element>): void {
    for (const el of elements) {
      watchForDefinition(el);
      const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (shadow && !scannedShadowHosts.has(el)) {
        scannedShadowHosts.add(el);
        attachChildFor(shadow);
      }
      if (el.tagName === 'IFRAME' && !watchedIframes.has(el)) {
        watchedIframes.add(el);
        const iframe = el as HTMLIFrameElement;
        // Not `once`: every navigation of the frame brings a new document to adopt.
        iframe.addEventListener('load', () => {
          if (attached) adoptIframeDocument(iframe);
        });
        adoptIframeDocument(iframe);
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

  /**
   * Every iframe starts out with a same-origin, already complete about:blank document, which
   * an iframe with a real `src` (or `srcdoc`) replaces once its content arrives — possibly from
   * another origin. Adopting that placeholder would scale nothing that matters.
   */
  function isPlaceholder(iframe: HTMLIFrameElement, childDoc: Document): boolean {
    if (childDoc.URL !== 'about:blank') return false;
    if (iframe.hasAttribute('srcdoc')) return true;
    const src = iframe.getAttribute('src');
    return !!src && src.trim() !== '' && iframe.src !== 'about:blank';
  }

  /** Points the iframe's child engine at the frame's current document, if it's reachable. */
  function adoptIframeDocument(iframe: HTMLIFrameElement): void {
    const childDoc = readSameOriginContentDocument(iframe);
    const current = iframeChildren.get(iframe);
    if (current && current.root === childDoc) return;
    if (current) dropChild(current);
    // A document still loading gets its turn at the frame's `load` event.
    if (!childDoc || childDoc.readyState === 'loading' || isPlaceholder(iframe, childDoc)) return;
    iframeChildren.set(iframe, attachChildFor(childDoc, iframe));
  }

  function applyFactor(k: number, eventType: 'change' | 'reset'): number {
    // Rounded so repeated ±step arithmetic (1 + 0.1 - 0.1 = 1.0000000000000002) lands back on
    // exact values — "back to 100%" must compare equal to 1.
    factor = Math.round(clampFactor(k, opts.min, opts.max) * 1000) / 1000;
    if (!followsPage) styleTarget()?.style.setProperty(FACTOR_VAR, String(factor));
    // One unreachable child (a frame that navigated away or was removed) must never stop the
    // rest of the page, or the change notification below, from happening (code review C1).
    for (const child of Array.from(children)) {
      if (child.iframe && !child.iframe.isConnected) {
        dropChild(child);
        continue;
      }
      try {
        child.engine.setFactor(factor);
      } catch {
        dropChild(child);
      }
    }
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

  /**
   * Captured sizes are fixed pixels, so viewport-relative sizes (`vw`) and media queries stop
   * applying once captured. When the viewport's width changes (a phone rotated, a window resized
   * or split), let go of every element and capture again from the page's own current styling.
   * Height-only changes (a phone's address bar sliding away while scrolling) are ignored.
   */
  const win = doc.defaultView;
  let capturedWidth = 0;
  let recaptureTimer: ReturnType<typeof setTimeout> | undefined;

  function recapture(): void {
    recaptureTimer = undefined;
    if (!attached || !win || win.innerWidth === capturedWidth) return;
    capturedWidth = win.innerWidth;
    releaseElements(Array.from(root.querySelectorAll(`[${opts.scaledAttr}]`)), FACTOR_VAR, opts);
    rescan();
  }

  function onResize(): void {
    if (recaptureTimer !== undefined) clearTimeout(recaptureTimer);
    recaptureTimer = setTimeout(recapture, RECAPTURE_DELAY_MS);
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
    for (const child of Array.from(children)) {
      try {
        child.engine.attach();
      } catch {
        dropChild(child);
      }
    }
    capturedWidth = win?.innerWidth ?? 0;
    rescan();
    startObserving();
    win?.addEventListener('resize', onResize);
  }

  function detach(): void {
    attached = false;
    observer?.disconnect();
    observer = null;
    win?.removeEventListener('resize', onResize);
    if (recaptureTimer !== undefined) clearTimeout(recaptureTimer);
    recaptureTimer = undefined;
    for (const child of Array.from(children)) {
      try {
        child.engine.detach();
      } catch {
        dropChild(child);
      }
    }
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
