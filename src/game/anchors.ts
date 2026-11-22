// Points d'ancrage pour placer une capitale (et plus tard une ville) : quelques capitales voisines, nommées,
// pour se repérer par rapport à ce qu'on connaît.
//
// Ce sont des « repères qui s'effacent » (décidé le 22/11/2026) : nombreux tant que l'élément demandé est
// nouveau, de moins en moins à mesure qu'il est retenu, et plus du tout une fois maîtrisé, pour que la note
// reste honnête. On ne montre jamais l'élément demandé, ni une capitale encore à venir dans la manche
// (elle donnerait la réponse d'une question suivante).
import type { CityEntity, CountryEntity } from '../data/types.ts';
import type { WorldData } from '../data/world.ts';
import { distanceKm } from '../engine/geo.ts';
import type { MasteryLevel } from '../engine/srs.ts';

export const ANCHOR_SETTINGS = {
  /** Nombre de points d'ancrage selon la maîtrise de l'élément demandé. */
  count: { new: 2, learning: 2, acquired: 1, mastered: 0 } satisfies Record<MasteryLevel, number>,
  /** Au-delà, une capitale est trop loin pour aider à placer précisément. */
  maxKm: 1500,
  /** En deçà, elle donnerait presque la réponse (Rome pour le Vatican, Vienne pour Bratislava). */
  minKm: 100,
};

export interface Anchor {
  /** Entité dont la capitale sert de repère. */
  entityId: string;
  name: string;
  lonLat: [number, number];
}

/**
 * Capitales voisines à montrer pour placer la capitale de `entity`, de la plus proche à la plus lointaine.
 * @param excluded entités dont la capitale ne doit pas apparaître (questions encore à venir dans la manche).
 */
export function capitalAnchors(world: WorldData, entity: CountryEntity, mastery: MasteryLevel, excluded: ReadonlySet<string> = new Set()): Anchor[] {
  const count = ANCHOR_SETTINGS.count[mastery];
  const capital = entity.capital;
  if (count === 0 || !capital) return [];
  const origin: [number, number] = [capital.lon, capital.lat];
  return world.countries
    .flatMap((other) => {
      if (other.id === entity.id || !other.capital || excluded.has(other.id)) return [];
      const lonLat: [number, number] = [other.capital.lon, other.capital.lat];
      const distance = distanceKm(origin, lonLat);
      if (distance < ANCHOR_SETTINGS.minKm || distance > ANCHOR_SETTINGS.maxKm) return [];
      return [{ anchor: { entityId: other.id, name: other.capital.name, lonLat }, distance }];
    })
    .sort((a, b) => a.distance - b.distance)
    .reduce<Anchor[]>((chosen, { anchor }) => {
      // Deux repères presque au même endroit (Rome et le Vatican) n'en font qu'un.
      const apart = chosen.every((other) => distanceKm(other.lonLat, anchor.lonLat) >= ANCHOR_SETTINGS.minKm);
      return chosen.length < count && apart ? [...chosen, anchor] : chosen;
    }, []);
}

/** Exercices dont la réponse est une capitale ou une ville : la montrer en repère la dévoilerait. */
const REVEALING_EXERCISES = new Set(['locate-capital', 'capital-to-country', 'name-capital', 'locate-city', 'name-city']);

/**
 * Éléments dont une question sur la capitale ou la ville reste à venir dans la manche (clés « exercice|élément ») :
 * le pays pour une capitale, la ville pour une ville.
 */
export function pendingCapitalEntities(queue: readonly string[]): Set<string> {
  const ids = new Set<string>();
  for (const key of queue) {
    const separator = key.indexOf('|');
    if (REVEALING_EXERCISES.has(key.slice(0, separator))) ids.add(key.slice(separator + 1));
  }
  return ids;
}

/** Nombre de villes connues montrées en plus de la capitale, selon la maîtrise de la ville demandée. */
export const CITY_ANCHORS: Record<MasteryLevel, { capital: boolean; cities: number }> = {
  new: { capital: true, cities: 2 },
  learning: { capital: true, cities: 2 },
  acquired: { capital: true, cities: 0 },
  mastered: { capital: false, cities: 0 },
};

/**
 * Points d'ancrage pour placer une ville : la capitale de son pays, puis une ou deux villes du pays que je sais
 * déjà placer (acquises), les plus proches. Ils s'effacent quand la ville demandée est retenue.
 * @param known villes que je sais placer (identifiants).
 */
export function cityAnchors(
  world: WorldData,
  city: CityEntity,
  mastery: MasteryLevel,
  known: ReadonlySet<string>,
  excluded: ReadonlySet<string> = new Set(),
): Anchor[] {
  const rule = CITY_ANCHORS[mastery];
  const country = world.byId.get(city.country);
  const origin: [number, number] = [city.lon, city.lat];
  const anchors: Anchor[] = [];
  const farEnough = (lonLat: [number, number]) =>
    distanceKm(origin, lonLat) >= ANCHOR_SETTINGS.minKm && anchors.every((other) => distanceKm(other.lonLat, lonLat) >= ANCHOR_SETTINGS.minKm);
  if (rule.capital && country?.capital && !excluded.has(country.id)) {
    const lonLat: [number, number] = [country.capital.lon, country.capital.lat];
    if (farEnough(lonLat)) anchors.push({ entityId: country.id, name: country.capital.name, lonLat });
  }
  const others = (world.citiesByCountry.get(city.country) ?? [])
    .filter((other) => other.id !== city.id && known.has(other.id) && !excluded.has(other.id))
    .map((other) => ({ other, distance: distanceKm(origin, [other.lon, other.lat]) }))
    .sort((a, b) => a.distance - b.distance);
  let added = 0;
  for (const { other } of others) {
    if (added >= rule.cities) break;
    const lonLat: [number, number] = [other.lon, other.lat];
    if (!farEnough(lonLat)) continue;
    anchors.push({ entityId: other.id, name: other.name, lonLat });
    added += 1;
  }
  return anchors;
}
