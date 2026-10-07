import browser from 'webextension-polyfill';
import type { FactorResponse, Message } from '../protocol.js';
import { formatFactor } from '@tsa/ui-widget';
import { isSiteKey, normalizeSettings, SETTINGS_KEY } from '../settings.js';

/**
 * Zero engine logic here (FR4.3) — every button just sends a message to the active tab's top
 * frame (frameId 0) and renders whatever factor comes back. The content script there drives the
 * real engine and relays to other frames via the background (see background.ts).
 */
async function getActiveTab(): Promise<browser.Tabs.Tab | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(message: Message): Promise<FactorResponse | undefined> {
  const tabId = (await getActiveTab())?.id;
  if (tabId === undefined) return undefined;
  try {
    return (await browser.tabs.sendMessage(tabId, message, { frameId: 0 })) as FactorResponse;
  } catch {
    // No content script on this tab (e.g. a browser internal page) — nothing to show.
    return undefined;
  }
}

const display = document.getElementById('display')!;
const showControl = document.getElementById('show-control') as HTMLButtonElement;

/**
 * The size, and FR9.7: while the page's own control can't be seen (hidden with ×, or still
 * waiting for a zoom), a button that brings it back.
 */
function render(result: FactorResponse): void {
  display.textContent = formatFactor(result.factor);
  showControl.hidden = result.controlVisible !== false;
}

function wire(buttonId: string, message: Message): void {
  document.getElementById(buttonId)!.addEventListener('click', () => {
    void send(message).then((result) => {
      if (result) render(result);
    });
  });
}

wire('increase', { type: 'tsa:increase' });
wire('decrease', { type: 'tsa:decrease' });
wire('reset', { type: 'tsa:reset' });
wire('show-control', { type: 'tsa:showControl' });

/** No content script answers here: Firefox's own pages, or a site the add-on may not access. */
function showUnavailable(): void {
  for (const id of ['decrease', 'increase', 'reset']) {
    (document.getElementById(id) as HTMLButtonElement).disabled = true;
  }
  document.getElementById('unavailable')!.hidden = false;
}

const initial = send({ type: 'tsa:getFactor' }).then((result) => {
  if (result) render(result);
  else showUnavailable();
  return result;
});

document.getElementById('options')!.addEventListener('click', (event) => {
  event.preventDefault();
  void browser.runtime.openOptionsPage();
  window.close();
});

/** How long the "nothing to remember" note stays up. */
const NOTE_MS = 4000;

/**
 * FR9.5: with automatic remembering off, offer to remember the current tab's site. Saving its
 * current size adds it to the options page's list; the content script's store then keeps updating
 * it on later changes (see createGatedStore). At normal size there is nothing to remember — a
 * stored site always has a size of its own (see bindStore) — so the button only says so.
 */
async function setUpRememberButton(): Promise<void> {
  if (!(await initial)) return;
  const tab = await getActiveTab();
  if (!tab?.url) return;
  const origin = new URL(tab.url).origin;
  if (!isSiteKey(origin)) return;
  const stored = await browser.storage.local.get([SETTINGS_KEY, origin]);
  if (normalizeSettings(stored[SETTINGS_KEY]).autoRemember || origin in stored) return;

  const button = document.getElementById('remember') as HTMLButtonElement;
  button.hidden = false;
  const note = document.getElementById('remember-note')!;
  let noteTimer: ReturnType<typeof setTimeout> | undefined;
  button.addEventListener('click', async () => {
    const factor = (await send({ type: 'tsa:getFactor' }))?.factor ?? 1;
    if (factor === 1) {
      note.hidden = false;
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => (note.hidden = true), NOTE_MS);
      return;
    }
    note.hidden = true;
    await browser.storage.local.set({ [origin]: factor });
    button.textContent = 'Site remembered';
    button.disabled = true;
  });
}

void setUpRememberButton();
