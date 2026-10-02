import type { GMValueApi } from '../gm-store.js';

/** A minimal, in-memory fake of a userscript manager's `GM.*` API for unit tests. */
export function createFakeGM(): GMValueApi {
  const data = new Map<string, unknown>();
  return {
    async getValue(key, defaultValue) {
      return data.has(key) ? data.get(key) : defaultValue;
    },
    async setValue(key, value) {
      data.set(key, value);
    },
    async deleteValue(key) {
      data.delete(key);
    },
  };
}
