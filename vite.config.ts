import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
