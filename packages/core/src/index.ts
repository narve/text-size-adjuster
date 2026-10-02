export { createEngine } from './engine.js';
export { bindStore } from './persistence.js';
export { clampFactor } from './clamp.js';
export { isPxLineHeight } from './line-height.js';
export { DEFAULT_IGNORE_ATTR, DEFAULT_SCALED_ATTR } from './constants.js';
export type {
  EngineOptions,
  EngineChangeEvent,
  EngineListener,
  TextSizeEngine,
  UIAdapter,
  Store,
} from './types.js';
