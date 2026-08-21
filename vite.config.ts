import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@hmr/greeter-host': join(root, 'packages/greeter-host/src/index.ts'),
      '@hmr/greeter-ui': join(root, 'packages/greeter-ui/src/index.tsx'),
    },
  },
  appType: 'spa',
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
    environmentMatchGlobs: [['host/**', 'node']],
  },
})
