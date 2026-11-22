// Une question = un élément × un exercice. Une manche peut mélanger les exercices
// (révisions du jour).
import type { Skill } from '../engine/srs.ts';
import type { ExerciseId } from './exercises.ts';

export interface QuestionRef {
  exercise: ExerciseId;
  entityId: string;
}

/** Clé texte d'une question, pour la boucle de consolidation : « name-capital|fr ». */
export const questionKey = (question: QuestionRef) => `${question.exercise}|${question.entityId}`;

export function parseQuestionKey(key: string): QuestionRef {
  const separator = key.indexOf('|');
  return { exercise: key.slice(0, separator) as ExerciseId, entityId: key.slice(separator + 1) };
}

/** Exercices qui travaillent chaque compétence (le drapeau se révise dans les deux sens). */
export const EXERCISES_FOR_SKILL: Record<Skill, ExerciseId[]> = {
  'locate-country': ['locate-country'],
  'name-country': ['name-country'],
  'locate-capital': ['locate-capital'],
  'capital-country': ['capital-to-country'],
  'name-capital': ['name-capital'],
  flag: ['flag-to-country', 'country-to-flag'],
  'locate-city': ['locate-city'],
  'name-city': ['name-city'],
};
