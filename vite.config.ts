import { defineConfig } from 'vitest/config';

// Deployed as a GitHub Pages project site: https://rlaput.github.io/nz-tax-refund-estimator/
export default defineConfig({
  base: '/nz-tax-refund-estimator/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'node',
  },
});
