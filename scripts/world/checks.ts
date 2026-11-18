// Contrôles de cohérence des données du Monde. Ils produisent des remarques pour le rapport ;
// les erreurs graves (identifiants en double…) font échouer la construction.
import { geoContains, geoDistance } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import type { CountryEntity } from '../../src/data/types.ts';

const EARTH_RADIUS_KM = 6371.0088;

/** Distance maximale tolérée entre une capitale et la frontière simplifiée de son entité (côte, île). */
const CAPITAL_MAX_DISTANCE_KM = 25;

/** Normalisation simple pour comparer des noms (casse, accents, ponctuation). */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function* positions(geometry: Geometry): Generator<Position> {
  switch (geometry.type) {
    case 'Polygon':
      for (const ring of geometry.coordinates) yield* ring;
      break;
    case 'MultiPolygon':
      for (const polygon of geometry.coordinates) for (const ring of polygon) yield* ring;
      break;
    default:
      break;
  }
}

/** Distance (km) d'un point à l'entité : 0 s'il est dedans, sinon distance au sommet le plus proche. */
export function distanceToShapeKm(shape: Feature<Geometry>, lon: number, lat: number): number {
  if (geoContains(shape, [lon, lat])) return 0;
  let best = Infinity;
  for (const position of positions(shape.geometry)) {
    best = Math.min(best, geoDistance([lon, lat], [position[0]!, position[1]!]));
  }
  return best * EARTH_RADIUS_KM;
}

export function checkEntities(
  entities: CountryEntity[],
  geometry: FeatureCollection<Geometry, { eid: string }>,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const shapes = new Map(geometry.features.map((f) => [f.properties.eid, f]));

  // Identifiants uniques
  const ids = new Set<string>();
  for (const entity of entities) {
    if (ids.has(entity.id)) errors.push(`identifiant en double : ${entity.id}`);
    ids.add(entity.id);
  }

  // Un nom (ou alias) ne doit désigner qu'une seule entité, sinon la saisie serait ambiguë.
  const owners = new Map<string, string>();
  for (const entity of entities) {
    for (const label of [entity.name, ...entity.aliases]) {
      const key = normalizeName(label);
      const owner = owners.get(key);
      if (owner && owner !== entity.id) errors.push(`nom « ${label} » partagé par ${owner} et ${entity.id}`);
      owners.set(key, entity.id);
    }
  }

  for (const entity of entities) {
    const shape = shapes.get(entity.id);
    if (!shape) {
      errors.push(`${entity.id} : pas de géométrie`);
      continue;
    }
    if (entity.sovereign && !ids.has(entity.sovereign)) {
      errors.push(`${entity.id} : État de rattachement inconnu (${entity.sovereign})`);
    }
    for (const capital of [entity.capital, ...entity.otherCapitals]) {
      if (!capital) continue;
      const distance = distanceToShapeKm(shape, capital.lon, capital.lat);
      if (distance > CAPITAL_MAX_DISTANCE_KM) {
        warnings.push(`${entity.id} : la capitale ${capital.name} est à ${Math.round(distance)} km de l'entité`);
      }
    }
    if (!entity.flag) warnings.push(`${entity.id} : pas de drapeau`);
  }
  return { errors, warnings };
}
