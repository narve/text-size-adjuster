/**
 * Clamps a scale factor into [min, max]. NaN (e.g. from a corrupt stored value) clamps to min
 * rather than propagating, so a bad persisted value can't silently break scaling.
 */
export function clampFactor(k: number, min: number, max: number): number {
  if (Number.isNaN(k)) return min;
  return Math.min(max, Math.max(min, k));
}
