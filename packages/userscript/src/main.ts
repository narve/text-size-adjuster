import { createEngine, type TextSizeEngine } from '@tsa/core';
import {
  createFloatingWidget,
  DEFAULT_POSITION,
  parsePosition,
  parseShow,
  type WidgetPosition,
  type WidgetVisibility,
} from '@tsa/ui-widget';
import type { UIAdapter } from '@tsa/core';

// Deliberately no per-site size persistence here: FR1.4/FR5.2 make "ad hoc, resets on reload" the
// default for this bundle. Only the control's own settings (FR10) are remembered, in the
// userscript manager's storage.

interface ControlSettings {
  position: WidgetPosition;
  show: WidgetVisibility;
}

// FR10.4: the on-page control is the only way in for this bundle, so it's shown by default.
const DEFAULTS: ControlSettings = { position: DEFAULT_POSITION, show: 'always' };
const SETTINGS_KEY = 'tsa:settings';

/**
 * As a site-owner embed (FR3.4), settings come from the script tag: `data-*` attributes, else
 * URL parameters (FR10.3). `document.currentScript` only exists while the script first runs, so
 * this has to be read now, not later in start(). In a userscript manager there's no such tag.
 */
function readEmbedSettings(): Partial<ControlSettings> {
  const script = document.currentScript;
  if (!(script instanceof HTMLScriptElement)) return {};
  let params: URLSearchParams | null = null;
  try {
    params = script.src ? new URL(script.src).searchParams : null;
  } catch {
    params = null;
  }
  const settings: Partial<ControlSettings> = {};
  const position = parsePosition(script.dataset.position) ?? parsePosition(params?.get('position'));
  const show = parseShow(script.dataset.show) ?? parseShow(params?.get('show'));
  if (position) settings.position = position;
  if (show) settings.show = show;
  return settings;
}

const embedSettings = readEmbedSettings();

// --- Userscript manager APIs (FR10.3). Granted in the metadata block; absent when this same
// bundle runs as a plain embed, so every use is guarded. ---
interface GMStorage {
  getValue(key: string, defaultValue?: unknown): Promise<unknown>;
  setValue(key: string, value: unknown): Promise<void>;
}
declare const GM: GMStorage | undefined;
declare const GM_registerMenuCommand: ((caption: string, onClick: () => void) => unknown) | undefined;

function userscriptStorage(): GMStorage | null {
  return typeof GM !== 'undefined' && typeof GM?.getValue === 'function' ? GM : null;
}

async function loadSettings(): Promise<ControlSettings> {
  const settings: ControlSettings = { ...DEFAULTS, ...embedSettings };
  const storage = userscriptStorage();
  if (storage) {
    const saved = (await storage.getValue(SETTINGS_KEY, {})) as Partial<Record<string, string>>;
    settings.position = parsePosition(saved.position) ?? settings.position;
    settings.show = parseShow(saved.show) ?? settings.show;
  }
  return settings;
}

function registerMenuCommands(settings: ControlSettings, apply: (next: ControlSettings) => void): void {
  const storage = userscriptStorage();
  if (!storage || typeof GM_registerMenuCommand !== 'function') return;
  const save = (next: ControlSettings) => {
    Object.assign(settings, next);
    void storage.setValue(SETTINGS_KEY, next);
    apply(next);
  };
  const corners: Array<[WidgetPosition, string]> = [
    ['top-left', 'top left'],
    ['top-right', 'top right'],
    ['bottom-left', 'bottom left'],
    ['bottom-right', 'bottom right'],
  ];
  for (const [position, label] of corners) {
    GM_registerMenuCommand(`Text size control: place ${label}`, () => save({ ...settings, position }));
  }
  GM_registerMenuCommand('Text size control: always show', () => save({ ...settings, show: 'always' }));
  GM_registerMenuCommand('Text size control: show only after zooming', () =>
    save({ ...settings, show: 'on-zoom' }),
  );
}

async function start(): Promise<void> {
  const engine: TextSizeEngine = createEngine();
  engine.attach();

  const settings = await loadSettings();
  let widget: UIAdapter = createFloatingWidget(settings);
  widget.mount(engine);

  registerMenuCommands(settings, (next) => {
    widget.unmount();
    // A settings change from the menu is a deliberate request to see the control — show it now
    // rather than waiting for a zoom.
    widget = createFloatingWidget({ ...next, show: 'always' });
    widget.mount(engine);
  });
}

// Defensive regardless of the userscript manager actually honoring `@run-at document-idle`
// (or a test harness injecting this even earlier, ignoring that comment entirely, the way
// Playwright's addInitScript does): the engine needs `document.documentElement` to exist.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void start(), { once: true });
} else {
  void start();
}
