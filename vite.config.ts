/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// Sur GitHub Pages, l'app est servie sous /<nom-du-dépôt>/.
// Le workflow de déploiement fournit ce chemin via BASE_PATH ; en local, on reste à la racine.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [preact()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
  },
});
