import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // native Vite tsconfig path resolution (replaces vite-tsconfig-paths plugin)
    tsconfigPaths: true,
  },
  test: {
    // lib tests are pure Node — switch to jsdom when component tests are added
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    setupFiles: ['./src/test/setup.ts'],
    // explicit vitest imports in every test file — globals off enforces import discipline
    globals: false,
    coverage: {
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
})
