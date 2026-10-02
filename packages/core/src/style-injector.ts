/** Injects the override stylesheet into `root` exactly once, no-op on subsequent calls. */
export function ensureStyleSheet(root: Document | ShadowRoot, id: string, css: string): void {
  if (root.getElementById(id)) return;
  const doc = root instanceof Document ? root : root.ownerDocument;
  if (!doc) return;
  const styleEl = doc.createElement('style');
  styleEl.id = id;
  styleEl.textContent = css;
  const container: Node = root instanceof Document ? (root.head ?? root.documentElement) : root;
  container.appendChild(styleEl);
}
