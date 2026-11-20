// Moteur de synchronisation entre mes appareils (PC, téléphone), indépendant du service en ligne :
// il parle à un « coffre » distant (RemoteStore) que firebase.ts réalise avec Firestore, et que les
// tests remplacent par un faux en mémoire.
//
// La base locale (IndexedDB) reste la référence : l'app marche hors ligne, et une synchronisation
// ne fait que réunir les deux côtés avec les règles de storage/merge.ts. Comme ces règles ne perdent
// rien et ne dupliquent rien, deux synchronisations qui se croisent se réparent à la suivante.
//
// Rangement en ligne (pour rester loin des quotas gratuits) :
// - le « cœur » : les cartes mémoire en 16 paquets, plus un paquet « état » (réglages, temps de
//   référence, remises à zéro), lus et réécrits ensemble dans une transaction ;
// - le journal : des lots de réponses, ajoutés à chaque envoi et jamais réécrits ; on ne relit que
//   les lots arrivés depuis la dernière fois.
import { BackupError, reviveCard, reviveReset, reviveReview } from '../storage/backup.ts';
import { readSnapshot, type GeoDatabase } from '../storage/db.ts';
import {
  cardErased,
  mergeByKey,
  newerCard,
  newerRecord,
  reviewErased,
  reviewIdentity,
  timingErased,
  unionResets,
} from '../storage/merge.ts';
import type { CardRecord, ResetRecord, ReviewRecord, SettingRecord, TimingRecord } from '../storage/schema.ts';

/** Nombre de paquets de cartes (chaque document Firestore est limité à 1 Mo). */
export const SHARD_COUNT = 16;
/** Réponses par lot envoyé. */
export const BATCH_SIZE = 400;
/** On relit les lots un peu avant la dernière lecture (marge de sécurité ; les doublons sont écartés). */
export const PULL_MARGIN_MS = 10 * 60 * 1000;
/** Version du format en ligne : un appareil plus ancien refuse un format plus récent. */
export const REMOTE_FORMAT = 1;

/** Le cœur tel qu'il est stocké : textes JSON (évite les pièges de types de Firestore). */
export interface RemoteCore {
  state: string | null;
  shards: (string | null)[];
}

/** Ce qu'on réécrit du cœur : seulement les paquets qui ont changé. */
export interface CoreWrite {
  state?: string;
  shards: Map<number, string>;
}

export interface RemoteBatch {
  /** Date d'arrivée sur le serveur (ms). */
  createdAtMs: number;
  /** Texte JSON : liste de réponses. */
  items: string;
}

export interface RemoteStore {
  /** Lit le cœur, calcule ce qu'il faut écrire et l'écrit, d'un bloc (rejoué si un autre appareil écrit en même temps). */
  updateCore(compute: (core: RemoteCore) => CoreWrite): Promise<void>;
  /** Lots de réponses arrivés après cette date (ms), du plus ancien au plus récent. */
  batchesSince(ms: number): Promise<RemoteBatch[]>;
  addBatch(items: string): Promise<void>;
}

export interface SyncResult {
  /** Date d'arrivée du lot le plus récent lu (à repasser à la prochaine synchronisation). */
  lastPullMs: number;
  cardsReceived: number;
  reviewsReceived: number;
  reviewsSent: number;
}

export class SyncFormatError extends Error {}

interface RemoteState {
  format: number;
  settings: SettingRecord[];
  timing: TimingRecord[];
  resets: ResetRecord[];
}

/** Paquet d'une carte (stable d'un appareil à l'autre). */
export function shardOf(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return (hash >>> 0) % SHARD_COUNT;
}

const asObjects = (value: unknown, what: string): Record<string, unknown>[] => {
  if (!Array.isArray(value)) throw new BackupError(`Données en ligne abîmées : ${what}.`);
  return value as Record<string, unknown>[];
};

