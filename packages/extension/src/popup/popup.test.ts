import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const browser = vi.hoisted(() => ({
  tabs: { query: vi.fn(), sendMessage: vi.fn() },
  storage: { local: { get: vi.fn(), set: vi.fn() } },
  runtime: { openOptionsPage: vi.fn() },
}));
vi.mock('webextension-polyfill', () => ({ default: browser }));

const html = readFileSync(path.join(__dirname, 'popup.html'), 'utf8');

/** Loads the popup's markup and runs popup.ts against it, as opening the popup does. */
async function openPopup(): Promise<void> {
  document.body.innerHTML = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script'));
  vi.resetModules();
  await import('./popup.js');
  await vi.waitFor(() => expect(browser.tabs.sendMessage).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const element = (id: string) => document.getElementById(id) as HTMLButtonElement;

describe('popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    browser.tabs.query.mockResolvedValue([{ id: 1, url: 'https://example.com/page' }]);
    browser.storage.local.get.mockResolvedValue({});
  });

  it("shows the page's current size", async () => {
    browser.tabs.sendMessage.mockResolvedValue({ factor: 1.5 });
    await openPopup();
    expect(element('display').textContent).toBe('150%');
    expect(element('increase').disabled).toBe(false);
    expect(element('unavailable').hidden).toBe(true);
  });

  it('says so, and disables the buttons, on a page it cannot change', async () => {
    browser.tabs.query.mockResolvedValue([{ id: 1, url: 'about:addons' }]);
    browser.tabs.sendMessage.mockRejectedValue(new Error('Could not establish connection.'));
    await openPopup();
    expect(element('unavailable').hidden).toBe(false);
    for (const id of ['decrease', 'increase', 'reset']) expect(element(id).disabled).toBe(true);
    expect(element('remember').hidden).toBe(true);
  });
});
