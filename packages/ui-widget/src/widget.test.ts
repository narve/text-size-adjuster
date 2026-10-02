import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_IGNORE_ATTR } from '@tsa/core';
import { createFakeEngine } from '@tsa/core/test-helpers';
import { createFloatingWidget } from './widget.js';

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

    engine.emit(2);

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

describe('placement', () => {
  function panelPosition(): string | undefined {
    return getHost()?.shadowRoot?.querySelector<HTMLElement>('.tsa-widget')?.dataset.position;
  }

  it('defaults to bottom-right', () => {
    createFloatingWidget().mount(createFakeEngine());
    expect(panelPosition()).toBe('bottom-right');
  });

  it('uses the requested corner', () => {
    createFloatingWidget({ position: 'top-left' }).mount(createFakeEngine());
    expect(panelPosition()).toBe('top-left');
  });
});

describe('visibility', () => {
  function panel(): HTMLElement | null | undefined {
    return getHost()?.shadowRoot?.querySelector<HTMLElement>('.tsa-widget');
  }

  /** jsdom has no visualViewport; a minimal fake is enough to drive a pinch-zoom. */
  function fakeVisualViewport(): EventTarget & { scale: number; width: number; height: number; offsetLeft: number; offsetTop: number } {
    const target = new EventTarget() as EventTarget & {
      scale: number; width: number; height: number; offsetLeft: number; offsetTop: number;
    };
    Object.assign(target, { scale: 1, width: 400, height: 800, offsetLeft: 0, offsetTop: 0 });
    Object.defineProperty(window, 'visualViewport', { value: target, configurable: true });
    return target;
  }

  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
  });

  it('is visible straight away by default', () => {
    createFloatingWidget().mount(createFakeEngine());
    expect(panel()?.hidden).toBe(false);
  });

  it('with show: on-zoom, stays hidden until the user pinch-zooms, then stays visible', () => {
    const viewport = fakeVisualViewport();
    createFloatingWidget({ show: 'on-zoom' }).mount(createFakeEngine());
    expect(panel()?.hidden).toBe(true);

    viewport.scale = 1.02; // below the threshold — not a real zoom
    viewport.dispatchEvent(new Event('resize'));
    expect(panel()?.hidden).toBe(true);

    viewport.scale = 2;
    viewport.dispatchEvent(new Event('resize'));
    expect(panel()?.hidden).toBe(false);

    viewport.scale = 1; // zooming back out doesn't hide it again
    viewport.dispatchEvent(new Event('resize'));
    expect(panel()?.hidden).toBe(false);
  });

  it('with show: on-zoom, measures pinch-zoom from the starting scale (pages without a viewport meta tag)', () => {
    const viewport = fakeVisualViewport();
    viewport.scale = 0.42; // a desktop-only page, fitted to a phone screen
    createFloatingWidget({ show: 'on-zoom' }).mount(createFakeEngine());
    expect(panel()?.hidden).toBe(true);

    viewport.scale = 0.43; // a wobble, not a zoom
    viewport.dispatchEvent(new Event('resize'));
    expect(panel()?.hidden).toBe(true);

    viewport.scale = 1; // pinched up to read: a 2.4× zoom, though still "scale 1"
    viewport.dispatchEvent(new Event('resize'));
    expect(panel()?.hidden).toBe(false);
  });

  it('while pinch-zoomed, counter-scales the control so it keeps its normal size', () => {
    const viewport = fakeVisualViewport();
    createFloatingWidget().mount(createFakeEngine());
    viewport.scale = 2;
    viewport.dispatchEvent(new Event('resize'));
    expect(panel()?.style.transform).toContain('scale(0.5)');

    viewport.scale = 1;
    viewport.dispatchEvent(new Event('resize'));
    expect(panel()?.style.transform).toBe('');
  });
});
