export type WidgetPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type WidgetVisibility = 'always' | 'on-zoom';

export const DEFAULT_POSITION: WidgetPosition = 'bottom-right';

/** The on-page control's settings (FR10). Each delivery mechanism picks its own defaults. */
export interface WidgetSettings {
  position: WidgetPosition;
  show: WidgetVisibility;
}

/** Storage key for the saved settings, in both the extension's and the userscript manager's storage. */
export const SETTINGS_KEY = 'tsa:settings';

/** Human-readable corner names, e.g. for menus. */
export const POSITION_LABELS: Record<WidgetPosition, string> = {
  'top-left': 'top left',
  'top-right': 'top right',
  'bottom-left': 'bottom left',
  'bottom-right': 'bottom right',
};

const POSITIONS: Record<string, WidgetPosition> = {
  'top-left': 'top-left',
  'top-right': 'top-right',
  'bottom-left': 'bottom-left',
  'bottom-right': 'bottom-right',
  tl: 'top-left',
  tr: 'top-right',
  bl: 'bottom-left',
  br: 'bottom-right',
};

const VISIBILITIES: Record<string, WidgetVisibility> = {
  always: 'always',
  'on-zoom': 'on-zoom',
};

/** Accepts long (`top-left`) and short (`tl`) forms, case-insensitively; anything else → null. */
export function parsePosition(value: string | null | undefined): WidgetPosition | null {
  if (!value) return null;
  return POSITIONS[value.trim().toLowerCase()] ?? null;
}

/** Accepts `always` or `on-zoom`, case-insensitively; anything else → null. */
export function parseShow(value: string | null | undefined): WidgetVisibility | null {
  if (!value) return null;
  return VISIBILITIES[value.trim().toLowerCase()] ?? null;
}

/** Reads position/show from untrusted stored or user input, falling back to `defaults` per field. */
export function normalizeWidgetSettings(raw: unknown, defaults: WidgetSettings): WidgetSettings {
  const value = (raw ?? {}) as Partial<Record<string, unknown>>;
  const text = (v: unknown) => (typeof v === 'string' ? v : null);
  return {
    position: parsePosition(text(value.position)) ?? defaults.position,
    show: parseShow(text(value.show)) ?? defaults.show,
  };
}

/** A size factor as shown to the user, e.g. `1.25` → `125%`. */
export function formatFactor(factor: number): string {
  return `${Math.round(factor * 100)}%`;
}
