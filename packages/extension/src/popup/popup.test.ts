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

  it("offers to show the page's control only while it can't be seen", async () => {
    browser.tabs.sendMessage.mockResolvedValue({ factor: 1, controlVisible: true });
    await openPopup();
    expect(element('show-control').hidden).toBe(true);

    browser.tabs.sendMessage.mockResolvedValue({ factor: 1, controlVisible: false });
    await openPopup();
    expect(element('show-control').hidden).toBe(false);

    browser.tabs.sendMessage.mockResolvedValue({ factor: 1, controlVisible: true });
    element('show-control').click();
    await vi.waitFor(() => expect(element('show-control').hidden).toBe(true));
    expect(browser.tabs.sendMessage).toHaveBeenLastCalledWith(1, { type: 'tsa:showControl' }, { frameId: 0 });
  });

  describe('"Remember this site", with automatic remembering off', () => {
    beforeEach(() => {
      browser.storage.local.get.mockResolvedValue({ 'tsa:settings': { autoRemember: false } });
    });

    it("saves the page's size for the site", async () => {
      browser.tabs.sendMessage.mockResolvedValue({ factor: 1.5 });
      await openPopup();
      await vi.waitFor(() => expect(element('remember').hidden).toBe(false));
      element('remember').click();
      await vi.waitFor(() =>
        expect(browser.storage.local.set).toHaveBeenCalledWith({ 'https://example.com': 1.5 }),
      );
      expect(element('remember').disabled).toBe(true);
    });

    it('saves nothing at normal size, and says why', async () => {
      browser.tabs.sendMessage.mockResolvedValue({ factor: 1 });
      await openPopup();
      await vi.waitFor(() => expect(element('remember').hidden).toBe(false));
      element('remember').click();
      await vi.waitFor(() => expect(element('remember-note').hidden).toBe(false));
      expect(browser.storage.local.set).not.toHaveBeenCalled();
      expect(element('remember').disabled).toBe(false);
    });
  });
});
