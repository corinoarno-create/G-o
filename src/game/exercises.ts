// Exercices de la V1 (§ 4) : ce qu'on demande, comment on répond, quelle compétence FSRS est travaillée.
import { SUBREGION_LABELS } from '../data/labels.ts';
import type { CountryEntity } from '../data/types.ts';
import type { WorldData } from '../data/world.ts';
import { distanceKm } from '../engine/geo.ts';
import type { AnswerMode } from '../engine/grading.ts';
import type { Skill } from '../engine/srs.ts';

export type ExerciseId =
  | 'locate-country' // Épingler : un nom de pays, je clique sur la carte
  | 'locate-capital' // Épingler : un nom de capitale, je la place au plus près (distance)
  | 'capital-to-country' // Capitales : un nom de capitale, je clique sur son pays
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
    description: 'Une capitale s’affiche : place-la au plus près, on mesure l’écart en km.',
    skill: 'locate-capital',
    answerMode: 'pin',
    eligible: (entity) => entity.capital !== null,
  },
  'capital-to-country': {
    id: 'capital-to-country',
    label: 'Capitale → pays',
    description: 'Une capitale s’affiche : clique sur son pays.',
    skill: 'capital-country',
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
  /** Entités sur lesquelles la carte se cadre : l'indice rend aussi les petites îles cliquables. */
  focus?: string[];
  /** Étendue minimale de ce cadrage (km). */
  focusKm?: number;
  /** Entité dont on montre le contour (le pays où chercher une capitale). */
  outline?: string;
  /** Pour le choix de drapeaux : propositions retirées par l'indice. */
  eliminate?: string[];
}

/** Nombre d'essais avant de montrer la réponse, selon la façon de répondre. */
export const MAX_TRIES: Record<AnswerMode, number> = { pin: 3, type: 3, choice: 2 };

/** Niveaux d'indice : 1 après la première erreur (ou un clic sur « Indice »), 2 après la deuxième. */
export type HintLevel = 1 | 2;

/** Nombre de voisins montrés avec l'élément au 2e niveau d'indice. */
const HINT_NEIGHBOURS = 4;

/**
 * Indice de lieu : la carte se cadre d'abord sur la sous-région (Caraïbes, Polynésie…),
 * puis sur l'élément et ses plus proches voisins. Jamais sur l'élément seul, pour ne pas donner la réponse.
 */
export function placeFocus(world: WorldData, entity: CountryEntity, level: HintLevel): string[] {
  if (level === 1) return world.countries.filter((other) => other.subregion === entity.subregion).map((other) => other.id);
  const neighbours = world.countries
    .filter((other) => other.id !== entity.id && other.id !== 'aq')
    .map((other) => ({ id: other.id, distance: distanceKm(entity.anchor, other.anchor) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, HINT_NEIGHBOURS)
    .map((other) => other.id);
  return [entity.id, ...neighbours];
}

/** Réglages du cadrage d'un élément montré (Nommer, Capitale de…, Pays → drapeau). */
export const SHOW_FRAME = {
  /** Étendue minimale de la vue (km) : une petite île reste entourée de ses voisines. */
  minKm: 1500,
  /** Voisins ajoutés au cadre, pour situer un territoire isolé (Territoire britannique de l'océan Indien…). */
  neighbours: 2,
  /** Au-delà, un voisin est trop loin pour aider : on ne dézoome pas jusqu'à lui. */
  maxNeighbourKm: 2500,
};

/**
 * Cadrage adapté au contexte d'un élément montré : l'élément entier (l'Australie se voit en entier),
 * au moins 1 500 km autour (Dominique, avec la Guadeloupe et la Martinique), et ses deux plus proches voisins
 * s'ils sont à moins de 2 500 km (une île perdue dans l'océan se voit avec les terres qui la situent).
 */
export function showFrame(world: WorldData, entity: CountryEntity): { ids: string[]; points: [number, number][]; minKm: number } {
  const points = world.countries
    .filter((other) => other.id !== entity.id && other.id !== 'aq')
    .map((other) => ({ point: other.anchor, distance: distanceKm(entity.anchor, other.anchor) }))
    .filter((other) => other.distance <= SHOW_FRAME.maxNeighbourKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, SHOW_FRAME.neighbours)
    .map((other) => other.point);
  return { ids: [entity.id], points, minKm: SHOW_FRAME.minKm };
}

/** « Commence par « Ou… » (11 lettres). » */
export function letterHint(name: string, level: HintLevel): string {
  return `Commence par « ${name.slice(0, level)}… » (${letterCount(name)} lettres).`;
}

/**
 * Indice progressif (V1) : il aide sans donner la réponse. Les indices rédigés viendront en V2.
 * - Placer : la carte zoome sur la sous-région, puis sur les voisins (pour une capitale : sur son pays) ;
 * - Saisir : la première lettre, puis les deux premières ;
 * - Choix de drapeaux : un mauvais drapeau en moins à chaque niveau.
 */
export function hintFor(
  exercise: ExerciseId,
  entity: CountryEntity,
  level: HintLevel,
  options: { world?: WorldData; choices?: string[]; eliminated?: string[] } = {},
): Hint {
  const region = SUBREGION_LABELS[entity.subregion];
  const focus = (lvl: HintLevel) => (options.world ? placeFocus(options.world, entity, lvl) : [entity.id]);
  switch (exercise) {
    case 'locate-country':
    case 'capital-to-country':
      return level === 1
        ? { text: `Cherche du côté de : ${region}.`, focus: focus(1), focusKm: 1500 }
        : { text: 'Encore plus près : c’est l’un de ces pays.', focus: focus(2), focusKm: 700 };
    case 'locate-capital':
      return level === 1
        ? { text: `Cherche du côté de : ${region}.`, focus: focus(1), focusKm: 1500 }
        : { text: `Elle est dans ce ${entityNoun(entity)} : ${entity.name}.`, focus: [entity.id], focusKm: 500, outline: entity.id };
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
