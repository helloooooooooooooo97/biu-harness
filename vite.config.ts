import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:3141',
      '/ws': { target: 'ws://127.0.0.1:3141', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
  },
})
