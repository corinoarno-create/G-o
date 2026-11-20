// Règles de fusion de deux progressions, communes à l'import d'un fichier et à la synchronisation
// entre appareils. Elles sont choisies pour que fusionner dans n'importe quel ordre donne le même
// résultat, et qu'on puisse refusionner sans rien perdre ni dupliquer :
// - carte mémoire : la plus récemment révisée l'emporte ;
// - journal des réponses : on réunit les deux, sans doublon ;
// - réglages et temps de référence : la dernière modification l'emporte ;
// - remises à zéro : on les réunit, et elles effacent partout ce qui date d'avant elles.
import type { Skill } from '../engine/srs.ts';
import type { CardRecord, ResetRecord, ReviewRecord, SettingRecord, TimingRecord } from './schema.ts';

/** Date de dernière révision d'une carte (ms), -∞ si elle n'a jamais été révisée. */
export const lastReviewOf = (record: CardRecord): number => record.card.lastReviewAt?.getTime() ?? -Infinity;

/** Identité d'une réponse, la même sur tous les appareils (la base attribue des numéros différents). */
export const reviewIdentity = (review: Pick<ReviewRecord, 'at' | 'cardKey'>): string =>
  `${review.at.getTime()}|${review.cardKey}`;

const resetMatches = (reset: ResetRecord, entityId: string, skill: Skill): boolean =>
  (!reset.entityIds || reset.entityIds.includes(entityId)) && (!reset.skills || reset.skills.includes(skill));

/** Une remise à zéro complète (sans filtre) efface aussi les temps de référence. */
export const isFullReset = (reset: ResetRecord): boolean => !reset.entityIds && !reset.skills;

/** La carte a-t-elle été effacée par une remise à zéro postérieure à sa dernière révision ? */
export function cardErased(record: CardRecord, resets: readonly ResetRecord[]): boolean {
  const last = lastReviewOf(record);
  return resets.some((reset) => last <= reset.at.getTime() && resetMatches(reset, record.entityId, record.skill));
}

/** La réponse a-t-elle été effacée par une remise à zéro postérieure ? */
export function reviewErased(review: ReviewRecord, resets: readonly ResetRecord[]): boolean {
  const at = review.at.getTime();
  return resets.some((reset) => at <= reset.at.getTime() && resetMatches(reset, review.entityId, review.skill));
}

/** Les temps de référence ont-ils été effacés par une remise à zéro complète postérieure ? */
export function timingErased(record: TimingRecord, resets: readonly ResetRecord[]): boolean {
  const updated = record.updatedAt ?? 0;
  return resets.some((reset) => isFullReset(reset) && updated <= reset.at.getTime());
}

/** Réunit deux listes de remises à zéro (par identifiant). */
export function unionResets(a: readonly ResetRecord[], b: readonly ResetRecord[]): ResetRecord[] {
  const byId = new Map(a.map((reset) => [reset.id, reset]));
  for (const reset of b) if (!byId.has(reset.id)) byId.set(reset.id, reset);
  return [...byId.values()].sort((x, y) => x.at.getTime() - y.at.getTime());
}

/** Entre deux versions d'une carte, celle qui doit rester (à égalité, la première). */
export const newerCard = (mine: CardRecord, theirs: CardRecord): CardRecord =>
  lastReviewOf(theirs) > lastReviewOf(mine) ? theirs : mine;

/**
 * Entre deux versions d'un réglage ou de temps de référence, la plus récemment modifiée
 * (à égalité, ou sans date, la première : c'est ce qu'on a déjà ici).
 */
export const newerRecord = <T extends SettingRecord | TimingRecord>(mine: T, theirs: T): T =>
  (theirs.updatedAt ?? 0) > (mine.updatedAt ?? 0) ? theirs : mine;

/** Fusionne deux listes d'enregistrements par clé, avec la règle donnée. */
export function mergeByKey<T extends { key: string }>(mine: readonly T[], theirs: readonly T[], pick: (a: T, b: T) => T): T[] {
  const byKey = new Map(mine.map((record) => [record.key, record]));
  for (const record of theirs) {
    const existing = byKey.get(record.key);
    byKey.set(record.key, existing ? pick(existing, record) : record);
  }
  return [...byKey.values()];
}
