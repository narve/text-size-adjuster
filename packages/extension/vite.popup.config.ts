import { defineConfig } from 'vite';
import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/popup/popup.ts',
      formats: ['iife'],
      name: 'TSAPopup',
      fileName: () => 'popup.js',
    },
  },
  plugins: [
    {
      // Runs last in the build sequence — copies the remaining static files the manifest/popup
      // reference directly, once all three JS bundles already exist in dist/.
      name: 'copy-extension-static-files',
      closeBundle() {
        copyFileSync(path.resolve(__dirname, 'manifest.json'), path.resolve(__dirname, 'dist/manifest.json'));
        copyFileSync(
          path.resolve(__dirname, 'src/popup/popup.html'),
          path.resolve(__dirname, 'dist/popup.html'),
        );
      },
    },
  ],
});
