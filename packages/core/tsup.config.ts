import { defineConfig } from 'tsup';

// Explicitly assigns to `window` rather than relying on the bare top-level `var TSA_CORE = ...`
// IIFE output leaking onto the global object. That leak *does* happen for a plain <script> tag,
// but Playwright's page.addInitScript() evaluates the script in a wrapped scope where a bare
// top-level `var` only becomes a local of that wrapper, not a window property — confirmed by
// testing addScriptTag (works) vs addInitScript (doesn't) with the unqualified output. An
// explicit `window.TSA_CORE = TSA_CORE` from inside that same wrapper still reaches the real
// `window`, since `window` itself is just a global reference, unaffected by the wrapping.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  globalName: 'TSA_CORE',
  outDir: 'dist',
  clean: true,
  footer: {
    js: 'if (typeof window !== "undefined") { window.TSA_CORE = TSA_CORE; }',
  },
});
