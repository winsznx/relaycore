import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    fs: {
      // Allow serving files from project root and specific directories
      allow: ['.'],
      strict: false,
    },
    watch: {
      // Ignore reference folders
      ignored: ['**/_reference/**', '**/node_modules/**', '**/.git/**'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/graphql': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      }
    }
  },
  optimizeDeps: {
    exclude: ['@sentry/node-core', '@sentry/node'],
    entries: ['src/**/*.{ts,tsx}'], // Only scan src folder
  },
  build: {
    rollupOptions: {
      external: ['@sentry/node-core', '@sentry/node', 'node:util', 'node:fs', 'node:path'],
    },
  },
})
