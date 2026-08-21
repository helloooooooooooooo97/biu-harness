import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cordisPluginsVite, linkConfiguredPackages } from './host/cordis-plugins.ts'

const root = dirname(fileURLToPath(import.meta.url))
linkConfiguredPackages(root)

export default defineConfig({
  plugins: [react(), tailwindcss(), cordisPluginsVite(root)],
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
