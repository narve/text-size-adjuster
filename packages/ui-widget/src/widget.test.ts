import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EngineListener, TextSizeEngine } from '@tsa/core';
import { DEFAULT_IGNORE_ATTR } from '@tsa/core';
import { createFloatingWidget } from './widget.js';

function createFakeEngine(initial = 1): TextSizeEngine & {
  emit(type: 'change' | 'reset', factor: number): void;
} {
  let factor = initial;
  const listeners = new Set<EngineListener>();
  return {
    increase: vi.fn((step = 0.1) => {
      factor += step;
      return factor;
    }),
    decrease: vi.fn((step = 0.1) => {
      factor -= step;
      return factor;
    }),
    reset: vi.fn(() => {
      factor = 1;
      return factor;
    }),
    setFactor: vi.fn((k: number) => {
      factor = k;
      return factor;
    }),
    getFactor: () => factor,
    onChange: (listener: EngineListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    attach: vi.fn(),
    detach: vi.fn(),
    rescan: vi.fn(),
    emit(type, f) {
      factor = f;
      for (const l of listeners) l({ type, factor, origin: 'https://example.com' });
    },
  };
}

function getHost(): HTMLElement | null {
  return document.body.querySelector(`[${DEFAULT_IGNORE_ATTR}]`);
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createFloatingWidget', () => {
  it('mounts a shadow-rooted host element marked for engine exclusion', () => {
    const widget = createFloatingWidget();
    widget.mount(createFakeEngine());

    const host = getHost();
    expect(host).not.toBeNull();
    expect(host?.shadowRoot).not.toBeNull();
    expect(host?.shadowRoot?.mode).toBe('open');
  });

  it('renders +/- /reset/close controls and the current percentage', () => {
    const widget = createFloatingWidget();
    widget.mount(createFakeEngine(1.5));

    const shadow = getHost()?.shadowRoot;
    expect(shadow?.querySelector('[data-action="increase"]')).not.toBeNull();
    expect(shadow?.querySelector('[data-action="decrease"]')).not.toBeNull();
    expect(shadow?.querySelector('[data-action="reset"]')).not.toBeNull();
    expect(shadow?.querySelector('[data-action="close"]')).not.toBeNull();
    expect(shadow?.querySelector('[data-tsa-display]')?.textContent).toBe('150%');
  });

  it('clicking + / - / reset drives the engine, not its own state', () => {
    const widget = createFloatingWidget();
    const engine = createFakeEngine();
    widget.mount(engine);
    const shadow = getHost()!.shadowRoot!;

    (shadow.querySelector('[data-action="increase"]') as HTMLElement).click();
    expect(engine.increase).toHaveBeenCalledTimes(1);

    (shadow.querySelector('[data-action="decrease"]') as HTMLElement).click();
    expect(engine.decrease).toHaveBeenCalledTimes(1);

    (shadow.querySelector('[data-action="reset"]') as HTMLElement).click();
    expect(engine.reset).toHaveBeenCalledTimes(1);
  });

  it('updates the displayed percentage when the engine reports a change', () => {
    const widget = createFloatingWidget();
    const engine = createFakeEngine();
    widget.mount(engine);
    const shadow = getHost()!.shadowRoot!;

    engine.emit('change', 2);

    expect(shadow.querySelector('[data-tsa-display]')?.textContent).toBe('200%');
  });

  it('removes the widget and stops listening when closed via its own button', () => {
    const widget = createFloatingWidget();
    const engine = createFakeEngine();
    widget.mount(engine);

    (getHost()!.shadowRoot!.querySelector('[data-action="close"]') as HTMLElement).click();

    expect(getHost()).toBeNull();
  });

  it('unmount() works the same way when called externally', () => {
    const widget = createFloatingWidget();
    widget.mount(createFakeEngine());
    widget.unmount();
    expect(getHost()).toBeNull();
  });

  it('mount() is idempotent — calling it twice does not create a second host', () => {
    const widget = createFloatingWidget();
    const engine = createFakeEngine();
    widget.mount(engine);
    widget.mount(engine);
    expect(document.body.querySelectorAll(`[${DEFAULT_IGNORE_ATTR}]`)).toHaveLength(1);
  });
});
