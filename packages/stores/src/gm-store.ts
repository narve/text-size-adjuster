import type { Store } from '@tsa/core';

/**
 * The slice of a userscript manager's modern, Promise-based `GM.*` API this store needs (as
 * opposed to the legacy synchronous `GM_getValue`/`GM_setValue` globals) — passed in rather than
 * assumed global, so this package has no runtime dependency on running inside a userscript.
 */
export interface GMValueApi {
  getValue(key: string, defaultValue?: unknown): Promise<unknown>;
  setValue(key: string, value: unknown): Promise<void>;
  deleteValue?(key: string): Promise<void>;
}

/**
 * Optional per-site persistence for the userscript (FR5.3 — a nice-to-have, not the primary
 * ask). No `subscribe`: `GM_addValueChangeListener` exists for cross-context change notification,
 * but it's a separate, less consistently supported API surface across userscript managers —
 * left out of v1 rather than building on an unverified assumption.
 */
export function createGMValueStore(gm: GMValueApi): Store {
  return {
    async get(key) {
      const value = await gm.getValue(key, undefined);
      return typeof value === 'number' ? value : undefined;
    },
    async set(key, value) {
      await gm.setValue(key, value);
    },
    async remove(key) {
      await gm.deleteValue?.(key);
    },
  };
}
