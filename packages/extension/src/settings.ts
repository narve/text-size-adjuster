import browser from 'webextension-polyfill';
import { DEFAULT_POSITION, normalizeWidgetSettings, SETTINGS_KEY, type WidgetSettings } from '@tsa/ui-widget';

export { SETTINGS_KEY };

/**
 * The extension's settings, stored under SETTINGS_KEY in `browser.storage.local`. Per-site sizes
 * live alongside them keyed by origin (see content-script.ts), so they're told apart by key: that
 * one, versus keys that are origins (`isSiteKey`).
 */
export interface ControlSettings extends WidgetSettings {
  /** FR9.4: remember each site's size automatically; when off, only explicitly remembered sites. */
  autoRemember: boolean;
}

// FR10.4: the extension always has its toolbar/menu button too, so by default the on-page
// control stays out of the way until the user zooms.
export const DEFAULT_SETTINGS: ControlSettings = {
  position: DEFAULT_POSITION,
  show: 'on-zoom',
  autoRemember: true,
};

export function normalizeSettings(raw: unknown): ControlSettings {
  const value = (raw ?? {}) as Partial<Record<string, unknown>>;
  return {
    ...normalizeWidgetSettings(value, DEFAULT_SETTINGS),
    autoRemember: typeof value.autoRemember === 'boolean' ? value.autoRemember : DEFAULT_SETTINGS.autoRemember,
  };
}

const SITE_KEY = /^https?:\/\//;

export function isSiteKey(key: string): boolean {
  return SITE_KEY.test(key);
}

/** A site key as shown to the user: the origin without its scheme. */
export function siteLabel(key: string): string {
  return key.replace(SITE_KEY, '');
}

export async function readSettings(): Promise<ControlSettings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY]);
}

/** Calls `listener` with the current settings, then again whenever they change in storage. */
export function watchSettings(listener: (settings: ControlSettings) => void): void {
  void readSettings().then(listener);
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && SETTINGS_KEY in changes) listener(normalizeSettings(changes[SETTINGS_KEY]?.newValue));
  });
}
