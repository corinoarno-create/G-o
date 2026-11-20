// Export et import de la progression en JSON (§ 2) : sauvegarde, et passage du PC au téléphone.
//
// Le fichier est versionné : un fichier d'une ancienne version est mis à niveau à l'import,
// un fichier d'une version plus récente que l'app est refusé avec un message clair.
// Deux façons d'importer :
// - « fusionner » (par défaut) : on garde, pour chaque carte, la révision la plus récente des deux côtés,
//   et on réunit les journaux ; c'est ce qu'il faut pour passer d'un appareil à l'autre ;
// - « remplacer » : la base reprend exactement le contenu du fichier.
import { readSnapshot, replaceSnapshot, type GeoDatabase } from './db.ts';
import {
  cardErased,
  mergeByKey,
  newerCard,
  newerRecord,
  reviewErased,
  reviewIdentity,
  timingErased,
  unionResets,
} from './merge.ts';
import {
  emptySnapshot,
  type CardRecord,
  type ProgressSnapshot,
  type ResetRecord,
  type ReviewRecord,
} from './schema.ts';

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
  // Le numéro et le drapeau « déjà synchronisée » ne valent que pour cette base-ci.
  const reviews = snapshot.reviews.map(({ id: _id, pushed: _pushed, ...review }) => review);
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

/** Rétablit une carte mémoire lue en JSON (dates en texte). */
export function reviveCard(record: Record<string, unknown>, where: string): CardRecord {
  if (typeof record.key !== 'string' || !isObject(record.card)) {
    throw new BackupError(`Données abîmées : ${where} illisible.`);
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
}

/** Rétablit une réponse lue en JSON (sans numéro ni drapeau de synchronisation). */
export function reviveReview(record: Record<string, unknown>, where: string): ReviewRecord {
  if (typeof record.cardKey !== 'string') throw new BackupError(`Données abîmées : ${where} illisible.`);
  const { id: _id, pushed: _pushed, ...rest } = record;
  return { ...rest, at: toDate(record.at, where) } as unknown as ReviewRecord;
}

/** Rétablit une trace de remise à zéro lue en JSON. */
export function reviveReset(record: Record<string, unknown>, where: string): ResetRecord {
  const valid =
    typeof record.id === 'string' &&
    (record.entityIds === undefined || Array.isArray(record.entityIds)) &&
    (record.skills === undefined || Array.isArray(record.skills));
  if (!valid) throw new BackupError(`Données abîmées : ${where} illisible.`);
  return { ...record, at: toDate(record.at, where) } as unknown as ResetRecord;
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

  const cards = arrayOf(data, 'cards').map((record, i) => reviveCard(record, `carte n° ${i + 1}`));
  const reviews = arrayOf(data, 'reviews').map((record, i) => reviveReview(record, `réponse n° ${i + 1}`));
  // Absentes des fichiers exportés avant la synchronisation (20/11/2026).
  const resets = arrayOf(data, 'resets').map((record, i) => reviveReset(record, `remise à zéro n° ${i + 1}`));
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
    resets,
  };
}

export interface MergeSummary {
  cardsAdded: number;
  cardsUpdated: number;
  reviewsAdded: number;
}

/**
 * Fusionne deux progressions (règles dans merge.ts) : pour chaque carte, la plus récemment révisée
 * l'emporte ; les journaux sont réunis sans doublon ; pour les temps et réglages, la dernière
 * modification l'emporte (à défaut de date, on garde ce qui existe ici) ; les favoris : le plus récent.
 * Les remises à zéro des deux côtés sont réunies et appliquées.
 */
export function mergeSnapshots(
  local: ProgressSnapshot,
  incoming: ProgressSnapshot,
): { snapshot: ProgressSnapshot; summary: MergeSummary } {
  const summary: MergeSummary = { cardsAdded: 0, cardsUpdated: 0, reviewsAdded: 0 };
  const resets = unionResets(local.resets, incoming.resets);

  const cards = new Map(
    local.cards.filter((record) => !cardErased(record, resets)).map((record) => [record.key, record]),
  );
  for (const record of incoming.cards) {
    if (cardErased(record, resets)) continue;
    const existing = cards.get(record.key);
    if (!existing) summary.cardsAdded += 1;
    else if (newerCard(existing, record) === record) summary.cardsUpdated += 1;
    else continue;
    cards.set(record.key, record);
  }

  const reviews = local.reviews.filter((review) => !reviewErased(review, resets));
  const known = new Set(reviews.map(reviewIdentity));
  for (const review of incoming.reviews) {
    if (known.has(reviewIdentity(review)) || reviewErased(review, resets)) continue;
    known.add(reviewIdentity(review));
    reviews.push(review);
    summary.reviewsAdded += 1;
  }
  reviews.sort((a, b) => a.at.getTime() - b.at.getTime());

  const favorites = new Map(local.favorites.map((record) => [record.id, record]));
  for (const record of incoming.favorites) {
    const existing = favorites.get(record.id);
    if (!existing || record.updatedAt.getTime() > existing.updatedAt.getTime()) favorites.set(record.id, record);
  }

  return {
    snapshot: {
      cards: [...cards.values()],
      reviews,
      timing: mergeByKey(local.timing, incoming.timing, newerRecord).filter((record) => !timingErased(record, resets)),
      settings: mergeByKey(local.settings, incoming.settings, newerRecord),
      favorites: [...favorites.values()],
      resets,
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
