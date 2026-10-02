import type { Store } from '@tsa/core';

/**
 * The slice of the WebExtension `browser.storage` API this store needs, as an interface rather
 * than importing `webextension-polyfill` directly — keeps this package dependency-free and the
 * store trivially unit-testable with a fake, and lets the caller (the extension package) decide
 * which polyfill/global to pass in (FR8.3's cross-browser `browser.*` namespace).
 */
export interface BrowserStorageLike {
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(key: string): Promise<void>;
    };
    onChanged: {
      addListener(
        callback: (changes: Record<string, { newValue?: unknown }>, areaName: string) => void,
      ): void;
      removeListener(
        callback: (changes: Record<string, { newValue?: unknown }>, areaName: string) => void,
      ): void;
    };
  };
}

/**
 * Per-site persistence backed by `browser.storage.local` (FR5). `subscribe` is implemented via
 * `storage.onChanged` so the popup and the content script — which don't share a JS heap — both
 * react when either one changes the stored factor.
 */
export function createLocalExtensionStore(browserApi: BrowserStorageLike): Store {
  return {
    async get(key) {
      const result = await browserApi.storage.local.get(key);
      const value = result[key];
      return typeof value === 'number' ? value : undefined;
    },
    async set(key, value) {
      await browserApi.storage.local.set({ [key]: value });
    },
    async remove(key) {
      await browserApi.storage.local.remove(key);
    },
    subscribe(key, callback) {
      const listener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
        if (areaName !== 'local' || !(key in changes)) return;
        const newValue = changes[key]?.newValue;
        callback(typeof newValue === 'number' ? newValue : undefined);
      };
      browserApi.storage.onChanged.addListener(listener);
      return () => browserApi.storage.onChanged.removeListener(listener);
    },
  };
}
