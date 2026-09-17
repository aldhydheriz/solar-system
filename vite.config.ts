import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  server: {
    port: 8000,
  },
  test: {
    exclude: ['node_modules', 'dist', 'e2e/**'],
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Single-file SW next to index.html works with base './' (GitHub Pages).
      strategies: 'generateSW',
      manifest: {
        name: 'Solar System 3D',
        short_name: 'Solar3D',
        description: 'Interactive 3D solar system — planets, moons, orbits.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          {
            src: './pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // App shell + bundled textures (imported jpgs are hashed into assets/).
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff2}'],
        // Textures are already precached via globPatterns; runtime cache is a
        // safety net for any texture URL resolved at runtime.
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'textures',
              expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
});
