// Points d'ancrage pour placer une capitale (et plus tard une ville) : quelques capitales voisines, nommées,
// pour se repérer par rapport à ce qu'on connaît.
//
// Ce sont des « repères qui s'effacent » (décidé le 22/11/2026) : nombreux tant que l'élément demandé est
// nouveau, de moins en moins à mesure qu'il est retenu, et plus du tout une fois maîtrisé, pour que la note
// reste honnête. On ne montre jamais l'élément demandé, ni une capitale encore à venir dans la manche
// (elle donnerait la réponse d'une question suivante).
import type { CountryEntity } from '../data/types.ts';
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

/** Exercices dont la réponse est une capitale : montrer cette capitale en repère la dévoilerait. */
const CAPITAL_EXERCISES = new Set(['locate-capital', 'capital-to-country', 'name-capital']);

/** Entités dont une question sur la capitale reste à venir dans la manche (clés « exercice|entité »). */
export function pendingCapitalEntities(queue: readonly string[]): Set<string> {
  const ids = new Set<string>();
  for (const key of queue) {
    const separator = key.indexOf('|');
    if (CAPITAL_EXERCISES.has(key.slice(0, separator))) ids.add(key.slice(separator + 1));
  }
  return ids;
}
