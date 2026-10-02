export interface EngineOptions {
  /** Minimum allowed factor. Default 0.5. */
  min?: number;
  /** Maximum allowed factor. Default 3. */
  max?: number;
  /** Default increase/decrease step. Default 0.1. */
  step?: number;
  /** Attribute marking an element whose font-size has been captured and is now scaled. */
  scaledAttr?: string;
  /** Attribute marking an element whose px-based line-height is also scaled. */
  lineHeightAttr?: string;
  /**
   * The document/shadow-root this engine scales. Defaults to `document`. A child engine is
   * created automatically (with the same options otherwise) for every open shadow root and
   * same-origin iframe document discovered within this root.
   */
  root?: Document | ShadowRoot;
}

export interface EngineChangeEvent {
  type: 'change' | 'reset';
  factor: number;
  /** `location.origin` of the root's window, for convenience when wiring up a Store keyed by origin. */
  origin: string;
}

export type EngineListener = (event: EngineChangeEvent) => void;

export interface TextSizeEngine {
  increase(step?: number): number;
  decrease(step?: number): number;
  reset(): number;
  setFactor(k: number): number;
  getFactor(): number;
  /** Returns an unsubscribe function. */
  onChange(listener: EngineListener): () => void;
  /** Captures current page state and starts observing for new content. */
  attach(): void;
  detach(): void;
  /** Forces a fresh capture pass over the current root (e.g. after a caller-known DOM change). */
  rescan(): void;
}

/** A UI front-end that drives an engine. The engine has no knowledge of any UIAdapter. */
export interface UIAdapter {
  mount(engine: TextSizeEngine): void;
  unmount(): void;
}

/**
 * A pluggable persistence backend. The engine never imports this type — see `bindStore`, which
 * wires a Store to an engine from the outside, keeping persistence entirely optional.
 */
export interface Store {
  get(key: string): Promise<number | undefined>;
  set(key: string, value: number): Promise<void>;
  remove?(key: string): Promise<void>;
  /** Optional: notify of changes made elsewhere (e.g. a popup writing to the same key). */
  subscribe?(key: string, callback: (value: number | undefined) => void): () => void;
}
