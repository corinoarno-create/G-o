// Composition des manches : révisions du jour (accueil, § 7) et manches choisies dans une région du carnet (§ 6).
import type { WorldData } from '../data/world.ts';
import { isDue, parseCardKey } from '../engine/srs.ts';
import type { Zone } from '../map/zones.ts';
import type { CardRecord } from '../storage/schema.ts';
import { EXERCISES, type ExerciseId } from './exercises.ts';
import { EXERCISES_FOR_SKILL, type QuestionRef } from './questions.ts';
import { selectItems, shuffle, type ContentType, type Rng } from './selection.ts';

/** Nombre maximal de questions d'une manche de révisions (au-delà, on révise par séries). */
export const REVIEW_BATCH = 50;
export type GameRequest =
  | { kind: 'builder'; exercise: ExerciseId; zone: Zone; count: number | 'all'; content: ContentType }
  | { kind: 'review' }
  /** Découverte en 3 temps d'éléments jamais vus (voir src/discovery/). */
  | { kind: 'discovery'; exercise: ExerciseId; zone: Zone }
  /** Questions fixées d'avance ; `restart` est la manche proposée ensuite (« 5 de plus »). */
  | { kind: 'questions'; title: string; zone: Zone; questions: QuestionRef[]; restart?: GameRequest };

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

/**
 * Regroupe les questions par exercice (le bloc le plus fourni d'abord), mélangées à l'intérieur
 * de chaque bloc : on fait toutes les capitales, puis tous les drapeaux…
 */
export function groupByExercise(questions: QuestionRef[], rng: Rng = Math.random): QuestionRef[] {
  const groups = new Map<ExerciseId, QuestionRef[]>();
  for (const question of questions) {
    const group = groups.get(question.exercise) ?? [];
    group.push(question);
    groups.set(question.exercise, group);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length).flatMap((group) => shuffle(group, rng));
}

/** Révisions du jour : les dues, par séries de 50 au plus, regroupées par exercice. */
export function planReview(world: WorldData, cards: Map<string, CardRecord>, now: Date, rng: Rng = Math.random): QuestionRef[] {
  return groupByExercise(dueQuestions(world, cards, now, rng).slice(0, REVIEW_BATCH), rng);
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
      return 'Révision';
    case 'discovery':
      return `Découverte · ${EXERCISES[request.exercise].label} · ${request.zone.label}`;
    case 'questions':
      return request.title;
  }
}
