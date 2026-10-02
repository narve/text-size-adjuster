import { defineConfig } from 'vite';

// Separate single-entry config per script — Rollup's IIFE format doesn't support multiple inputs
// in one build (each output must be fully self-contained, no shared chunk), and that's exactly
// what we want anyway: content script, background, and popup run in genuinely separate contexts.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: 'src/content-script.ts',
      formats: ['iife'],
      name: 'TSAContent',
      fileName: () => 'content.js',
    },
  },
});
