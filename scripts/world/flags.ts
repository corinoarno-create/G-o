// Drapeaux : copie des SVG (flag-icons, format 4:3) dans data/flags/,
// et repérage des drapeaux identiques (ex. Guadeloupe et France), à exclure du mode Drapeaux.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CountryEntity } from '../../src/data/types.ts';
import type { EntityWithoutFlag } from './entities.ts';

/** Drapeaux absents de flag-icons, récupérés sur Wikimedia Commons (domaine public). */
const EXTRA_FLAGS: Record<string, string> = {
  cyn: 'wikimedia/flag-northern-cyprus.svg',
  sol: 'wikimedia/flag-somaliland.svg',
};

/**
 * Fichiers flag-icons à utiliser à la place du code ISO. Pour « sh », flag-icons donne le drapeau
 * britannique (territoire composite) : on prend celui de Sainte-Hélène.
 */
const FLAG_ICONS_ALIASES: Record<string, string> = { sh: 'sh-hl' };

export interface FlagPaths {
  flagIconsDir: string;
  rawDir: string;
  outputDir: string;
}

/** Retire d'un SVG tout ce qui pourrait exécuter du code ou charger une ressource externe. */
export function sanitizeSvg(svg: string): string {
  if (/<script|<foreignObject|\son\w+\s*=|javascript:/i.test(svg)) {
    throw new Error('SVG de drapeau suspect (script ou gestionnaire d’événement)');
  }
  // Les liens externes (http…) sont refusés ; les références internes (#id) restent permises.
  if (/(?:xlink:)?href\s*=\s*["'](?!#)/i.test(svg)) {
    throw new Error('SVG de drapeau avec une référence externe');
  }
  return (
    svg
      .replace(/<\?xml[^>]*>\s*/, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      // flag-icons met un id propre à chaque fichier ; on le retire pour repérer les drapeaux identiques.
      .replace(/\s+id="flag-icons-[^"]*"/, '')
      .trim() + '\n'
  );
}

/**
 * @param manualSameAs drapeaux identiques déclarés à la main (dessin identique, SVG différent),
 *                     ex. { sj: 'no' } pour le Svalbard qui utilise le drapeau norvégien.
 */
export async function buildFlags(
  entities: EntityWithoutFlag[],
  paths: FlagPaths,
  manualSameAs: Record<string, string>,
): Promise<{ entities: CountryEntity[]; warnings: string[] }> {
  const warnings: string[] = [];
  await rm(paths.outputDir, { recursive: true, force: true });
  await mkdir(paths.outputDir, { recursive: true });

  const hashes = new Map<string, string>();
  const withFlags: CountryEntity[] = [];
  for (const entity of entities) {
    const source = EXTRA_FLAGS[entity.id]
      ? join(paths.rawDir, EXTRA_FLAGS[entity.id]!)
      : join(paths.flagIconsDir, `${FLAG_ICONS_ALIASES[entity.id] ?? entity.id}.svg`);
    if (!existsSync(source)) {
      withFlags.push({ ...entity, flag: null, flagSameAs: null });
      continue;
    }
    const svg = sanitizeSvg(await readFile(source, 'utf8'));
    const file = `${entity.id}.svg`;
    await writeFile(join(paths.outputDir, file), svg, 'utf8');
    hashes.set(entity.id, createHash('sha256').update(svg).digest('hex'));
    withFlags.push({ ...entity, flag: file, flagSameAs: null });
  }

  const byId = new Map(withFlags.map((e) => [e.id, e]));
  for (const [id, owner] of Object.entries(manualSameAs)) {
    const entity = byId.get(id);
    if (!entity || !byId.has(owner)) throw new Error(`flagSameAs invalide : ${id} → ${owner}`);
    entity.flagSameAs = owner;
  }

  // Regroupe les fichiers identiques. Le « propriétaire » d'un groupe est l'État de rattachement des autres
  // membres s'il en fait partie, sinon l'éventuel État membre de l'ONU du groupe.
  const groups = new Map<string, CountryEntity[]>();
  for (const entity of withFlags) {
    const hash = hashes.get(entity.id);
    if (hash) groups.set(hash, [...(groups.get(hash) ?? []), entity]);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const owner =
      group.find((e) => group.some((other) => other.sovereign === e.id)) ??
      group.find((e) => e.status === 'un-member');
    for (const entity of group) {
      if (entity.flagSameAs) continue; // déjà déclaré à la main
      if (owner && entity.id !== owner.id) entity.flagSameAs = owner.id;
      else if (!owner) warnings.push(`${entity.id} : drapeau identique à ${group.map((e) => e.id).join(', ')}, sans propriétaire évident`);
    }
  }
  return { entities: withFlags, warnings };
}
