// Découverte en 3 temps (§ 5.1, revue le 19/11/2026) : un petit groupe d'éléments jamais vus est
// d'abord montré (Observer), puis reconnu parmi quatre propositions (Reconnaître), et enfin demandé
// pour de vrai (Retrouver, une manche normale). Seule la dernière étape compte pour la mémoire (FSRS).
import type { CityEntity, CountryEntity } from '../data/types.ts';
import type { WorldData } from '../data/world.ts';
import type { ExerciseId } from '../game/exercises.ts';
import { shuffle, type Rng } from '../game/selection.ts';

/** Taille d'un groupe de découverte : assez petit pour être retenu d'un coup. */
export const DISCOVERY_SIZE = 5;

/** Nombre de propositions dans l'étape Reconnaître. */
export const QUIZ_CHOICES = 4;

export type DiscoveryPhase = 'observe' | 'recognize';

/** Ce qu'on apprend dans un exercice : le pays, la capitale, le drapeau ou une ville. */
export type DiscoveryFamily = 'country' | 'capital' | 'flag' | 'city';

export function discoveryFamily(exercise: ExerciseId): DiscoveryFamily {
  if (exercise === 'locate-city' || exercise === 'name-city') return 'city';
  if (exercise === 'flag-to-country' || exercise === 'country-to-flag') return 'flag';
  if (exercise === 'locate-capital' || exercise === 'capital-to-country' || exercise === 'name-capital') return 'capital';
  return 'country';
}

/** Ce qu'affichent les propositions de l'étape Reconnaître. */
export type ChoiceKind = 'country' | 'capital' | 'flag';

export interface RecognizeQuestion {
  /** Petite phrase au-dessus du sujet (« Quel est ce pays ? »). */
  ask: string;
  /** Sujet en grand (un nom), ou null quand l'élément est seulement montré sur la carte. */
  subject: string | null;
  /** Drapeau montré dans la question. */
  showFlag: boolean;
  /** Pays mis en évidence sur la carte. */
  highlight: string | null;
  /** Capitale pointée sur la carte. */
  pin: [number, number] | null;
  choiceKind: ChoiceKind;
}

/**
 * Question de l'étape Reconnaître, selon l'exercice qu'on prépare : on reconnaît l'élément
 * sous la forme où il sera demandé ensuite (position, nom, capitale ou drapeau).
 */
export function recognizeQuestion(exercise: ExerciseId, entity: CountryEntity): RecognizeQuestion {
  const capital = entity.capital ? ([entity.capital.lon, entity.capital.lat] as [number, number]) : null;
  switch (exercise) {
    case 'locate-city':
    case 'name-city':
      // `entity` est une ville présentée comme un pays (voir cityAsEntity) : son point est sa « capitale ».
      // Pas de nom de pays : les propositions viennent souvent de pays différents, il donnerait la réponse.
      return {
        ask: 'Quelle est cette ville ?',
        subject: null,
        showFlag: false,
        highlight: null,
        pin: capital,
        choiceKind: 'capital',
      };
    case 'name-capital':
      return {
        ask: 'Capitale de…',
        subject: entity.name,
        showFlag: false,
        highlight: entity.id,
        pin: null,
        choiceKind: 'capital',
      };
    case 'capital-to-country':
      return {
        ask: 'Dans quel pays est…',
        subject: entity.capital?.name ?? '',
        showFlag: false,
        highlight: null,
        pin: capital,
        choiceKind: 'country',
      };
    case 'locate-capital':
      return {
        ask: 'Quelle est cette capitale ?',
        subject: null,
        showFlag: false,
        highlight: null,
        pin: capital,
        choiceKind: 'capital',
      };
    case 'flag-to-country':
      return {
        ask: 'De quel pays est ce drapeau ?',
        subject: null,
        showFlag: true,
        highlight: null,
        pin: null,
        choiceKind: 'country',
      };
    case 'country-to-flag':
      return {
        ask: 'Drapeau de…',
        subject: entity.name,
        showFlag: false,
        highlight: entity.id,
        pin: null,
        choiceKind: 'flag',
      };
    default:
      return {
        ask: 'Quel est ce pays ?',
        subject: null,
        showFlag: false,
        highlight: entity.id,
        pin: null,
        choiceKind: 'country',
      };
  }
}

/**
 * Quatre propositions : la bonne, puis d'autres éléments du groupe (on les apprend ensemble),
 * complétées au besoin par des voisins de la même sous-région, puis du même continent.
 */
export function buildChoices(
  entity: CountryEntity,
  group: CountryEntity[],
  pool: CountryEntity[],
  rng: Rng = Math.random,
  count = QUIZ_CHOICES,
): string[] {
  const others = shuffle(
    group.filter((other) => other.id !== entity.id),
    rng,
  );
  const used = new Set([entity.id, ...others.map((other) => other.id)]);
  const extra = shuffle(
    pool.filter((other) => !used.has(other.id)),
    rng,
  );
  const ranked = [
    ...others,
    ...extra.filter((other) => other.subregion === entity.subregion),
    ...extra.filter((other) => other.subregion !== entity.subregion && other.continent === entity.continent),
    ...extra.filter((other) => other.continent !== entity.continent),
  ];
  return shuffle([entity.id, ...ranked.slice(0, count - 1).map((other) => other.id)], rng);
}

/**
 * File de l'étape Reconnaître : une erreur fait revenir l'élément un peu plus tard
 * (après deux autres, ou à la fin s'il en reste moins), comme dans une manche.
 */
export function nextQueue(queue: string[], correct: boolean, delay = 2): string[] {
  const [current, ...rest] = queue;
  if (current === undefined) return [];
  if (correct) return rest;
  const position = Math.min(delay, rest.length);
  return [...rest.slice(0, position), current, ...rest.slice(position)];
}

/**
 * Une ville présentée comme un pays, pour réutiliser la découverte des capitales : même identifiant que la ville,
 * le nom et la région de son pays, et la ville en guise de capitale (son point sur la carte).
 */
export function cityAsEntity(world: WorldData, city: CityEntity): CountryEntity | null {
  const country = world.byId.get(city.country);
  if (!country) return null;
  return {
    ...country,
    id: city.id,
    capital: { name: city.name, aliases: city.aliases, lon: city.lon, lat: city.lat },
    otherCapitals: [],
    anchor: [city.lon, city.lat],
  };
}

/** Libellé d'une proposition. */
export function choiceLabel(world: WorldData, id: string, kind: ChoiceKind): string {
  const city = world.cityById.get(id);
  if (city) return city.name;
  const entity = world.byId.get(id);
  if (!entity) return id;
  return kind === 'capital' ? (entity.capital?.name ?? entity.name) : entity.name;
}
