/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Sur GitHub Pages, l'app est servie sous /<nom-du-dépôt>/.
// Le workflow de déploiement fournit ce chemin via BASE_PATH ; en local, on reste à la racine.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    preact(),
    // PWA (étape 8) : installable sur Android, et tout fonctionne hors ligne après la première visite
    // (app, carte, données, drapeaux et polices sont mis en cache par le service worker).
    VitePWA({
      // Une nouvelle version attend mon accord (bandeau « Mettre à jour ») : pas de rechargement en pleine manche.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Géo — carnet d’explorateur',
        short_name: 'Géo',
        description: 'Apprendre la géographie en s’amusant, avec la répétition espacée.',
        lang: 'fr',
        theme_color: '#f4ead5',
        background_color: '#f4ead5',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout ce qu'il faut pour jouer hors ligne (les polices woff2 suffisent aux navigateurs récents).
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    // Les drapeaux restent des fichiers à part : sinon Vite intègre les plus petits au JavaScript
    // (en base64), ce qui alourdit le premier chargement pour des images qu'on n'affiche qu'à la demande.
    assetsInlineLimit: (filePath) => (filePath.replace(/\\/g, '/').includes('/data/flags/') ? false : undefined),
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
  },
});
