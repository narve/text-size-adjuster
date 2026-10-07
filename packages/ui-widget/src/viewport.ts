import type { WidgetPosition } from './settings.js';

const MARGIN = 16;
// Ignore tiny scale wobbles (sub-pixel rounding, momentary pinch noise) — only a real zoom counts.
const ZOOM_THRESHOLD = 1.05;

/**
 * Calls `onZoom` once the user zooms in: pinch-zoom (visualViewport.scale) or browser page zoom
 * (devicePixelRatio). Both are measured relative to where they started, so a page that was
 * *already* zoomed when it loaded doesn't count — only zooming in during this visit does.
 *
 * For pinch-zoom that matters on phones: a page without a viewport meta tag (a desktop-only
 * page, the kind this tool is most needed on) starts zoomed *out* to fit, at a scale around 0.4,
 * and pinching it up to 1 to read is already a 2.5× zoom. The baseline is the lowest scale seen,
 * in case the page settles at its fitted scale only after this started.
 */
export function watchForZoom(win: Window, onZoom: () => void): () => void {
  const viewport = win.visualViewport;
  const startRatio = win.devicePixelRatio;
  let baseScale = viewport?.scale ?? 1;
  const check = () => {
    if (viewport) baseScale = Math.min(baseScale, viewport.scale);
    const pinched = !!viewport && viewport.scale > baseScale * ZOOM_THRESHOLD;
    const pageZoomed = win.devicePixelRatio > startRatio * ZOOM_THRESHOLD;
    if (pinched || pageZoomed) onZoom();
  };
  viewport?.addEventListener('resize', check);
  win.addEventListener('resize', check);
  check();
  return () => {
    viewport?.removeEventListener('resize', check);
    win.removeEventListener('resize', check);
  };
}

/**
 * A `position: fixed` element is pinned to the layout viewport, which doesn't move or shrink
 * when the user pinch-zooms — so a corner-anchored control would drift off-screen and be
 * magnified with everything else. While the visible area isn't the whole layout viewport, this
 * places the panel at the chosen corner of the *visible* area instead and counter-scales it by
 * 1/scale so it keeps its normal size; when the two match it hands positioning back to the plain
 * corner CSS. Returns a stop function.
 *
 * Not only while pinch-zoomed: on a phone, a page with something wider than the screen gets a
 * layout viewport as wide as that content (seen in Firefox for Android: 766 by 1387 around a
 * visible 360 by 652, at scale 1), and a corner of it is off-screen.
 */
export function followVisualViewport(win: Window, panel: HTMLElement, position: WidgetPosition): () => void {
  const viewport = win.visualViewport;
  if (!viewport) return () => {};

  const update = () => {
    const scale = viewport.scale;
    const fillsLayoutViewport =
      Math.abs(scale - 1) < 0.01 &&
      Math.abs(viewport.width - win.innerWidth) <= 1 &&
      Math.abs(viewport.height - win.innerHeight) <= 1;
    if (fillsLayoutViewport) {
      for (const prop of ['top', 'left', 'right', 'bottom', 'transform', 'transform-origin']) {
        panel.style.removeProperty(prop);
      }
      return;
    }
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const x = position.endsWith('left') ? MARGIN / scale : viewport.width - (width + MARGIN) / scale;
    const y = position.startsWith('top') ? MARGIN / scale : viewport.height - (height + MARGIN) / scale;
    panel.style.setProperty('top', '0px');
    panel.style.setProperty('left', '0px');
    panel.style.setProperty('right', 'auto');
    panel.style.setProperty('bottom', 'auto');
    panel.style.setProperty('transform-origin', '0 0');
    panel.style.setProperty(
      'transform',
      `translate(${viewport.offsetLeft + x}px, ${viewport.offsetTop + y}px) scale(${1 / scale})`,
    );
  };

  // The window's `resize` too: that's the event browser page zoom reveals an on-zoom panel on.
  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  win.addEventListener('resize', update);
  update();
  return () => {
    viewport.removeEventListener('resize', update);
    viewport.removeEventListener('scroll', update);
    win.removeEventListener('resize', update);
  };
}
