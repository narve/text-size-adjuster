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
 *
 * Writes go to the store one at a time, in order, and a size waiting behind a write in progress
 * is replaced by a newer one. While a write of its own is under way, what the store reports is
 * ignored: it is the echo of that write (or about to be overwritten by it), and applying it would
 * put the engine back to a size the user has already moved on from.
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

  let writing = false;
  let queued: number | undefined;

  function save(factor: number): void {
    if (writing) {
      queued = factor;
      return;
    }
    writing = true;
    const written = factor === 1 && store.remove ? store.remove(key) : store.set(key, factor);
    const next = () => {
      writing = false;
      if (queued === undefined) return;
      const waiting = queued;
      queued = undefined;
      save(waiting);
    };
    void written.then(next, next);
  }

  const unsubscribeChange = engine.onChange((event) => {
    if (!applyingExternal) save(event.factor);
  });

  const unsubscribeStore = store.subscribe?.(key, (value) => {
    const factor = value ?? 1;
    if (!writing && factor !== engine.getFactor()) applyExternal(factor);
  });

  return () => {
    unsubscribeChange();
    unsubscribeStore?.();
  };
}
