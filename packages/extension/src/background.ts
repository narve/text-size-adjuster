import browser, { type Runtime } from 'webextension-polyfill';
import { isFactor, type FactorResponse, type Message } from './protocol.js';

/**
 * Keeps every frame of a tab in sync with its top frame (FR6.1/FR3.3's cross-origin iframe
 * capability): each frame runs its own content-script engine (see content-script.ts), and the top
 * frame is the source of truth.
 *
 * Deliberately stateless. Firefox unloads an idle MV3 background (an event page) and starts it
 * again with fresh globals for the next message, so a registry of frames kept in memory would
 * silently be empty after a few seconds. Instead, a change is broadcast to every frame of the
 * tab (`tabs.sendMessage` without a `frameId`); the top frame ignores the echo.
 *
 * Messages from extension pages (the popup, the options page) have no `sender.tab` and are
 * ignored here: those pages talk to the content scripts directly.
 */
browser.runtime.onMessage.addListener(
  (raw: unknown, sender: Runtime.MessageSender): Promise<FactorResponse | undefined> | undefined => {
    const message = raw as Message;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return undefined;

    switch (message.type) {
      case 'tsa:getTopFactor': {
        const query: Message = { type: 'tsa:getFactor' };
        return browser.tabs
          .sendMessage(tabId, query, { frameId: 0 })
          .then((response) => response as FactorResponse | undefined)
          .catch(() => undefined);
      }
      case 'tsa:factorChanged': {
        // Only the top frame decides the tab's size.
        if (sender.frameId !== 0 || !isFactor(message.factor)) return undefined;
        const relay: Message = { type: 'tsa:setFactor', factor: message.factor };
        void browser.tabs.sendMessage(tabId, relay).catch(() => {});
        return undefined;
      }
      case 'tsa:openOptions': {
        // From the gear on the on-page control (FR9.6), which only the top frame has.
        if (sender.frameId === 0) void browser.runtime.openOptionsPage().catch(() => {});
        return undefined;
      }
      default:
        return undefined;
    }
  },
);
