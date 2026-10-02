import { describe, expect, it, vi } from 'vitest';
import { createLocalExtensionStore } from './local-extension-store.js';
import { createFakeBrowserApi } from './test-helpers/fake-browser-api.js';

describe('createLocalExtensionStore', () => {
  it('notifies a subscriber when the value changes elsewhere (e.g. from the popup)', () => {
    const api = createFakeBrowserApi();
    const store = createLocalExtensionStore(api);
    const onChange = vi.fn();

    store.subscribe?.('https://example.com', onChange);
    api.simulateExternalChange('https://example.com', 2.0);

    expect(onChange).toHaveBeenCalledWith(2.0);
  });

  it('ignores changes to a different key', () => {
    const api = createFakeBrowserApi();
    const store = createLocalExtensionStore(api);
    const onChange = vi.fn();

    store.subscribe?.('https://example.com', onChange);
    api.simulateExternalChange('https://other.example', 2.0);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops notifying after unsubscribe', () => {
    const api = createFakeBrowserApi();
    const store = createLocalExtensionStore(api);
    const onChange = vi.fn();

    const unsubscribe = store.subscribe?.('https://example.com', onChange);
    unsubscribe?.();
    api.simulateExternalChange('https://example.com', 2.0);

    expect(onChange).not.toHaveBeenCalled();
  });
});
