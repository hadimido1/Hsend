import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['HSEND_LOGO.png'],
        manifest: {
          name: 'HiSEND',
          short_name: 'HiSEND',
          start_url: '/',
          display: 'standalone',
          background_color: '#0b141a',
          theme_color: '#00a884',
          orientation: 'portrait-primary',
          icons: [
            {
              src: '/HSEND_LOGO.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/HSEND_LOGO.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,woff2,ico}'],
          maximumFileSizeToCacheInBytes: 5000000, // 5 MB
          cleanupOutdatedCaches: true,
          sourcemap: false
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: { target: "es2015" },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
