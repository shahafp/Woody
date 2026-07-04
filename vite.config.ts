/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,png,ico}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Dexie is the offline story; never cache authed API responses.
            urlPattern: /supabase\.co/,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'Woody',
        short_name: 'Woody',
        description: 'Timers, weights and workout log for CrossFit athletes',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0a0a0b',
        background_color: '#0a0a0b',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
