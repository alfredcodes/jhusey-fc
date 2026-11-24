import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Public files the installed app needs offline (next to the built JS/CSS).
const PUBLIC_PRECACHE = [
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/favicon-32.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/login-bg-portrait.webp',
  '/login-bg-landscape.webp',
]

/**
 * PWA without a plugin dependency: at build time, writes dist/sw.js from pwa/sw-template.js
 * with this build's file list and a version hash, so every deploy is a new service worker.
 */
function serviceWorker(): Plugin {
  return {
    name: 'jfc-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter((file) => !file.endsWith('.map'))
        .sort()
      const hash = createHash('sha256')
      for (const file of files) {
        const output = bundle[file]
        hash.update(file)
        hash.update(output.type === 'asset' ? output.source : output.code)
      }
      const precache = [
        '/',
        ...files.filter((file) => file !== 'index.html').map((file) => `/${file}`),
        ...PUBLIC_PRECACHE,
      ]
      const template = readFileSync(new URL('./pwa/sw-template.js', import.meta.url), 'utf8')
      const source = template
        .replace(/\/\* __VERSION__ \*\/\s*'dev'/, JSON.stringify(hash.digest('hex').slice(0, 12)))
        .replace(/\/\* __PRECACHE__ \*\/\s*\[\]/, JSON.stringify(precache))
      if (source.includes('__VERSION__') || source.includes('__PRECACHE__')) {
        this.error('pwa/sw-template.js: placeholders not found')
      }
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
// `vitest/config` re-exports Vite's defineConfig and adds typing for the `test` block.
export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
