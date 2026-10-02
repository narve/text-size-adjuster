import type { TextSizeEngine, Store } from './types.js';

/**
 * Wires a Store to an engine from the outside — the engine itself never imports `Store`. Loads
 * the persisted factor (if any) on call, saves on every change, and optionally reacts to changes
 * made elsewhere (e.g. a popup in a different JS context writing to the same key) via
 * `store.subscribe`. Returns a function that tears down all subscriptions.
 *
 * The default factor (1) is never stored — going back to normal size removes the key instead
 * (when the store supports removal), so "keys in the store" means exactly "sites with a non-default
 * size" (FR9.2). Conversely, a key removed elsewhere (e.g. from the options page) resets the
 * engine to normal size.
 */
export function bindStore(engine: TextSizeEngine, store: Store, key: string): () => void {
  let applyingExternal = false;

  /** Applies a stored value without saving it straight back. */
  function applyExternal(value: number): void {
    applyingExternal = true;
    try {
      engine.setFactor(value);
    } finally {
      applyingExternal = false;
    }
  }

  void store.get(key).then((value) => {
    if (value !== undefined) applyExternal(value);
  });

  const unsubscribeChange = engine.onChange((event) => {
    if (applyingExternal) return;
    if (event.factor === 1 && store.remove) void store.remove(key);
    else void store.set(key, event.factor);
  });

  const unsubscribeStore = store.subscribe?.(key, (value) => applyExternal(value ?? 1));

  return () => {
    unsubscribeChange();
    unsubscribeStore?.();
  };
}