function parseState(text: string | null): RemoteState {
  if (!text) return { format: REMOTE_FORMAT, settings: [], timing: [], resets: [] };
  const raw = JSON.parse(text) as Record<string, unknown>;
  const format = typeof raw.format === 'number' ? raw.format : 0;
  if (format > REMOTE_FORMAT) {
    throw new SyncFormatError('Ton autre appareil a une version plus récente de l’app : mets celle-ci à jour.');
  }
  return {
    format,
    settings: asObjects(raw.settings ?? [], 'réglages') as unknown as SettingRecord[],
    timing: asObjects(raw.timing ?? [], 'temps') as unknown as TimingRecord[],
    resets: asObjects(raw.resets ?? [], 'remises à zéro').map((r, i) => reviveReset(r, `remise à zéro n° ${i + 1}`)),
  };
}

const parseShard = (text: string | null): CardRecord[] =>
  text ? asObjects(JSON.parse(text), 'cartes').map((r, i) => reviveCard(r, `carte n° ${i + 1}`)) : [];

const parseBatch = (text: string): ReviewRecord[] =>
  asObjects(JSON.parse(text), 'journal').map((r, i) => reviveReview(r, `réponse n° ${i + 1}`));

/** Texte stable d'un paquet de cartes (trié), pour ne réécrire que ce qui change. */
const shardText = (cards: CardRecord[]) => JSON.stringify([...cards].sort((a, b) => a.key.localeCompare(b.key)));

const byKey = <T extends { key: string }>(records: T[]) => [...records].sort((a, b) => a.key.localeCompare(b.key));
const stateText = (state: Omit<RemoteState, 'format'>) =>
  JSON.stringify({
    format: REMOTE_FORMAT,
    settings: byKey(state.settings),
    timing: byKey(state.timing),
    resets: state.resets,
  });

/** Ce que le cœur fusionné contient, pour l'appliquer ensuite à la base locale. */
interface MergedCore {
  cards: Map<string, CardRecord>;
  settings: SettingRecord[];
  timing: TimingRecord[];
  resets: ResetRecord[];
}

/**
 * Réunit le cœur en ligne et la base locale. Fonction pure : la transaction en ligne peut la rejouer.
 */
export function mergeCore(
  core: RemoteCore,
  local: { cards: CardRecord[]; settings: SettingRecord[]; timing: TimingRecord[]; resets: ResetRecord[] },
): { write: CoreWrite; merged: MergedCore } {
  const remoteState = parseState(core.state);
  const resets = unionResets(remoteState.resets, local.resets);

  const cards = new Map<string, CardRecord>();
  const add = (record: CardRecord) => {
    if (cardErased(record, resets)) return;
    const existing = cards.get(record.key);
    cards.set(record.key, existing ? newerCard(existing, record) : record);
  };
  const remoteShards = Array.from({ length: SHARD_COUNT }, (_, i) => core.shards[i] ?? null);
  remoteShards.forEach((text) => parseShard(text).forEach(add));
  local.cards.forEach(add);

  const settings = mergeByKey(remoteState.settings, local.settings, newerRecord);
  const timing = mergeByKey(remoteState.timing, local.timing, newerRecord).filter((r) => !timingErased(r, resets));

  const write: CoreWrite = { shards: new Map() };
  const grouped = Array.from({ length: SHARD_COUNT }, () => [] as CardRecord[]);
  for (const record of cards.values()) grouped[shardOf(record.key)]!.push(record);
  grouped.forEach((records, i) => {
    const text = shardText(records);
    const before = remoteShards[i];
    // Un paquet absent et un paquet vide se valent : on n'écrit pas de paquet vide pour rien.
    if (text !== (before ?? '[]')) write.shards.set(i, text);
  });
  const state = stateText({ settings, timing, resets });
  if (state !== core.state && !(core.state === null && settings.length + timing.length + resets.length === 0)) {
    write.state = state;
  }
  return { write, merged: { cards, settings, timing, resets } };
}

/**
 * Applique le cœur fusionné et les réponses reçues à la base locale, en une transaction.
 * Chaque enregistrement est comparé à sa version actuelle : une réponse jouée pendant la
 * synchronisation n'est jamais écrasée par une version plus ancienne.
 */
