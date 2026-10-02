import type { Store } from '@tsa/core';

/**
 * Wraps a Store so `set` only writes when `autoSave()` is true, or when the key is already stored
 * (an explicitly remembered entry keeps being updated). Reads, removals and subscriptions pass
 * straight through. Used for the extension's "remember sizes automatically" setting (FR9.4/9.5).
 */
export function createGatedStore(inner: Store, autoSave: () => boolean): Store {
  return {
    get: (key) => inner.get(key),
    async set(key, value) {
      if (autoSave() || (await inner.get(key)) !== undefined) await inner.set(key, value);
    },
    remove: inner.remove ? (key) => inner.remove!(key) : undefined,
    subscribe: inner.subscribe ? (key, callback) => inner.subscribe!(key, callback) : undefined,
  };
}
