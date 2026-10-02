export { createEngine } from './engine.js';
export { bindStore } from './persistence.js';
export { clampFactor } from './clamp.js';
export { isPxLineHeight } from './line-height.js';
export { buildOverrideCss } from './specificity.js';
export type { OverrideCssOptions } from './specificity.js';
export type {
  EngineOptions,
  EngineChangeEvent,
  EngineListener,
  TextSizeEngine,
  UIAdapter,
  Store,
} from './types.js';