async function applyLocally(db: GeoDatabase, merged: MergedCore, received: ReviewRecord[]): Promise<{ cards: number; reviews: number }> {
  const tx = db.transaction(['cards', 'reviews', 'timing', 'settings', 'resets'], 'readwrite');
  const resets = merged.resets;
  let cardsReceived = 0;
  let reviewsReceived = 0;

  const resetStore = tx.objectStore('resets');
  for (const reset of resets) if (!(await resetStore.get(reset.id))) await resetStore.put(reset);

  const cardStore = tx.objectStore('cards');
  for (let cursor = await cardStore.openCursor(); cursor; cursor = await cursor.continue()) {
    if (cardErased(cursor.value, resets)) await cursor.delete();
  }
  for (const record of merged.cards.values()) {
    const current = await cardStore.get(record.key);
    if (current && !cardErased(current, resets) && newerCard(current, record) === current) continue;
    await cardStore.put(record);
    cardsReceived += 1;
  }

  const settingStore = tx.objectStore('settings');
  for (const record of merged.settings) {
    const current = await settingStore.get(record.key);
    if (!current || newerRecord(current, record) !== current) await settingStore.put(record);
  }
  const timingStore = tx.objectStore('timing');
  for (let cursor = await timingStore.openCursor(); cursor; cursor = await cursor.continue()) {
    if (timingErased(cursor.value, resets)) await cursor.delete();
  }
  for (const record of merged.timing) {
    const current = await timingStore.get(record.key);
    if (!current || timingErased(current, resets) || newerRecord(current, record) !== current) await timingStore.put(record);
  }

  // Journal : on efface ce qui a été remis à zéro, on reconnaît ce qui est déjà en ligne,
  // et on ajoute ce qui manque (marqué comme déjà en ligne, pour ne pas le renvoyer).
  const incoming = new Map(received.map((review) => [reviewIdentity(review), review]));
  const reviewStore = tx.objectStore('reviews');
  for (let cursor = await reviewStore.openCursor(); cursor; cursor = await cursor.continue()) {
    const review = cursor.value;
    if (reviewErased(review, resets)) {
      await cursor.delete();
      continue;
    }
    const identity = reviewIdentity(review);
    if (incoming.has(identity)) {
      incoming.delete(identity);
      if (!review.pushed) await cursor.update({ ...review, pushed: true });
    }
  }
  for (const review of incoming.values()) {
    if (reviewErased(review, resets)) continue;
    await reviewStore.add({ ...review, pushed: true });
    reviewsReceived += 1;
  }
  await tx.done;
  return { cards: cardsReceived, reviews: reviewsReceived };
}

/** Envoie les réponses jamais envoyées, par lots, et les marque comme envoyées. */
async function pushReviews(db: GeoDatabase, remote: RemoteStore): Promise<number> {
  const pending = (await db.getAll('reviews')).filter((review) => !review.pushed);
  pending.sort((a, b) => a.at.getTime() - b.at.getTime());
  let sent = 0;
  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);
    await remote.addBatch(JSON.stringify(batch.map(({ id: _id, pushed: _pushed, ...review }) => review)));
    const tx = db.transaction('reviews', 'readwrite');
    for (const review of batch) {
      const current = review.id === undefined ? undefined : await tx.store.get(review.id);
      if (current) await tx.store.put({ ...current, pushed: true });
    }
    await tx.done;
    sent += batch.length;
  }
  return sent;
}

/** Une synchronisation complète : lire le journal, réunir le cœur, appliquer ici, envoyer mes réponses. */
export async function syncOnce(db: GeoDatabase, remote: RemoteStore, lastPullMs: number): Promise<SyncResult> {
  const batches = await remote.batchesSince(Math.max(0, lastPullMs - PULL_MARGIN_MS));
  const received = batches.flatMap((batch) => parseBatch(batch.items));
  const newLastPull = batches.reduce((max, batch) => Math.max(max, batch.createdAtMs), lastPullMs);

  const local = await readSnapshot(db);
  let merged: MergedCore | null = null;
  await remote.updateCore((core) => {
    const result = mergeCore(core, local);
    merged = result.merged;
    return result.write;
  });
  if (!merged) throw new Error('La synchronisation n’a pas pu lire les données en ligne.');

  const applied = await applyLocally(db, merged, received);
  const sent = await pushReviews(db, remote);
  return { lastPullMs: newLastPull, cardsReceived: applied.cards, reviewsReceived: applied.reviews, reviewsSent: sent };
}
