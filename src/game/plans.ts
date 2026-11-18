// Composition des manches proposées par l'accueil (§ 7) et par le constructeur (§ 6).
import type { WorldData } from '../data/world.ts';
import { isDue, parseCardKey } from '../engine/srs.ts';
import type { Zone } from '../map/zones.ts';
import type { CardRecord } from '../storage/schema.ts';
import { EXERCISES, type ExerciseId } from './exercises.ts';
import { EXERCISES_FOR_SKILL, questionKey, type QuestionRef } from './questions.ts';
import { selectItems, shuffle, type ContentType, type Rng } from './selection.ts';

/** Nombre maximal de questions d'une manche de révisions (au-delà, on révise par séries). */
export const REVIEW_BATCH = 50;
/** Taille de l'entretien rapide. */
export const QUICK_SIZE = 10;
/** Exercices de l'entretien rapide : pays, capitales et drapeaux. */
const QUICK_EXERCISES: ExerciseId[] = ['locate-country', 'name-capital', 'flag-to-country', 'country-to-flag', 'name-country', 'locate-capital'];

export type GameRequest =
  | { kind: 'builder'; exercise: ExerciseId; zone: Zone; count: number | 'all'; content: ContentType }
  | { kind: 'review' }
  | { kind: 'quick' }
  | { kind: 'questions'; title: string; zone: Zone; questions: QuestionRef[] };

/** L'élément peut-il être demandé dans cet exercice ? */
const eligible = (world: WorldData, question: QuestionRef) => {
  const entity = world.byId.get(question.entityId);
  return entity !== undefined && EXERCISES[question.exercise].eligible(entity);
};

/**
 * Toutes les révisions dues, les plus en retard d'abord. Un drapeau dû est demandé dans un sens
 * ou dans l'autre (au hasard), puisque les deux sens travaillent la même compétence.
 */
export function dueQuestions(world: WorldData, cards: Map<string, CardRecord>, now: Date, rng: Rng = Math.random): QuestionRef[] {
  return [...cards.values()]
    .filter((record) => record.card.reps > 0 && isDue(record.card, now))
    .sort((a, b) => a.card.dueAt.getTime() - b.card.dueAt.getTime())
    .map((record) => {
      const { entityId, skill } = parseCardKey(record.key);
      const options = EXERCISES_FOR_SKILL[skill] ?? [];
      return { entityId, exercise: options[Math.floor(rng() * options.length)]! };
    })
    .filter((question) => question.exercise !== undefined && eligible(world, question));
}

/** Révisions du jour : les dues, par séries de 50 au plus. */
export function planReview(world: WorldData, cards: Map<string, CardRecord>, now: Date, rng: Rng = Math.random): QuestionRef[] {
  return shuffle(dueQuestions(world, cards, now, rng).slice(0, REVIEW_BATCH), rng);
}

/**
 * Entretien rapide : 10 pays, capitales et drapeaux tirés au hasard parmi les éléments dus ;
 * s'il n'y en a pas assez, on complète avec des éléments déjà vus, puis jamais vus.
 */
export function planQuick(world: WorldData, cards: Map<string, CardRecord>, now: Date, rng: Rng = Math.random): QuestionRef[] {
  const chosen = new Map<string, QuestionRef>();
  const usedEntities = new Set<string>();
  const add = (question: QuestionRef) => {
    // Un même pays une seule fois par entretien, pour varier.
    if (chosen.size >= QUICK_SIZE || usedEntities.has(question.entityId) || !eligible(world, question)) return;
    chosen.set(questionKey(question), question);
    usedEntities.add(question.entityId);
  };
  for (const question of shuffle(dueQuestions(world, cards, now, rng), rng)) add(question);
  const seen = shuffle(
    [...cards.values()].filter((record) => record.card.reps > 0),
    rng,
  );
  for (const record of seen) {
    const { entityId, skill } = parseCardKey(record.key);
    const options = EXERCISES_FOR_SKILL[skill] ?? [];
    if (options.length) add({ entityId, exercise: options[Math.floor(rng() * options.length)]! });
  }
  for (const entity of shuffle(world.countries, rng)) {
    if (chosen.size >= QUICK_SIZE) break;
    add({ entityId: entity.id, exercise: QUICK_EXERCISES[Math.floor(rng() * QUICK_EXERCISES.length)]! });
  }
  return shuffle([...chosen.values()], rng);
}

/** Manche du constructeur : un exercice, une zone, un type de contenu. */
export function planBuilder(
  world: WorldData,
  request: Extract<GameRequest, { kind: 'builder' }>,
  cards: Map<string, CardRecord>,
  now: Date,
  rng: Rng = Math.random,
): QuestionRef[] {
  const exercise = EXERCISES[request.exercise];
  const ids = request.zone.entityIds.filter((id) => eligible(world, { entityId: id, exercise: request.exercise }));
  return selectItems(ids, exercise.skill, cards, request, now, rng).map((entityId) => ({ entityId, exercise: request.exercise }));
}

/** Titre affiché en fin de manche. */
export function requestTitle(request: GameRequest): string {
  switch (request.kind) {
    case 'builder':
      return `${EXERCISES[request.exercise].label} · ${request.zone.label}`;
    case 'review':
      return 'Révisions du jour';
    case 'quick':
      return 'Entretien rapide';
    case 'questions':
      return request.title;
  }
}
