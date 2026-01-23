import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "node:crypto": path.resolve(__dirname, "./src/lib/polyfills/crypto-polyfill.ts"),
      "crypto": path.resolve(__dirname, "./src/lib/polyfills/crypto-polyfill.ts"),
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
    exclude: [
      '@sentry/node-core',
      '@sentry/node',
      'telegraf',
      '@telegraf/session',
      'sandwich-stream',
      'fsevents'
    ],
    entries: ['src/**/*.{ts,tsx}'],
  },
  build: {
    rollupOptions: {
      external: [
        '@sentry/node-core',
        '@sentry/node',
        'telegraf',
        '@telegraf/session',
        'sandwich-stream',
        'fsevents',
        'node:util',
        'node:fs',
        'node:fs/promises',
        'node:path',
        // 'node:crypto',
        'node:http',
        'node:https',
        'node:url',
        'node:stream',
        'stream',
        // 'crypto',
        'http',
        'https',
        'url',
        'path',
        'fs',
        'fs/promises'
      ],
    },
  },
})
