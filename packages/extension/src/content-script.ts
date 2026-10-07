import browser from 'webextension-polyfill';
import { bindStore, createEngine } from '@tsa/core';
import { createRemountableWidget, formatFactor, showToast } from '@tsa/ui-widget';
import { createGatedStore, createLocalExtensionStore, type BrowserStorageLike } from '@tsa/stores';
import { isFactor, type FactorResponse, type Message } from './protocol.js';
import { readSettings, watchSettings, type ControlSettings } from './settings.js';

/**
 * Runs in every frame of every page (`all_frames`): each frame, including a cross-origin iframe
 * the top page's engine can't reach (FR6.1), gets its own engine. The *top* frame is the single
 * source of truth for the tab's size: it alone has the on-page control, answers the popup,
 * remembers the size for the site (FR5.1, keyed by the address-bar origin) and announces every
 * change. Every other frame only follows, through the background's relay (see background.ts) —
 * it never saves anything under its own origin, so an embed (an ad, a video, a comments widget)
 * never shows up as a "site" of its own or carries a size from one site to another.
 */
const engine = createEngine();

if (window === window.top) runTopFrame();
else runSubframe();

engine.attach();

function runTopFrame(): void {
  // FR9.4: with automatic remembering off, only sites already remembered keep being saved. Until
  // the settings have been read, a save waits for them rather than assuming either way.
  let autoRemember: Promise<boolean> = readSettings().then((settings) => settings.autoRemember);
  const store = createGatedStore(createLocalExtensionStore(browser as unknown as BrowserStorageLike), () => autoRemember);
  // A local file, or any other page without an origin of its own, is not a site: all of them
  // would share one size, under a key the options page doesn't list.
  if (location.origin !== 'null') {
    bindStore(engine, store, location.origin);
    // FR9.8: a page that opens at a remembered size says so, since nothing on it shows why its
    // text is bigger or smaller than its author made it. Once the tab is in view: a page opened
    // in the background would otherwise say it to nobody.
    void store.get(location.origin).then((size) => {
      if (size === undefined || size === 1) return;
      const show = () => showToast(`Text size: ${formatFactor(size)}`);
      if (!document.hidden) show();
      else document.addEventListener('visibilitychange', show, { once: true });
    });
  }

  // FR9.3: a change on the options page applies to already-open pages straight away. The control
  // is only re-created when its own settings changed, so toggling an unrelated setting doesn't
  // hide a control the user has just revealed by zooming.
  const widget = createRemountableWidget(engine, {
    onOpenSettings: () => {
      void browser.runtime.sendMessage({ type: 'tsa:openOptions' } satisfies Message).catch(() => {});
    },
  });
  const respond = (factor: number): FactorResponse => ({ factor, controlVisible: widget.isVisible() });
  let shown: ControlSettings | null = null;
  watchSettings((settings) => {
    autoRemember = Promise.resolve(settings.autoRemember);
    if (shown?.position === settings.position && shown.show === settings.show) return;
    shown = settings;
    widget.apply(settings);
  });

  browser.runtime.onMessage.addListener((raw: unknown): Promise<FactorResponse> | undefined => {
    const message = raw as Message;
    switch (message.type) {
      case 'tsa:getFactor':
        return Promise.resolve(respond(engine.getFactor()));
      case 'tsa:increase':
        return Promise.resolve(respond(engine.increase()));
      case 'tsa:decrease':
        return Promise.resolve(respond(engine.decrease()));
      case 'tsa:reset':
        return Promise.resolve(respond(engine.reset()));
      case 'tsa:showControl':
        widget.show();
        return Promise.resolve(respond(engine.getFactor()));
      default:
        // Including the relay's own tsa:setFactor, which reaches this frame too: the top frame
        // is where changes come from, it never follows.
        return undefined;
    }
  });

  // Every change — from the control, the popup, the stored size or the options page — goes to
  // the tab's other frames.
  engine.onChange((event) => {
    void browser.runtime
      .sendMessage({ type: 'tsa:factorChanged', factor: event.factor } satisfies Message)
      .catch(() => {});
  });
}

function runSubframe(): void {
  const follow = (factor: unknown) => {
    if (isFactor(factor) && factor !== engine.getFactor()) engine.setFactor(factor);
  };

  browser.runtime.onMessage.addListener((raw: unknown): Promise<FactorResponse> | undefined => {
    const message = raw as Message;
    if (message.type !== 'tsa:setFactor') return undefined;
    follow(message.factor);
    return undefined;
  });

  // Catch up with a size the top frame already has (e.g. its remembered size); if the top frame
  // isn't ready yet, its own later change reaches this frame through the relay instead.
  void browser.runtime
    .sendMessage({ type: 'tsa:getTopFactor' } satisfies Message)
    .then((response) => follow((response as FactorResponse | undefined)?.factor))
    .catch(() => {});
}
