import type { TextSizeEngine, UIAdapter } from '@tsa/core';
import { DEFAULT_IGNORE_ATTR } from '@tsa/core';
import { WIDGET_CSS } from './widget-styles.js';
import { DEFAULT_POSITION, formatFactor, type WidgetPosition, type WidgetSettings, type WidgetVisibility } from './settings.js';
import { followVisualViewport, watchForZoom } from './viewport.js';

export interface FloatingWidgetOptions {
  /** Where the widget's host element is appended. Defaults to `document`. */
  root?: Document | ShadowRoot;
  /** Which corner of the viewport the control sits in (FR10.1). Default bottom-right. */
  position?: WidgetPosition;
  /** `always`, or hidden until the user zooms in (FR10.2). Default `always`. */
  show?: WidgetVisibility;
  /**
   * Opens the delivery's settings. When given, the control gets a gear button that calls it; only
   * the extension has a settings page to open (FR9.6).
   */
  onOpenSettings?: () => void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * A gear drawn with three circles (hub, rim, and a dashed outer ring for the teeth) rather than
 * the ⚙ character, which phones tend to show as a colour emoji.
 */
function createGearIcon(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const circles: Array<[radius: number, width: number, dashes?: string]> = [
    [2.5, 2],
    [6.5, 2],
    [9.5, 3, '3.73 3.73'],
  ];
  for (const [radius, width, dashes] of circles) {
    const circle = doc.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', String(radius));
    circle.setAttribute('stroke-width', String(width));
    if (dashes) circle.setAttribute('stroke-dasharray', dashes);
    svg.append(circle);
  }
  return svg;
}

export interface FloatingWidget extends UIAdapter {
  /** False after `×`, and while a control shown `on-zoom` still waits for the zoom. */
  isVisible(): boolean;
}

/**
 * An in-page floating +/- widget, rendered in its own shadow root for isolation from the host
 * page's CSS. This is the only UI available to the userscript (userscript managers have no
 * toolbar-button API) and is also usable by the extension (FR4.2).
 *
 * The host element carries `data-tsa-ignore` so the engine never captures or rescales the
 * widget's own text — see `createEngine`'s `ignoreAttr` option. This is a generic engine
 * mechanism, not special-cased to this widget; any UI could use the same convention.
 */
export function createFloatingWidget(options: FloatingWidgetOptions = {}): FloatingWidget {
  let hostEl: HTMLElement | null = null;
  let panelEl: HTMLElement | null = null;
  let shadow: ShadowRoot | null = null;
  let unsubscribe: (() => void) | null = null;
  const cleanups: Array<() => void> = [];

  function render(engine: TextSizeEngine): void {
    const display = shadow?.querySelector('[data-tsa-display]');
    if (display) display.textContent = formatFactor(engine.getFactor());
  }

  function mount(engine: TextSizeEngine): void {
    if (hostEl) return;

    const root = options.root ?? document;
    const doc = root instanceof Document ? root : root.ownerDocument;
    if (!doc) return;

    hostEl = doc.createElement('div');
    hostEl.setAttribute(DEFAULT_IGNORE_ATTR, '');
    shadow = hostEl.attachShadow({ mode: 'open' });

    // Built via createElement/textContent rather than innerHTML — avoids the dynamic-innerHTML
    // pattern AMO review (and web-ext lint) flags, even though WIDGET_CSS here is our own
    // constant, not untrusted input.
    const style = doc.createElement('style');
    style.textContent = WIDGET_CSS;

    const panel = doc.createElement('div');
    panel.className = 'tsa-widget';
    panel.dataset.position = options.position ?? DEFAULT_POSITION;
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'Text size controls');

    function makeButton(action: string, ariaLabel: string, symbol: string, title?: string): HTMLButtonElement {
      const button = doc.createElement('button');
      button.type = 'button';
      button.dataset.action = action;
      button.setAttribute('aria-label', ariaLabel);
      if (title) button.title = title;
      button.textContent = symbol;
      return button;
    }

    const display = doc.createElement('span');
    display.setAttribute('data-tsa-display', '');
    display.setAttribute('aria-live', 'polite');
    display.textContent = '100%';

    panel.append(
      makeButton('decrease', 'Decrease text size', '−'),
      display,
      makeButton('increase', 'Increase text size', '+'),
      makeButton('reset', 'Reset text size', '↺', 'Reset'),
    );
    if (options.onOpenSettings) {
      const settings = makeButton('settings', 'Text size settings', '', 'Settings');
      settings.append(createGearIcon(doc));
      panel.append(settings);
    }
    panel.append(makeButton('close', 'Hide text size controls', '×', 'Hide'));

    shadow.append(style, panel);
    panelEl = panel;

    shadow.addEventListener('click', (event) => {
      const target = event.target as Element;
      const action = target.closest('[data-action]')?.getAttribute('data-action');
      switch (action) {
        case 'increase':
          engine.increase();
          break;
        case 'decrease':
          engine.decrease();
          break;
        case 'reset':
          engine.reset();
          break;
        case 'settings':
          options.onOpenSettings?.();
          break;
        case 'close':
          unmount();
          break;
      }
    });

    unsubscribe = engine.onChange(() => render(engine));
    render(engine);

    const container = root instanceof Document ? (root.body ?? root.documentElement) : root;
    container.appendChild(hostEl);

    // Only now that the panel is in the page: followVisualViewport measures it, and it has no
    // size before.
    const win = doc.defaultView;
    const position = options.position ?? DEFAULT_POSITION;
    if (win) {
      // Registered before followVisualViewport on purpose: both react to the same `resize`
      // events, and the panel has to be revealed first or the positioning measures it at zero
      // size.
      if (options.show === 'on-zoom') {
        panel.hidden = true;
        const stopWatching = watchForZoom(win, () => {
          panel.hidden = false;
          stopWatching();
        });
        cleanups.push(stopWatching);
      }
      cleanups.push(followVisualViewport(win, panel, position));
    }
  }

  function unmount(): void {
    unsubscribe?.();
    unsubscribe = null;
    for (const cleanup of cleanups.splice(0)) cleanup();
    hostEl?.remove();
    hostEl = null;
    panelEl = null;
    shadow = null;
  }

  return { mount, unmount, isVisible: () => panelEl !== null && !panelEl.hidden };
}

export interface RemountableWidget {
  apply(settings: WidgetSettings): void;
  isVisible(): boolean;
  /**
   * Brings the control back, where it was, after `×`, or before the zoom an `on-zoom` control
   * waits for: asking for it is a request to see it now. Does nothing before the first `apply`.
   */
  show(): void;
}

/**
 * A floating widget that can be re-created with new settings (FR9.3/FR10.3: a settings change
 * applies to the open page straight away). The first `apply` mounts it. `extras` are the options
 * that aren't settings and stay the same across re-creations.
 */
export function createRemountableWidget(
  engine: TextSizeEngine,
  extras: Pick<FloatingWidgetOptions, 'onOpenSettings'> = {},
): RemountableWidget {
  let widget: FloatingWidget | null = null;
  let applied: WidgetSettings | null = null;
  function apply(settings: WidgetSettings): void {
    applied = settings;
    widget?.unmount();
    widget = createFloatingWidget({ ...settings, ...extras });
    widget.mount(engine);
  }
  return {
    apply,
    isVisible: () => widget?.isVisible() ?? false,
    show() {
      if (applied && !widget?.isVisible()) apply({ ...applied, show: 'always' });
    },
  };
}
