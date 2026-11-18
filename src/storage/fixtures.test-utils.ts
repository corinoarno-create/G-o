// Fabriques de données pour les tests du stockage (fichier non chargé par l'app).
import { ENGINE_SETTINGS } from '../engine/settings.ts';
import { cardKey, createSrs, type Skill, type Srs } from '../engine/srs.ts';
import type { CardRecord, ReviewRecord } from './schema.ts';

let srs: Srs | null = null;

export async function testSrs(): Promise<Srs> {
  srs ??= await createSrs({ ...ENGINE_SETTINGS.srs, enableFuzz: false });
  return srs;
}

/** Carte neuve, ou révisée une fois avec la note donnée à la date donnée. */
export async function makeCard(
  entityId: string,
  skill: Skill,
  reviewedAt: Date | null,
  grade: 'again' | 'good' | 'easy' = 'good',
): Promise<CardRecord> {
  const scheduler = await testSrs();
  const created = new Date('2026-01-01T00:00:00Z');
  const card = reviewedAt ? scheduler.review(scheduler.newCard(reviewedAt), grade, reviewedAt).card : scheduler.newCard(created);
  return { key: cardKey(entityId, skill), entityId, skill, card };
}

export function makeReview(cardKeyValue: string, at: Date, correct = true): ReviewRecord {
  const [entityId, skill] = cardKeyValue.split(':') as [string, Skill];
  return {
    at,
    cardKey: cardKeyValue,
    entityId,
    skill,
    mode: 'pin',
    device: 'desktop',
    correct,
    grade: correct ? 'good' : 'again',
    reason: correct ? 'normal' : 'wrong',
    responseMs: 2500,
    usedHint: false,
    firstAttempt: true,
  };
}

let counter = 0;
/** Nom de base unique, pour que chaque test ait sa propre base. */
export const uniqueDbName = () => `geo-test-${Date.now()}-${counter++}`;
