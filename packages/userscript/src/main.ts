import { createEngine } from '@tsa/core';
import type { GMValueApi } from '@tsa/stores';
import {
  createRemountableWidget,
  DEFAULT_POSITION,
  normalizeWidgetSettings,
  parsePosition,
  parseShow,
  POSITION_LABELS,
  SETTINGS_KEY,
  type WidgetPosition,
  type WidgetSettings,
} from '@tsa/ui-widget';

// Deliberately no per-site size persistence here: FR1.4/FR5.2 make "ad hoc, resets on reload" the
// default for this bundle. Only the control's own settings (FR10) are remembered, in the
// userscript manager's storage.

// FR10.4: the on-page control is the only way in for this bundle, so it's shown by default.
const DEFAULTS: WidgetSettings = { position: DEFAULT_POSITION, show: 'always' };

/**
 * As a site-owner embed (FR3.4), settings come from the script tag: `data-*` attributes, else
 * URL parameters (FR10.3). `document.currentScript` only exists while the script first runs, so
 * this has to be read now, not later in start(). In a userscript manager there's no such tag.
 */
function readEmbedSettings(): Partial<WidgetSettings> {
  const script = document.currentScript;
  if (!(script instanceof HTMLScriptElement)) return {};
  let params: URLSearchParams | null = null;
  try {
    params = script.src ? new URL(script.src).searchParams : null;
  } catch {
    params = null;
  }
  const settings: Partial<WidgetSettings> = {};
  const position = parsePosition(script.dataset.position) ?? parsePosition(params?.get('position'));
  const show = parseShow(script.dataset.show) ?? parseShow(params?.get('show'));
  if (position) settings.position = position;
  if (show) settings.show = show;
  return settings;
}

const embedSettings = readEmbedSettings();

// --- Userscript manager APIs (FR10.3). Granted in the metadata block; absent when this same
// bundle runs as a plain embed, so every use is guarded. ---
type GMStorage = Pick<GMValueApi, 'getValue' | 'setValue'>;
declare const GM: GMStorage | undefined;
declare const GM_registerMenuCommand: ((caption: string, onClick: () => void) => unknown) | undefined;

function userscriptStorage(): GMStorage | null {
  return typeof GM !== 'undefined' && typeof GM?.getValue === 'function' ? GM : null;
}

async function loadSettings(): Promise<WidgetSettings> {
  const settings: WidgetSettings = { ...DEFAULTS, ...embedSettings };
  const storage = userscriptStorage();
  return storage ? normalizeWidgetSettings(await storage.getValue(SETTINGS_KEY, {}), settings) : settings;
}

function registerMenuCommands(settings: WidgetSettings, apply: (next: WidgetSettings) => void): void {
  const storage = userscriptStorage();
  if (!storage || typeof GM_registerMenuCommand !== 'function') return;
  const save = (next: WidgetSettings) => {
    Object.assign(settings, next);
    void storage.setValue(SETTINGS_KEY, next);
    apply(next);
  };
  for (const [position, label] of Object.entries(POSITION_LABELS) as Array<[WidgetPosition, string]>) {
    GM_registerMenuCommand(`Text size control: place ${label}`, () => save({ ...settings, position }));
  }
  GM_registerMenuCommand('Text size control: always show', () => save({ ...settings, show: 'always' }));
  GM_registerMenuCommand('Text size control: show only after zooming', () =>
    save({ ...settings, show: 'on-zoom' }),
  );
}

async function start(): Promise<void> {
  const engine = createEngine();
  engine.attach();

  const settings = await loadSettings();
  const widget = createRemountableWidget(engine);
  widget.apply(settings);

  // A settings change from the menu is a deliberate request to see the control — show it now
  // rather than waiting for a zoom.
  registerMenuCommands(settings, (next) => widget.apply({ ...next, show: 'always' }));
}

// Defensive regardless of the userscript manager actually honoring `@run-at document-idle`
// (or a test harness injecting this even earlier, ignoring that comment entirely, the way
// Playwright's addInitScript does): the engine needs `document.documentElement` to exist.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void start(), { once: true });
} else {
  void start();
}
