import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_IGNORE_ATTR } from '@tsa/core';
import { showToast, TOAST_MS } from './toast.js';

const host = () => document.body.querySelector(`[${DEFAULT_IGNORE_ATTR}]`);

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('showToast', () => {
  it('shows the message, kept out of the engine\'s reach, and announces it', () => {
    showToast('Text size: 140%');
    const panel = host()!.shadowRoot!.querySelector('.tsa-toast')!;
    expect(panel.textContent).toBe('Text size: 140%');
    expect(panel.getAttribute('role')).toBe('status');
  });

  it('goes away by itself after about three seconds', () => {
    vi.useFakeTimers();
    showToast('Text size: 140%');
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(host()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(host()).toBeNull();
  });

  it('can be removed early', () => {
    showToast('Text size: 140%')();
    expect(host()).toBeNull();
  });
});
