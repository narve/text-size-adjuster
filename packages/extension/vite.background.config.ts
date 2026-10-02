import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false, // vite.content.config.ts already cleaned dist/ for this build run
    lib: {
      entry: 'src/background.ts',
      formats: ['iife'],
      name: 'TSABackground',
      fileName: () => 'background.js',
    },
  },
});
