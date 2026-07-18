import { defineConfig } from 'vite';

// Vite config: plain TS + GLSL-as-string project, no framework plugins needed.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
