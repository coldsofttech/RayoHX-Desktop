import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Cornea's content security policy forbids inline code, so nothing is inlined into the page.
  build: {
    assetsInlineLimit: 0,
    // The vendor chunk is mostly Fluent UI (~650 kB) and loads from disk in a desktop window, so size is not a concern.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        // Keep third-party code in its own chunk so the app chunk stays small and caches separately.
        codeSplitting: {
          groups: [{ name: 'vendor', test: /node_modules/ }],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
  },
});
