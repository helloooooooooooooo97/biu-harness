import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:3141',
      '/ws': { target: 'ws://127.0.0.1:3141', ws: true },
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
})
