// Export et import de la progression en JSON (§ 2) : sauvegarde, et passage du PC au téléphone.
//
// Le fichier est versionné : un fichier d'une ancienne version est mis à niveau à l'import,
// un fichier d'une version plus récente que l'app est refusé avec un message clair.
// Deux façons d'importer :
// - « fusionner » (par défaut) : on garde, pour chaque carte, la révision la plus récente des deux côtés,
//   et on réunit les journaux ; c'est ce qu'il faut pour passer d'un appareil à l'autre ;
// - « remplacer » : la base reprend exactement le contenu du fichier.
import { readSnapshot, replaceSnapshot, type GeoDatabase } from './db.ts';
import { emptySnapshot, type CardRecord, type ProgressSnapshot, type ReviewRecord } from './schema.ts';

export const BACKUP_FORMAT = 'geo-progression';
/** Version du format de fichier : à augmenter (avec une migration ci-dessous) si sa structure change. */
export const BACKUP_VERSION = 1;

export type ImportMode = 'merge' | 'replace';

export class BackupError extends Error {}

interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: ProgressSnapshot;
}

/** Transforme le contenu de la base en texte JSON (dates au format ISO). */
export function serializeBackup(snapshot: ProgressSnapshot, now: Date): string {
  const reviews = snapshot.reviews.map(({ id: _ignored, ...review }) => review);
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data: { ...snapshot, reviews },
  };
  return JSON.stringify(file);
}

/** Migrations du format : migrations[n] transforme un fichier de version n en version n + 1. */
const MIGRATIONS: Record<number, (file: Record<string, unknown>) => Record<string, unknown>> = {};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function toDate(value: unknown, where: string): Date {
  const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new BackupError(`Date invalide dans le fichier (${where}).`);
  return date;
}

function arrayOf(data: Record<string, unknown>, name: keyof ProgressSnapshot): Record<string, unknown>[] {
  const value = data[name] ?? [];
  if (!Array.isArray(value) || !value.every(isObject)) {
    throw new BackupError(`Le fichier est abîmé : la liste « ${name} » est illisible.`);
  }
  return value;
}

/** Lit un fichier d'export, le met à niveau si besoin et rétablit les dates. */
export function parseBackup(text: string): ProgressSnapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("Ce fichier n'est pas un fichier JSON lisible.");
  }
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) {
    throw new BackupError("Ce fichier n'est pas une sauvegarde de progression Géo.");
  }
  let file = raw;
  let version = typeof file.version === 'number' ? file.version : NaN;
  if (!Number.isInteger(version) || version < 1) throw new BackupError('Version de sauvegarde inconnue.');
  if (version > BACKUP_VERSION) {
    throw new BackupError('Cette sauvegarde vient d’une version plus récente de l’app : mets d’abord l’app à jour.');
  }
  while (version < BACKUP_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new BackupError(`Impossible de mettre à niveau une sauvegarde de version ${version}.`);
    file = migrate(file);
    version += 1;
  }
  if (!isObject(file.data)) throw new BackupError('Le fichier est abîmé : pas de données.');
  const data = file.data;

  const cards = arrayOf(data, 'cards').map((record, i) => {
    if (typeof record.key !== 'string' || !isObject(record.card)) {
      throw new BackupError(`Le fichier est abîmé : carte n° ${i + 1} illisible.`);
    }
    const card = record.card;
    return {
      ...record,
      card: {
        ...card,
        dueAt: toDate(card.dueAt, `carte ${record.key}`),
        lastReviewAt: card.lastReviewAt == null ? null : toDate(card.lastReviewAt, `carte ${record.key}`),
      },
    } as unknown as CardRecord;
  });
  const reviews = arrayOf(data, 'reviews').map((record, i) => {
    if (typeof record.cardKey !== 'string') throw new BackupError(`Le fichier est abîmé : réponse n° ${i + 1} illisible.`);
    const { id: _ignored, ...rest } = record;
    return { ...rest, at: toDate(record.at, `réponse n° ${i + 1}`) } as unknown as ReviewRecord;
  });
  const favorites = arrayOf(data, 'favorites').map((record) => ({
    ...record,
    updatedAt: toDate(record.updatedAt, `favori ${String(record.id)}`),
  }));
  return {
    cards,
    reviews,
    timing: arrayOf(data, 'timing') as unknown as ProgressSnapshot['timing'],
    settings: arrayOf(data, 'settings') as unknown as ProgressSnapshot['settings'],
    favorites: favorites as unknown as ProgressSnapshot['favorites'],
  };
}

