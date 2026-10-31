import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths: works at https://weijzzz.github.io/jiaohuo/ as well as
  // at a domain root.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Jiaohuo · Consulta de artículos',
        short_name: 'Jiaohuo',
        description: 'Consulta de precios por EAN o código de artículo, sin conexión.',
        lang: 'es',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#0b1120',
        theme_color: '#0b1120',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The article snapshot lives in IndexedDB, so the service worker only
        // has to precache the shell for the app to work on the shop floor.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
