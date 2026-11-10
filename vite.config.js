import { defineConfig } from 'vite';

// Relative paths so the build works from any folder (GitHub Pages, a local
// server, or an embedded preview). Fonts are inlined into the stylesheet.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 200000,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { entryFileNames: 'app.js', chunkFileNames: 'chunk-[name].js', assetFileNames: '[name][extname]' },
    },
  },
});
