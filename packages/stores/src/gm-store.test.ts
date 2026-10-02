import { describe, expect, it } from 'vitest';
import { createGMValueStore } from './gm-store.js';
import { createFakeGM } from './test-helpers/fake-gm.js';

describe('createGMValueStore', () => {
  it('tolerates a GM API with no deleteValue (older managers)', async () => {
    const gm = createFakeGM();
    const gmWithoutDelete = { getValue: gm.getValue, setValue: gm.setValue };
    const store = createGMValueStore(gmWithoutDelete);

    await store.set('https://example.com', 1.5);
    await expect(store.remove?.('https://example.com')).resolves.not.toThrow();
  });

  it('has no subscribe — cross-context change notification is out of scope for v1', () => {
    const store = createGMValueStore(createFakeGM());
    expect(store.subscribe).toBeUndefined();
  });
});
