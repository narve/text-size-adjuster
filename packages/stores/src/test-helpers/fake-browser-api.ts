import type { BrowserStorageLike } from '../local-extension-store.js';

/** A minimal, in-memory fake of `browser.storage` for unit tests — no real extension needed. */
export function createFakeBrowserApi(): BrowserStorageLike & {
  /** Test-only: simulate a change made elsewhere (e.g. the popup) firing onChanged. */
  simulateExternalChange(key: string, newValue: unknown): void;
} {
  const data = new Map<string, unknown>();
  const listeners = new Set<(changes: Record<string, { newValue?: unknown }>, areaName: string) => void>();

  return {
    storage: {
      local: {
        async get(key) {
          return data.has(key) ? { [key]: data.get(key) } : {};
        },
        async set(items) {
          for (const [key, value] of Object.entries(items)) data.set(key, value);
        },
        async remove(key) {
          data.delete(key);
        },
      },
      onChanged: {
        addListener(callback) {
          listeners.add(callback);
        },
        removeListener(callback) {
          listeners.delete(callback);
        },
      },
    },
    simulateExternalChange(key, newValue) {
      data.set(key, newValue);
      for (const listener of listeners) listener({ [key]: { newValue } }, 'local');
    },
  };
}
