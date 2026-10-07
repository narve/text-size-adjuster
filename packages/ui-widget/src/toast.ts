import { DEFAULT_IGNORE_ATTR } from '@tsa/core';
import { followVisualViewport } from './viewport.js';

/** How long a toast stays up. */
export const TOAST_MS = 3000;

const TOAST_CSS = `
  :host { all: initial; }
  .tsa-toast {
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 2147483647;
    max-width: calc(100vw - 32px);
    box-sizing: border-box;
    padding: 10px 16px;
    border-radius: 999px;
    background: #202124;
    color: #fff;
    font-family: system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.3;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
    pointer-events: none;
  }
`;

/**
 * A short message in the top left corner of the visible area that goes away by itself: a page
 * changed without the user doing anything just now (a remembered size applied on load) says so.
 * In its own shadow root and marked `data-tsa-ignore`, like the control, and out of its way:
 * the control's corners are at the bottom by default. Returns a function that removes it early.
 */
export function showToast(text: string, doc: Document = document, duration: number = TOAST_MS): () => void {
  const host = doc.createElement('div');
  host.setAttribute(DEFAULT_IGNORE_ATTR, '');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = TOAST_CSS;
  const panel = doc.createElement('div');
  panel.className = 'tsa-toast';
  panel.setAttribute('role', 'status');
  panel.textContent = text;
  shadow.append(style, panel);
  (doc.body ?? doc.documentElement).appendChild(host);

  const win = doc.defaultView;
  const stopFollowing = win ? followVisualViewport(win, panel, 'top-left') : () => {};
  const remove = () => {
    clearTimeout(timer);
    stopFollowing();
    host.remove();
  };
  const timer = setTimeout(remove, duration);
  return remove;
}
