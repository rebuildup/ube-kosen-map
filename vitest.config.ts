import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test-setup.ts', 'src/main.tsx'],
    },
  },
  resolve: {
    alias: {
      '@/core': resolve(__dirname, 'src/core'),
      '@/editor': resolve(__dirname, 'src/editor'),
      '@/viewer': resolve(__dirname, 'src/viewer'),
      '@/math': resolve(__dirname, 'src/math'),
      '@/shared': resolve(__dirname, 'src/shared'),
      '@/components': resolve(__dirname, 'src/components'),
    },
  },
})
