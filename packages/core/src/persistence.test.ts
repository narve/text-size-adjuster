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
