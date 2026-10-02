import type { Store } from '@tsa/core';

/**
 * No persistence at all — values live only for as long as this object does. This is the default,
 * ad-hoc mode (FR1.4): simply not calling `bindStore` with anything, or using this store, means
 * the factor resets on reload. Mostly useful as the userscript's default and in tests.
 */
export function createMemoryStore(): Store {
  const data = new Map<string, number>();
  return {
    async get(key) {
      return data.get(key);
    },
    async set(key, value) {
      data.set(key, value);
    },
    async remove(key) {
      data.delete(key);
    },
  };
}
