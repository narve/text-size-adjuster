/**
 * `:host { all: initial }` resets everything the host page's CSS could otherwise inherit in —
 * the whole point of using a shadow root for this widget. Font sizes here are deliberately plain
 * px values, immune to the host page's cascade; the engine itself is also told to ignore this
 * subtree entirely (`data-tsa-ignore`), so it never captures/rescales these rules either.
 */
export const WIDGET_CSS = `
  :host {
    all: initial;
  }
  .tsa-widget {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 2px;
    background: #202124;
    color: #fff;
    border-radius: 999px;
    padding: 6px;
    font-family: system-ui, sans-serif;
    font-size: 13px;
    line-height: 1;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
  }
  .tsa-widget button {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 15px;
  }
  .tsa-widget button:hover,
  .tsa-widget button:focus-visible {
    background: rgba(255, 255, 255, 0.18);
  }
  .tsa-widget button:focus-visible {
    outline: 2px solid #8ab4f8;
    outline-offset: -2px;
  }
  .tsa-widget [data-tsa-display] {
    min-width: 3.2em;
    text-align: center;
    padding: 0 2px;
  }
  .tsa-widget [data-action='close'] {
    font-size: 13px;
    opacity: 0.7;
  }
`;
