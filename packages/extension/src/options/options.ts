import browser from 'webextension-polyfill';
import { formatFactor, parsePosition, POSITION_LABELS } from '@tsa/ui-widget';
import { isSiteKey, readSettings, SETTINGS_KEY, siteLabel, type ControlSettings } from '../settings.js';

/**
 * Options page (FR9). Everything is read from and written to `browser.storage.local`; open tabs
 * react through `storage.onChanged` (see content-script.ts), so nothing here talks to tabs
 * directly.
 */

async function writeSettings(patch: Partial<ControlSettings>): Promise<void> {
  const next = { ...(await readSettings()), ...patch };
  await browser.storage.local.set({ [SETTINGS_KEY]: next });
}

function bindRadioGroup(name: 'position' | 'show', current: string, onChange?: (value: string) => void): void {
  for (const input of document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)) {
    input.checked = input.value === current;
    input.addEventListener('change', () => {
      if (!input.checked) return;
      onChange?.(input.value);
      void writeSettings({ [name]: input.value } as Partial<ControlSettings>);
    });
  }
}

/** The corner picker's caption, e.g. "Bottom right". */
function showChosenPosition(value: string): void {
  const position = parsePosition(value);
  const label = position ? POSITION_LABELS[position] : '';
  document.getElementById('chosen-position')!.textContent = label.charAt(0).toUpperCase() + label.slice(1);
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
    name.textContent = siteLabel(origin);
    name.title = origin;
    const size = document.createElement('span');
    size.className = 'size';
    size.textContent = formatFactor(factor);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'button button-quiet';
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
  // Version and homepage come from the manifest, which the build fills from package.json and
  // product.json.
  const manifest = browser.runtime.getManifest();
  document.getElementById('version')!.textContent = `Version ${manifest.version}`;
  if (manifest.homepage_url) (document.getElementById('homepage') as HTMLAnchorElement).href = manifest.homepage_url;

  const settings = await readSettings();
  showChosenPosition(settings.position);
  bindRadioGroup('position', settings.position, showChosenPosition);
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
