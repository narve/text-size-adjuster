import { describe, expect, it } from 'vitest';
import { createGatedStore } from './gated-store.js';
import { createMemoryStore } from './memory-store.js';

describe('createGatedStore', () => {
  it('saves everything while autoSave is on', async () => {
    const inner = createMemoryStore();
    const store = createGatedStore(inner, () => true);
    await store.set('https://a.example', 1.5);
    expect(await inner.get('https://a.example')).toBe(1.5);
  });

  it('with autoSave off, ignores new keys but keeps updating remembered ones', async () => {
    const inner = createMemoryStore();
    await inner.set('https://remembered.example', 1.2);
    const store = createGatedStore(inner, () => false);
    await store.set('https://new.example', 1.5);
    await store.set('https://remembered.example', 1.8);
    expect(await inner.get('https://new.example')).toBeUndefined();
    expect(await inner.get('https://remembered.example')).toBe(1.8);
  });

  it('reads the autoSave flag on every write', async () => {
    let autoSave = false;
    const inner = createMemoryStore();
    const store = createGatedStore(inner, () => autoSave);
    await store.set('https://a.example', 1.5);
    autoSave = true;
    await store.set('https://a.example', 1.6);
    expect(await inner.get('https://a.example')).toBe(1.6);
  });

  it('passes removals through', async () => {
    const inner = createMemoryStore();
    await inner.set('https://a.example', 1.5);
    await createGatedStore(inner, () => false).remove?.('https://a.example');
    expect(await inner.get('https://a.example')).toBeUndefined();
  });
});
