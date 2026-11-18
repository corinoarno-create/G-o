/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Sur GitHub Pages, l'app est servie sous /<nom-du-dépôt>/.
// Le workflow de déploiement fournit ce chemin via BASE_PATH ; en local, on reste à la racine.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [preact()],
  build: {
    // Les drapeaux restent des fichiers à part : sinon Vite intègre les plus petits au JavaScript
    // (en base64), ce qui alourdit le premier chargement pour des images qu'on n'affiche qu'à la demande.
    assetsInlineLimit: (filePath) => (filePath.replace(/\\/g, '/').includes('/data/flags/') ? false : undefined),
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
  },
});
