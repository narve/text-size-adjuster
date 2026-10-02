import browser from 'webextension-polyfill';
import { isSiteKey, normalizeSettings, SETTINGS_KEY, type ControlSettings } from '../settings.js';

/**
 * Options page (FR9). Everything is read from and written to `browser.storage.local`; open tabs
 * react through `storage.onChanged` (see content-script.ts), so nothing here talks to tabs
 * directly.
 */

async function readSettings(): Promise<ControlSettings> {
  const stored = await browser.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(stored[SETTINGS_KEY]);
}

async function writeSettings(patch: Partial<ControlSettings>): Promise<void> {
  const next = { ...(await readSettings()), ...patch };
  await browser.storage.local.set({ [SETTINGS_KEY]: next });
}

function bindRadioGroup(name: 'position' | 'show', current: string): void {
  for (const input of document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)) {
    input.checked = input.value === current;
    input.addEventListener('change', () => {
      if (input.checked) void writeSettings({ [name]: input.value } as Partial<ControlSettings>);
    });
  }
}

async function renderSites(): Promise<void> {
  const all = await browser.storage.local.get(null);
  const sites = Object.entries(all)
    .filter((entry): entry is [string, number] => isSiteKey(entry[0]) && typeof entry[1] === 'number')
    .sort(([a], [b]) => a.localeCompare(b));

  const list = document.getElementById('sites')!;
  const empty = document.getElementById('empty')!;
  list.replaceChildren();
  empty.hidden = sites.length > 0;
  list.hidden = sites.length === 0;

  for (const [origin, factor] of sites) {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'origin';
    name.textContent = origin.replace(/^https?:\/\//, '');
    name.title = origin;
    const size = document.createElement('span');
    size.className = 'size';
    size.textContent = `${Math.round(factor * 100)}%`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${origin} (back to normal size)`);
    // Removing the key resets any open tab on that site too (bindStore treats a removed key as
    // "back to normal size").
    remove.addEventListener('click', () => void browser.storage.local.remove(origin));
    item.append(name, size, remove);
    list.append(item);
  }
}

async function init(): Promise<void> {
  const settings = await readSettings();
  bindRadioGroup('position', settings.position);
  bindRadioGroup('show', settings.show);
  const autoRemember = document.getElementById('autoRemember') as HTMLInputElement;
  autoRemember.checked = settings.autoRemember;
  autoRemember.addEventListener('change', () => void writeSettings({ autoRemember: autoRemember.checked }));
  await renderSites();
  // Keep the list current while the page is open (sizes changed in other tabs, removals here).
  browser.storage.onChanged.addListener((_changes, area) => {
    if (area === 'local') void renderSites();
  });
}

void init();
