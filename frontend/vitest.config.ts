import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    maxWorkers: 2,
    minWorkers: 1,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts', 'src/test/**'],
      reporter: ['text-summary', 'html', 'json-summary', 'json'],
      reportsDirectory: './coverage',
      // Measured baseline floors, including files without tests. Raise them as coverage grows.
      thresholds: { lines: 19, statements: 19, branches: 66, functions: 44 },
    },
  },
});
