/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    // Babylon.js is imported as a whole for now (see docs/DECISIONS.md, D-007).
    chunkSizeWarningLimit: 8000,
  },
  worker: {
    // The AudioWorklet processor is bundled through `?worker&url`; worklets load ES modules.
    format: 'es',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
