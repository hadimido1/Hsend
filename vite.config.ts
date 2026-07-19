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
        includeAssets: ['hsend_logo_v3.svg'],
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
              src: '/hsend_logo_v3.svg',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: '/hsend_logo_v3.svg',
              sizes: '512x512',
              type: 'image/svg+xml'
            },
            {
              src: '/hsend_logo_v3.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,woff2,ico}'],
          maximumFileSizeToCacheInBytes: 5000000 // 5 MB
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
