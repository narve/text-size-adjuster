import { createEngine } from '@tsa/core';
import { createFloatingWidget } from '@tsa/ui-widget';

// Deliberately no persistence wired up here: FR1.4/FR5.2 make "ad hoc, resets on reload" the
// userscript's default. @tsa/stores' GMValueStore + @tsa/core's bindStore exist for a user who
// wants per-site persistence anyway (FR5.3, a nice-to-have, not the primary ask) — wiring that up
// is a deliberate opt-in left to a later iteration, not something this entry point does silently.

function start(): void {
  const engine = createEngine();
  engine.attach();

  const widget = createFloatingWidget();
  widget.mount(engine);
}

// Defensive regardless of the userscript manager actually honoring `@run-at document-idle`
// above (or a test harness injecting this even earlier, ignoring that comment entirely, the way
// Playwright's addInitScript does): the engine needs `document.documentElement` to exist.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
