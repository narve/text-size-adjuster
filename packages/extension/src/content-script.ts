import browser from 'webextension-polyfill';
import { bindStore, createEngine } from '@tsa/core';
import { createFloatingWidget } from '@tsa/ui-widget';
import { createGatedStore, createLocalExtensionStore, type BrowserStorageLike } from '@tsa/stores';
import type { FactorResponse, Message } from './protocol.js';
import { normalizeSettings, SETTINGS_KEY } from './settings.js';
import type { UIAdapter } from '@tsa/core';

const engine = createEngine();

// Per-origin persistence (FR5.1). Keyed by *this frame's own* origin — for a cross-origin iframe
// (ads, embeds) that means persistence is scoped to the embed's own origin, shared across
// whichever pages embed it, which is a reasonable default for v1.
// FR9.4: with automatic remembering off, only sites already remembered keep being saved.
let autoRemember = true;
const store = createGatedStore(
  createLocalExtensionStore(browser as unknown as BrowserStorageLike),
  () => autoRemember,
);
bindStore(engine, store, location.origin);
void browser.storage.local.get(SETTINGS_KEY).then((stored) => {
  autoRemember = normalizeSettings(stored[SETTINGS_KEY]).autoRemember;
});
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && SETTINGS_KEY in changes) {
    autoRemember = normalizeSettings(changes[SETTINGS_KEY]?.newValue).autoRemember;
  }
});

engine.attach();

// Only the top frame gets a visible widget — an iframe (same-origin or, via all_frames below,
// cross-origin) still gets its own engine instance scaled in sync, but not its own floating
// controls, which would make no visual sense inside e.g. an ad slot.
if (window === window.top) {
  let widget: UIAdapter | null = null;
  const mountWidget = (rawSettings: unknown) => {
    widget?.unmount();
    widget = createFloatingWidget(normalizeSettings(rawSettings));
    widget.mount(engine);
  };
  void browser.storage.local.get(SETTINGS_KEY).then((stored) => mountWidget(stored[SETTINGS_KEY]));
  // FR9.3: a change on the options page applies to already-open pages straight away.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && SETTINGS_KEY in changes) mountWidget(changes[SETTINGS_KEY]?.newValue);
  });
}

// Guards against re-broadcasting a factor change that just arrived *from* the background relay —
// without this, every relayed update would bounce straight back out and loop.
let applyingExternal = false;

function respond(factor: number): FactorResponse {
  return { factor };
}

browser.runtime.onMessage.addListener((raw: unknown): Promise<FactorResponse> | undefined => {
  const message = raw as Message;
  switch (message.type) {
    case 'tsa:getFactor':
      return Promise.resolve(respond(engine.getFactor()));
    case 'tsa:setFactor':
      applyingExternal = true;
      engine.setFactor(message.factor);
      applyingExternal = false;
      return Promise.resolve(respond(engine.getFactor()));
    case 'tsa:increase':
      return Promise.resolve(respond(engine.increase()));
    case 'tsa:decrease':
      return Promise.resolve(respond(engine.decrease()));
    case 'tsa:reset':
      return Promise.resolve(respond(engine.reset()));
    default:
      return undefined;
  }
});

// Let the background know this frame exists, so it can relay this tab's other frames' factor
// changes here too (see background.ts) — this is what keeps a cross-origin iframe (FR6.1/FR3.3)
// in sync with the rest of the page despite running its own independent engine instance.
void browser.runtime.sendMessage({ type: 'tsa:registerFrame' } satisfies Message).catch(() => {});

engine.onChange((event) => {
  if (applyingExternal) return;
  void browser.runtime
    .sendMessage({ type: 'tsa:factorChanged', factor: event.factor } satisfies Message)
    .catch(() => {});
});