export interface MergeSummary {
  cardsAdded: number;
  cardsUpdated: number;
  reviewsAdded: number;
}

const lastReview = (record: CardRecord) => record.card.lastReviewAt?.getTime() ?? -Infinity;
const reviewId = (review: ReviewRecord) => `${review.at.getTime()}|${review.cardKey}`;

/**
 * Fusionne deux progressions : pour chaque carte, la plus récemment révisée l'emporte ;
 * les journaux sont réunis sans doublon ; pour les temps, réglages et favoris, on garde
 * ce qui existe déjà ici et on ajoute ce qui manque (les favoris : le plus récent l'emporte).
 */
export function mergeSnapshots(
  local: ProgressSnapshot,
  incoming: ProgressSnapshot,
): { snapshot: ProgressSnapshot; summary: MergeSummary } {
  const summary: MergeSummary = { cardsAdded: 0, cardsUpdated: 0, reviewsAdded: 0 };

  const cards = new Map(local.cards.map((record) => [record.key, record]));
  for (const record of incoming.cards) {
    const existing = cards.get(record.key);
    if (!existing) summary.cardsAdded += 1;
    else if (lastReview(record) > lastReview(existing)) summary.cardsUpdated += 1;
    else continue;
    cards.set(record.key, record);
  }

  const known = new Set(local.reviews.map(reviewId));
  const reviews = [...local.reviews];
  for (const review of incoming.reviews) {
    if (known.has(reviewId(review))) continue;
    known.add(reviewId(review));
    reviews.push(review);
    summary.reviewsAdded += 1;
  }
  reviews.sort((a, b) => a.at.getTime() - b.at.getTime());

  const addMissing = <T extends { key: string }>(mine: T[], theirs: T[]) => {
    const keys = new Set(mine.map((record) => record.key));
    return [...mine, ...theirs.filter((record) => !keys.has(record.key))];
  };

  const favorites = new Map(local.favorites.map((record) => [record.id, record]));
  for (const record of incoming.favorites) {
    const existing = favorites.get(record.id);
    if (!existing || record.updatedAt.getTime() > existing.updatedAt.getTime()) favorites.set(record.id, record);
  }

  return {
    snapshot: {
      cards: [...cards.values()],
      reviews,
      timing: addMissing(local.timing, incoming.timing),
      settings: addMissing(local.settings, incoming.settings),
      favorites: [...favorites.values()],
    },
    summary,
  };
}

/** Nom du fichier d'export : « geo-progression-2026-11-18.json ». */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${BACKUP_FORMAT}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

/** Exporte toute la progression. */
export async function exportBackup(db: GeoDatabase, now = new Date()): Promise<{ fileName: string; text: string }> {
  return { fileName: backupFileName(now), text: serializeBackup(await readSnapshot(db), now) };
}

/** Importe un fichier de sauvegarde. Le fichier est entièrement vérifié avant toute écriture. */
export async function importBackup(db: GeoDatabase, text: string, mode: ImportMode = 'merge'): Promise<MergeSummary> {
  const incoming = parseBackup(text);
  if (mode === 'replace') {
    const { summary } = mergeSnapshots(emptySnapshot(), incoming);
    await replaceSnapshot(db, incoming);
    return summary;
  }
  const { snapshot, summary } = mergeSnapshots(await readSnapshot(db), incoming);
  await replaceSnapshot(db, snapshot);
  return summary;
}

/** Fait télécharger un texte comme fichier par le navigateur. */
export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
