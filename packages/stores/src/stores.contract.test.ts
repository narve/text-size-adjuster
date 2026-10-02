import { describe, expect, it } from 'vitest';
import type { Store } from '@tsa/core';
import { createMemoryStore } from './memory-store.js';
import { createLocalExtensionStore } from './local-extension-store.js';
import { createGMValueStore } from './gm-store.js';
import { createFakeBrowserApi } from './test-helpers/fake-browser-api.js';
import { createFakeGM } from './test-helpers/fake-gm.js';

/** The behavior every Store implementation must share, regardless of backend. */
const implementations: Array<{ name: string; create: () => Store }> = [
  { name: 'MemoryStore', create: () => createMemoryStore() },
  { name: 'LocalExtensionStore', create: () => createLocalExtensionStore(createFakeBrowserApi()) },
  { name: 'GMValueStore', create: () => createGMValueStore(createFakeGM()) },
];

describe.each(implementations)('$name (shared contract)', ({ create }) => {
  it('returns undefined for a key that was never set', async () => {
    const store = create();
    expect(await store.get('https://example.com')).toBeUndefined();
  });

  it('round-trips a value through set/get', async () => {
    const store = create();
    await store.set('https://example.com', 1.5);
    expect(await store.get('https://example.com')).toBe(1.5);
  });

  it('keeps different keys independent', async () => {
    const store = create();
    await store.set('https://a.example', 1.2);
    await store.set('https://b.example', 2.0);
    expect(await store.get('https://a.example')).toBe(1.2);
    expect(await store.get('https://b.example')).toBe(2.0);
  });

  it('overwrites a previously set value', async () => {
    const store = create();
    await store.set('https://example.com', 1.2);
    await store.set('https://example.com', 1.8);
    expect(await store.get('https://example.com')).toBe(1.8);
  });

  it('clears a value via remove', async () => {
    const store = create();
    await store.set('https://example.com', 1.5);
    await store.remove?.('https://example.com');
    expect(await store.get('https://example.com')).toBeUndefined();
  });
});
