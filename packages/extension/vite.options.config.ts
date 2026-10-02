import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // vite.content.config.ts already cleaned dist/ for this build run
    lib: {
      entry: 'src/options/options.ts',
      formats: ['iife'],
      name: 'TSAOptions',
      fileName: () => 'options.js',
    },
  },
});
