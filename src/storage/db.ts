// Accès à la base IndexedDB (via idb). Les fonctions prennent la base en paramètre :
// l'app ouvre la sienne une fois, les tests ouvrent des bases jetables.
import { openDB, type IDBPDatabase } from 'idb';
import type { AnswerMode, Device } from '../engine/grading.ts';
import { timingKey, type TimingStats } from '../engine/grading.ts';
import {
  DB_NAME,
  DB_VERSION,
  STORE_NAMES,
  type CardRecord,
  type FavoriteRecord,
  type GeoDB,
  type ProgressSnapshot,
  type ReviewRecord,
} from './schema.ts';

export type GeoDatabase = IDBPDatabase<GeoDB>;

/** Ouvre (et crée ou met à niveau si besoin) la base. */
export function openGeoDb(name: string = DB_NAME): Promise<GeoDatabase> {
  return openDB<GeoDB>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Migrations successives : chaque bloc fait passer de la version N à N + 1.
      if (oldVersion < 1) {
        const cards = db.createObjectStore('cards', { keyPath: 'key' });
        cards.createIndex('by-entity', 'entityId');
        cards.createIndex('by-due', 'card.dueAt');
        const reviews = db.createObjectStore('reviews', { keyPath: 'id', autoIncrement: true });
        reviews.createIndex('by-card', 'cardKey');
        reviews.createIndex('by-at', 'at');
        db.createObjectStore('timing', { keyPath: 'key' });
        db.createObjectStore('settings', { keyPath: 'key' });
        db.createObjectStore('favorites', { keyPath: 'id' });
      }
    },
  });
}

// --- Cartes mémoire --------------------------------------------------------------------------

export function getCard(db: GeoDatabase, key: string): Promise<CardRecord | undefined> {
  return db.get('cards', key);
}

export function getAllCards(db: GeoDatabase): Promise<CardRecord[]> {
  return db.getAll('cards');
}

/** Cartes dont la révision est due à cette date (les cartes neuves n'ont pas encore de date utile). */
export async function getDueCards(db: GeoDatabase, now: Date): Promise<CardRecord[]> {
  const cards = await db.getAllFromIndex('cards', 'by-due', IDBKeyRange.upperBound(now));
  return cards.filter((record) => record.card.reps > 0);
}

export async function putCard(db: GeoDatabase, record: CardRecord): Promise<void> {
  await db.put('cards', record);
}

// --- Temps de réponse ------------------------------------------------------------------------

export async function getTiming(db: GeoDatabase, device: Device, mode: AnswerMode): Promise<TimingStats> {
  const record = await db.get('timing', timingKey(device, mode));
  return { samples: record?.samples ?? [] };
}

// --- Journal des réponses --------------------------------------------------------------------

export function getReviewsForCard(db: GeoDatabase, cardKey: string): Promise<ReviewRecord[]> {
  return db.getAllFromIndex('reviews', 'by-card', cardKey);
}

/**
 * Enregistre une réponse en une seule transaction : l'entrée du journal, la carte mise à jour
 * (si la réponse a compté pour FSRS) et les temps de référence (si la réponse compte pour eux).
 * Tout est écrit, ou rien : pas de carte avancée sans trace dans le journal.
 */
export async function recordAnswer(
  db: GeoDatabase,
  answer: {
    review: ReviewRecord;
    card?: CardRecord;
    timing?: { device: Device; mode: AnswerMode; stats: TimingStats };
  },
): Promise<number> {
  const tx = db.transaction(['reviews', 'cards', 'timing'], 'readwrite');
  const { id: _ignored, ...review } = answer.review;
  const id = await tx.objectStore('reviews').add(review as ReviewRecord);
  if (answer.card) await tx.objectStore('cards').put(answer.card);
  if (answer.timing) {
    const { device, mode, stats } = answer.timing;
    await tx.objectStore('timing').put({ key: timingKey(device, mode), samples: stats.samples });
  }
  await tx.done;
  return id;
}

// --- Réglages et favoris ---------------------------------------------------------------------

export async function getSetting<T>(db: GeoDatabase, key: string, fallback: T): Promise<T> {
  const record = await db.get('settings', key);
  return record ? (record.value as T) : fallback;
}

export async function putSetting(db: GeoDatabase, key: string, value: unknown): Promise<void> {
  await db.put('settings', { key, value });
}

export function getFavorites(db: GeoDatabase): Promise<FavoriteRecord[]> {
  return db.getAll('favorites');
}

export async function putFavorite(db: GeoDatabase, favorite: FavoriteRecord): Promise<void> {
  await db.put('favorites', favorite);
}

export async function deleteFavorite(db: GeoDatabase, id: string): Promise<void> {
  await db.delete('favorites', id);
}

// --- Contenu complet (export, import) --------------------------------------------------------

export async function readSnapshot(db: GeoDatabase): Promise<ProgressSnapshot> {
  const tx = db.transaction(STORE_NAMES, 'readonly');
  const [cards, reviews, timing, settings, favorites] = await Promise.all([
    tx.objectStore('cards').getAll(),
    tx.objectStore('reviews').getAll(),
    tx.objectStore('timing').getAll(),
    tx.objectStore('settings').getAll(),
    tx.objectStore('favorites').getAll(),
  ]);
  await tx.done;
  return { cards, reviews, timing, settings, favorites };
}

/** Remplace tout le contenu de la base par celui fourni, en une seule transaction. */
export async function replaceSnapshot(db: GeoDatabase, snapshot: ProgressSnapshot): Promise<void> {
  const tx = db.transaction(STORE_NAMES, 'readwrite');
  await Promise.all(STORE_NAMES.map((name) => tx.objectStore(name).clear()));
  const writes: Promise<unknown>[] = [];
  for (const record of snapshot.cards) writes.push(tx.objectStore('cards').put(record));
  for (const { id: _ignored, ...record } of snapshot.reviews) {
    writes.push(tx.objectStore('reviews').add(record as ReviewRecord));
  }
  for (const record of snapshot.timing) writes.push(tx.objectStore('timing').put(record));
  for (const record of snapshot.settings) writes.push(tx.objectStore('settings').put(record));
  for (const record of snapshot.favorites) writes.push(tx.objectStore('favorites').put(record));
  await Promise.all([...writes, tx.done]);
}
