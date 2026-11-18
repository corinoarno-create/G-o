// Petits utilitaires de fichiers partagés par les scripts de données.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Racine du dépôt (le dossier parent de scripts/). */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Dossier des téléchargements bruts (ignoré par git, régénérable). */
export const RAW_DIR = join(ROOT, 'data', 'raw');

/** Dossier des corrections et sources saisies à la main (versionnées). */
export const SOURCES_DIR = join(ROOT, 'data', 'sources');

/** Dossier des données prêtes à l'emploi, chargées par l'app. */
export const WORLD_DIR = join(ROOT, 'data', 'world');

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

/** Écrit un JSON lisible (indentation 2) en créant le dossier si besoin. */
export async function writeJson(path: string, value: unknown, pretty = true): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, pretty ? 2 : 0) + '\n', 'utf8');
}
