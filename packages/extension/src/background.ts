import browser, { type Runtime } from 'webextension-polyfill';
import type { Message } from './protocol.js';

/**
 * Keeps every frame of a tab in sync (FR6.1/FR3.3's cross-origin iframe capability): each frame
 * runs its own independent content-script engine (see content-script.ts), so when one frame's
 * factor changes, this relays it to every *other* frame registered for that tab. Built from
 * `sender.tab.id`/`sender.frameId` on incoming messages rather than the `webNavigation`
 * permission's frame-enumeration API, to avoid requesting a permission just for this.
 */
const tabFrames = new Map<number, Set<number>>();

browser.runtime.onMessage.addListener((raw: unknown, sender: Runtime.MessageSender) => {
  const message = raw as Message;
  const tabId = sender.tab?.id;
  const frameId = sender.frameId;
  if (tabId === undefined || frameId === undefined) return undefined;

  if (message.type === 'tsa:registerFrame') {
    let frames = tabFrames.get(tabId);
    if (!frames) {
      frames = new Set();
      tabFrames.set(tabId, frames);
    }
    frames.add(frameId);
    return undefined;
  }

  if (message.type === 'tsa:factorChanged') {
    const frames = tabFrames.get(tabId);
    if (!frames) return undefined;
    for (const otherFrameId of frames) {
      if (otherFrameId === frameId) continue;
      const relay: Message = { type: 'tsa:setFactor', factor: message.factor };
      void browser.tabs.sendMessage(tabId, relay, { frameId: otherFrameId }).catch(() => {});
    }
  }

  return undefined;
});

browser.tabs.onRemoved.addListener((tabId) => {
  tabFrames.delete(tabId);
});
