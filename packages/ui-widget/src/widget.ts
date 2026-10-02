import type { TextSizeEngine, UIAdapter } from '@tsa/core';
import { DEFAULT_IGNORE_ATTR } from '@tsa/core';
import { WIDGET_CSS } from './widget-styles.js';

export interface FloatingWidgetOptions {
  /** Where the widget's host element is appended. Defaults to `document`. */
  root?: Document | ShadowRoot;
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
export function createFloatingWidget(options: FloatingWidgetOptions = {}): UIAdapter {
  let hostEl: HTMLElement | null = null;
  let shadow: ShadowRoot | null = null;
  let unsubscribe: (() => void) | null = null;

  function render(engine: TextSizeEngine): void {
    const display = shadow?.querySelector('[data-tsa-display]');
    if (display) display.textContent = `${Math.round(engine.getFactor() * 100)}%`;
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
      makeButton('close', 'Hide text size controls', '×', 'Hide'),
    );

    shadow.append(style, panel);

    shadow.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
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
        case 'close':
          unmount();
          break;
      }
    });

    unsubscribe = engine.onChange(() => render(engine));
    render(engine);

    const container = root instanceof Document ? (root.body ?? root.documentElement) : root;
    container.appendChild(hostEl);
  }

  function unmount(): void {
    unsubscribe?.();
    unsubscribe = null;
    hostEl?.remove();
    hostEl = null;
    shadow = null;
  }

  return { mount, unmount };
}
