/**
 * Exported so other packages (e.g. ui-widget) can mark their own elements with the ignore
 * attribute without duplicating/risking drift from the engine's actual default — only relevant
 * if a consumer doesn't override `ignoreAttr` in EngineOptions.
 */
export const DEFAULT_IGNORE_ATTR = 'data-tsa-ignore';
export const DEFAULT_SCALED_ATTR = 'data-tsa-scaled';
