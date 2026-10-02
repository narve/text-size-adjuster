import type { TextSizeEngine, Store } from './types.js';

/**
 * Wires a Store to an engine from the outside — the engine itself never imports `Store`. Loads
 * the persisted factor (if any) on call, saves on every change, and optionally reacts to changes
 * made elsewhere (e.g. a popup in a different JS context writing to the same key) via
 * `store.subscribe`. Returns a function that tears down all subscriptions.
 */
export function bindStore(engine: TextSizeEngine, store: Store, key: string): () => void {
  let applyingExternal = false;

  void store.get(key).then((value) => {
    if (value === undefined) return;
    applyingExternal = true;
    engine.setFactor(value);
    applyingExternal = false;
  });

  const unsubscribeChange = engine.onChange((event) => {
    if (applyingExternal) return;
    void store.set(key, event.factor);
  });

  const unsubscribeStore = store.subscribe?.(key, (value) => {
    if (value === undefined) return;
    applyingExternal = true;
    engine.setFactor(value);
    applyingExternal = false;
  });

  return () => {
    unsubscribeChange();
    unsubscribeStore?.();
  };
}
