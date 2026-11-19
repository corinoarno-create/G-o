// Exercices de la V1 (§ 4) : ce qu'on demande, comment on répond, quelle compétence FSRS est travaillée.
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

/** Cercle d'indice sur la carte : la réponse est dedans, mais pas forcément au centre. */
export interface HintCircle {
  center: [number, number];
  radiusKm: number;
}

export interface Hint {
  text: string;
  circle?: HintCircle;
  /** Pour le choix de drapeaux : propositions retirées par l'indice. */
  eliminate?: string[];
}

/** Nombre d'essais avant de montrer la réponse, selon la façon de répondre. */
export const MAX_TRIES: Record<AnswerMode, number> = { pin: 3, type: 3, choice: 2 };

/** Niveaux d'indice : 1 après la première erreur (ou un clic sur « Indice »), 2 après la deuxième. */
export type HintLevel = 1 | 2;

const KM_PER_DEGREE = 111.195;

/**
 * Cercle d'indice autour d'un point : assez grand au niveau 1, resserré au niveau 2.
 * Son centre est décalé au hasard pour que la réponse ne soit pas pile au milieu.
 */
export function hintCircle(target: [number, number], targetRadiusKm: number, level: HintLevel, rng: () => number = Math.random): HintCircle {
  const radiusKm = level === 1 ? Math.max(4 * targetRadiusKm, 900) : Math.max(1.6 * targetRadiusKm, 300);
  const shift = rng() * 0.45 * Math.max(radiusKm - targetRadiusKm, 0);
  const angle = rng() * 2 * Math.PI;
  const lat = target[1] + (shift * Math.cos(angle)) / KM_PER_DEGREE;
  const lon = target[0] + (shift * Math.sin(angle)) / (KM_PER_DEGREE * Math.max(Math.cos((target[1] * Math.PI) / 180), 0.2));
  return { center: [((lon + 540) % 360) - 180, Math.max(-89, Math.min(89, lat))], radiusKm };
}

/** « Commence par « Ou… » (11 lettres). » */
export function letterHint(name: string, level: HintLevel): string {
  return `Commence par « ${name.slice(0, level)}… » (${letterCount(name)} lettres).`;
}

/**
 * Indice progressif (V1) : il aide sans donner la réponse. Les indices rédigés viendront en V2.
 * - Placer : un cercle autour de la zone, qui se resserre ;
 * - Saisir : la première lettre, puis les deux premières ;
 * - Choix de drapeaux : un mauvais drapeau en moins à chaque niveau.
 */
export function hintFor(
  exercise: ExerciseId,
  entity: CountryEntity,
  level: HintLevel,
  options: { choices?: string[]; eliminated?: string[]; rng?: () => number } = {},
): Hint {
  const rng = options.rng ?? Math.random;
  const circleText = level === 1 ? 'C’est dans le cercle.' : 'Le cercle se resserre…';
  switch (exercise) {
    case 'locate-country': {
      const radius = Math.sqrt(entity.areaKm2 / Math.PI);
      return { text: circleText, circle: hintCircle(entity.anchor, radius, level, rng) };
    }
    case 'locate-capital': {
      const capital = entity.capital!;
      return { text: circleText, circle: hintCircle([capital.lon, capital.lat], 0, level, rng) };
    }
    case 'name-country':
    case 'flag-to-country':
      return { text: letterHint(entity.name, level) };
    case 'name-capital':
      return { text: letterHint(entity.capital?.name ?? '?', level) };
    case 'country-to-flag': {
      const eliminated = new Set(options.eliminated ?? []);
      const next = (options.choices ?? []).find((id) => id !== entity.id && !eliminated.has(id));
      return { text: 'Un drapeau en moins.', eliminate: next ? [next] : [] };
    }
  }
}
