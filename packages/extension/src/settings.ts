import {
  DEFAULT_POSITION,
  parsePosition,
  parseShow,
  type WidgetPosition,
  type WidgetVisibility,
} from '@tsa/ui-widget';

/**
 * The on-page control's settings (FR10), stored under one key in `browser.storage.local`. Per-site
 * sizes live alongside them keyed by origin (see content-script.ts), so they're told apart by key:
 * this one, versus keys that are origins (`isSiteKey`).
 */
export const SETTINGS_KEY = 'tsa:settings';

export interface ControlSettings {
  position: WidgetPosition;
  show: WidgetVisibility;
}

// FR10.4: the extension always has its toolbar/menu button too, so by default the on-page
// control stays out of the way until the user zooms.
export const DEFAULT_SETTINGS: ControlSettings = { position: DEFAULT_POSITION, show: 'on-zoom' };

export function normalizeSettings(raw: unknown): ControlSettings {
  const value = (raw ?? {}) as Partial<Record<string, string>>;
  return {
    position: parsePosition(value.position) ?? DEFAULT_SETTINGS.position,
    show: parseShow(value.show) ?? DEFAULT_SETTINGS.show,
  };
}

export function isSiteKey(key: string): boolean {
  return key.startsWith('http://') || key.startsWith('https://');
}
