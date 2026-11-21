// Préparation d'une manche : base, planificateur FSRS, enregistreur et choix des questions.
import type { WorldData } from '../data/world.ts';
import { createSrs, type Srs } from '../engine/srs.ts';
import { detectDevice } from '../lib/device.ts';
import type { Zone } from '../map/zones.ts';
import { getAllCards, getSetting } from '../storage/db.ts';
import { progressDb } from '../storage/progress-db.ts';
import type { CardRecord } from '../storage/schema.ts';
import { EXERCISES, type ExerciseId } from './exercises.ts';
import { planBuilder, planReview, requestTitle, type GameRequest } from './plans.ts';
import type { QuestionRef } from './questions.ts';
import { AnswerRecorder } from './recorder.ts';
import type { ChallengePlay } from '../challenge/types.ts';

export type { GameRequest } from './plans.ts';

export interface PreparedGame {
  request: GameRequest;
  title: string;
  /** Zone affichée (et cadrée) pendant la manche. */
  zone: Zone;
  questions: QuestionRef[];
  recorder: AnswerRecorder;
  /** Autocomplétion en saisie (réglage mémorisé). */
  autocomplete: boolean;
  /** Manche jouée pour un défi (mêmes questions, même ordre, mêmes propositions pour tous). */
  challenge?: ChallengePlay;
}

let srs: Promise<Srs> | null = null;
export const getSrs = () => (srs ??= createSrs());

/** Entités de la zone qui peuvent être demandées dans cet exercice. */
export function eligibleIds(world: WorldData, exercise: ExerciseId, zone: Zone): string[] {
  const definition = EXERCISES[exercise];
  return zone.entityIds.filter((id) => {
    const entity = world.byId.get(id);
    return entity !== undefined && definition.eligible(entity);
  });
}

/** Toutes les cartes mémoire enregistrées, par clé. */
export async function loadCards(): Promise<Map<string, CardRecord>> {
  const cards = await getAllCards(await progressDb());
  return new Map(cards.map((record) => [record.key, record]));
}

/**
 * Prépare une manche.
 * @param worldZone zone « Monde », utilisée pour les manches qui mélangent tout (révisions).
 */
export async function prepareGame(world: WorldData, worldZone: Zone, request: GameRequest): Promise<PreparedGame> {
  const db = await progressDb();
  const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const recorder = await AnswerRecorder.create(db, await getSrs(), detectDevice(), sessionId);
  const now = new Date();
  let zone = worldZone;
  let questions: QuestionRef[];
  switch (request.kind) {
    case 'builder':
      zone = request.zone;
      questions = planBuilder(world, request, recorder.cards, now);
      break;
    case 'review':
      questions = planReview(world, recorder.cards, now);
      break;
    case 'discovery':
      // Normalement préparée par prepareDiscovery ; ici, à défaut, une manche de nouveautés.
      zone = request.zone;
      questions = planBuilder(world, { kind: 'builder', exercise: request.exercise, zone, count: 5, content: 'new' }, recorder.cards, now);
      break;
    case 'questions':
      zone = request.zone;
      questions = request.questions;
      break;
  }
  const autocomplete = await getSetting(db, 'autocomplete', false);
  const challenge = request.kind === 'questions' ? request.challenge : undefined;
  return { request, title: requestTitle(request), zone, questions, recorder, autocomplete, ...(challenge && { challenge }) };
}
