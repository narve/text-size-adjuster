import { describe, expect, it, vi } from 'vitest';
import { bindStore } from './persistence.js';
import type { Store } from './types.js';
import { createFakeEngine } from './test-helpers/fake-engine.js';

function createFakeStore(initial?: number): Store & { data: Map<string, number> } {
  const data = new Map<string, number>();
  if (initial !== undefined) data.set('https://example.com', initial);
  return {
    data,
    get: vi.fn(async (key: string) => data.get(key)),
    set: vi.fn(async (key: string, value: number) => {
      data.set(key, value);
    }),
    remove: vi.fn(async (key: string) => {
      data.delete(key);
    }),
  };
}

describe('bindStore', () => {
  it('applies a previously stored value to the engine on load', async () => {
    const engine = createFakeEngine();
    const store = createFakeStore(1.8);
    bindStore(engine, store, 'https://example.com');
    await Promise.resolve();
    await Promise.resolve();
    expect(engine.getFactor()).toBe(1.8);
  });

  it('does nothing on load when no value is stored', async () => {
    const engine = createFakeEngine();
    const store = createFakeStore();
    bindStore(engine, store, 'https://example.com');
    await Promise.resolve();
    await Promise.resolve();
    expect(engine.getFactor()).toBe(1);
  });

  it('saves engine changes to the store', () => {
    const engine = createFakeEngine();
    const store = createFakeStore();
    bindStore(engine, store, 'https://example.com');
    engine.setFactor(1.5);
    expect(store.set).toHaveBeenCalledWith('https://example.com', 1.5);
  });

  it('does not re-save a change that originated from loading the stored value', async () => {
    const engine = createFakeEngine();
    const store = createFakeStore(1.8);
    bindStore(engine, store, 'https://example.com');
    await Promise.resolve();
    await Promise.resolve();
    expect(store.set).not.toHaveBeenCalled();
  });

  it('applies external changes via subscribe without re-saving them (no feedback loop)', () => {
    const engine = createFakeEngine();
    const store = createFakeStore();
    let externalUpdate: ((value: number | undefined) => void) | undefined;
    store.subscribe = vi.fn((_key: string, cb) => {
      externalUpdate = cb;
      return () => {};
    });
    bindStore(engine, store, 'https://example.com');
    externalUpdate?.(2.2);
    expect(engine.getFactor()).toBe(2.2);
    expect(store.set).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe function that stops saving further changes', () => {
    const engine = createFakeEngine();
    const store = createFakeStore();
    const unbind = bindStore(engine, store, 'https://example.com');
    unbind();
    engine.setFactor(2);
    expect(store.set).not.toHaveBeenCalled();
  });

  it('removes the key instead of storing the default factor', async () => {
    const engine = createFakeEngine();
    const store = createFakeStore(1.5);
    bindStore(engine, store, 'https://example.com');
    engine.setFactor(1);
    expect(store.remove).toHaveBeenCalledWith('https://example.com');
    expect(store.set).not.toHaveBeenCalledWith('https://example.com', 1);
  });

  it('keeps saving later changes even if applying an external value threw', () => {
    const engine = createFakeEngine();
    const store = createFakeStore();
    let externalUpdate: ((value: number | undefined) => void) | undefined;
    store.subscribe = vi.fn((_key: string, cb) => {
      externalUpdate = cb;
      return () => {};
    });
    bindStore(engine, store, 'https://example.com');
    vi.mocked(engine.setFactor).mockImplementationOnce(() => {
      throw new Error('boom');
    });
    expect(() => externalUpdate?.(2)).toThrow('boom');
    engine.increase();
    expect(store.set).toHaveBeenCalledWith('https://example.com', 1.1);
  });

  /** A store whose writes finish only when `finishWrite` is called, each reporting itself to subscribers. */
  function createSlowStore() {
    const data = new Map<string, number>();
    const pending: Array<() => void> = [];
    let report: ((value: number | undefined) => void) | undefined;
    const later = (apply: () => number | undefined) =>
      new Promise<void>((resolve) => {
        pending.push(() => {
          report?.(apply());
          resolve();
        });
      });
    const store: Store = {
      get: async (key) => data.get(key),
      set: vi.fn((key: string, value: number) => later(() => data.set(key, value).get(key))),
      remove: vi.fn((key: string) => later(() => (data.delete(key), undefined))),
      subscribe: (_key, callback) => {
        report = callback;
        return () => {};
      },
    };
    const finishWrite = async () => {
      pending.shift()?.();
      await new Promise((resolve) => setTimeout(resolve));
    };
    return { store, data, finishWrite, pendingWrites: () => pending.length };
  }

  it("doesn't go back to an earlier size when the store reports its own write late", async () => {
    const engine = createFakeEngine();
    const { store, data, finishWrite } = createSlowStore();
    bindStore(engine, store, 'https://example.com');
    engine.setFactor(1.1);
    engine.setFactor(1.2);
    engine.setFactor(1.3);
    await finishWrite();
    expect(engine.getFactor()).toBe(1.3);
    await finishWrite();
    expect(engine.getFactor()).toBe(1.3);
    expect(data.get('https://example.com')).toBe(1.3);
    // The size in between was never written: only the first and the newest.
    expect(store.set).toHaveBeenCalledTimes(2);
  });

  it('keeps a reset that follows a change still being written', async () => {
    const engine = createFakeEngine();
    const { store, data, finishWrite, pendingWrites } = createSlowStore();
    bindStore(engine, store, 'https://example.com');
    engine.increase();
    engine.reset();
    while (pendingWrites() > 0) await finishWrite();
    expect(engine.getFactor()).toBe(1);
    expect(data.has('https://example.com')).toBe(false);
  });

  it('resets the engine to normal size when the key is removed elsewhere', () => {
    const engine = createFakeEngine(1.8);
    const store = createFakeStore();
    let externalUpdate: ((value: number | undefined) => void) | undefined;
    store.subscribe = vi.fn((_key: string, cb) => {
      externalUpdate = cb;
      return () => {};
    });
    bindStore(engine, store, 'https://example.com');
    externalUpdate?.(undefined);
    expect(engine.getFactor()).toBe(1);
    expect(store.remove).not.toHaveBeenCalled();
  });
});
