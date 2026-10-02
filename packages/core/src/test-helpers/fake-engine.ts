import { vi } from 'vitest';
import type { EngineListener, TextSizeEngine } from '../types.js';

export type FakeEngine = TextSizeEngine & {
  /** Sets the factor from outside (as another tab or a store would) and notifies listeners. */
  emit(factor: number, type?: 'change' | 'reset'): void;
};

/**
 * A TextSizeEngine stand-in for unit tests of code built on top of the engine (persistence, UIs).
 * Every method is a `vi.fn` spy; changes notify listeners like the real engine does.
 */
export function createFakeEngine(initial = 1): FakeEngine {
  let factor = initial;
  const listeners = new Set<EngineListener>();
  const emit = (f: number, type: 'change' | 'reset' = 'change') => {
    factor = f;
    for (const l of listeners) l({ type, factor, origin: 'https://example.com' });
    return factor;
  };
  return {
    increase: vi.fn((step = 0.1) => emit(factor + step)),
    decrease: vi.fn((step = 0.1) => emit(factor - step)),
    reset: vi.fn(() => emit(1, 'reset')),
    setFactor: vi.fn((k: number) => emit(k)),
    getFactor: () => factor,
    onChange: (listener: EngineListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    attach: vi.fn(),
    detach: vi.fn(),
    rescan: vi.fn(),
    emit,
  };
}
