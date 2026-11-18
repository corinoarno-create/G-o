// Exercices de la V1 (§ 4) : ce qu'on demande, comment on répond, quelle compétence FSRS est travaillée.
import { SUBREGION_LABELS } from '../data/labels.ts';
import type { CountryEntity } from '../data/types.ts';
import type { WorldData } from '../data/world.ts';
import type { AnswerMode } from '../engine/grading.ts';
import type { Skill } from '../engine/srs.ts';

export type ExerciseId =
  | 'locate-country' // Épingler : un nom de pays, je clique sur la carte
  | 'locate-capital' // Épingler : un nom de capitale, je clique où elle se trouve
  | 'name-country' // Saisir : un pays est mis en évidence, je tape son nom
  | 'name-capital' // Capitales : un pays, je tape sa capitale
  | 'flag-to-country' // Drapeaux : un drapeau, je tape le pays ou je clique dessus sur la carte
  | 'country-to-flag'; // Drapeaux : un pays, je choisis son drapeau parmi quatre

export interface Exercise {
  id: ExerciseId;
  label: string;
  description: string;
  skill: Skill;
  /** Façon principale de répondre (sert aussi aux temps de référence). */
  answerMode: AnswerMode;
  /** L'entité peut-elle être demandée dans cet exercice ? */
  eligible: (entity: CountryEntity) => boolean;
}

/** Drapeau propre (pas celui de l'État de rattachement, pas un drapeau non officiel). */
export const hasOwnFlag = (entity: CountryEntity) => entity.flag !== null && entity.flagSameAs === null && entity.id !== 'aq';

const always = () => true;

export const EXERCISES: Record<ExerciseId, Exercise> = {
  'locate-country': {
    id: 'locate-country',
    label: 'Placer les pays',
    description: 'Un nom s’affiche : clique sur le pays.',
    skill: 'locate-country',
    answerMode: 'pin',
    eligible: always,
  },
  'locate-capital': {
    id: 'locate-capital',
    label: 'Placer les capitales',
    description: 'Une capitale s’affiche : clique où elle se trouve.',
    skill: 'locate-capital',
    answerMode: 'pin',
    eligible: (entity) => entity.capital !== null,
  },
  'name-country': {
    id: 'name-country',
    label: 'Nommer les pays',
    description: 'Un pays est mis en évidence : tape son nom.',
    skill: 'name-country',
    answerMode: 'type',
    eligible: always,
  },
  'name-capital': {
    id: 'name-capital',
    label: 'Donner les capitales',
    description: 'Un pays s’affiche : tape sa capitale.',
    skill: 'name-capital',
    answerMode: 'type',
    eligible: (entity) => entity.capital !== null,
  },
  'flag-to-country': {
    id: 'flag-to-country',
    label: 'Drapeau → pays',
    description: 'Un drapeau s’affiche : tape le pays ou clique dessus.',
    skill: 'flag',
    answerMode: 'type',
    eligible: hasOwnFlag,
  },
  'country-to-flag': {
    id: 'country-to-flag',
    label: 'Pays → drapeau',
    description: 'Un pays s’affiche : choisis son drapeau.',
    skill: 'flag',
    answerMode: 'choice',
    eligible: hasOwnFlag,
  },
};

export const EXERCISE_LIST = Object.values(EXERCISES);

/** « pays » pour un État, « territoire » sinon. */
export function entityNoun(entity: CountryEntity): 'pays' | 'territoire' {
  return ['un-member', 'un-observer', 'limited-recognition'].includes(entity.status) ? 'pays' : 'territoire';
}

/** Noms acceptés pour une entité. */
export const countryAnswers = (entity: CountryEntity) => [entity.name, ...entity.aliases];

/** Noms acceptés pour la capitale (avec les autres capitales officielles). */
export function capitalAnswers(entity: CountryEntity): string[] {
  return [entity.capital, ...entity.otherCapitals].flatMap((capital) => (capital ? [capital.name, ...capital.aliases] : []));
}

const rivalsCache = new WeakMap<WorldData, { countries: Map<string, string[]>; capitals: Map<string, string[]> }>();

/**
 * Autres réponses possibles du même type (les autres pays, ou les autres capitales) :
 * elles permettent de reconnaître une confusion (« Niger » pour « Nigeria »).
 */
export function rivalAnswers(world: WorldData, kind: 'countries' | 'capitals', entityId: string): string[] {
  let cache = rivalsCache.get(world);
  if (!cache) {
    cache = { countries: new Map(), capitals: new Map() };
    rivalsCache.set(world, cache);
  }
  const byId = cache[kind];
  if (byId.size === 0) {
    for (const entity of world.countries) {
      byId.set(entity.id, kind === 'countries' ? countryAnswers(entity) : capitalAnswers(entity));
    }
  }
  return [...byId].filter(([id]) => id !== entityId).flatMap(([, names]) => names);
}

/** Nombre de lettres d'un nom (sans espaces, tirets ni apostrophes). */
export const letterCount = (name: string) => name.replace(/[\s\-'’]/g, '').length;

export interface Hint {
  text: string;
  /** Pour le choix de drapeaux : propositions retirées par l'indice. */
  eliminate?: string[];
}

/** Indice générique (V1) : il aide sans donner la réponse. Les indices rédigés viendront en V2. */
export function hintFor(exercise: ExerciseId, entity: CountryEntity, choices: string[] = []): Hint {
  const startsWith = (name: string) => `Commence par « ${name[0]!.toUpperCase()} » (${letterCount(name)} lettres).`;
  switch (exercise) {
    case 'locate-country':
      return { text: `Région : ${SUBREGION_LABELS[entity.subregion]}.` };
    case 'locate-capital':
      return { text: `C'est la capitale : ${entity.name}.` };
    case 'name-country':
    case 'flag-to-country':
      return { text: startsWith(entity.name) };
    case 'name-capital':
      return { text: startsWith(entity.capital?.name ?? '?') };
    case 'country-to-flag': {
      const wrong = choices.filter((id) => id !== entity.id).slice(0, 2);
      return { text: 'Deux drapeaux en moins.', eliminate: wrong };
    }
  }
}
