import { defineConfig } from 'vite';
import { assetIndex } from './scripts/asset-index-plugin.js';

// base './' makes the build work from any sub-path (GitHub Pages project sites, artifact hosts, file servers).
export default defineConfig({
  base: './',
  plugins: [assetIndex()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
  server: { host: true },
});
