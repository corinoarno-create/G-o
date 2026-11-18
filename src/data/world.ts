// Chargement des données du Monde générées par scripts/build-world.ts.
// Les fiches (petites) sont intégrées au code ; les frontières (~570 Ko) sont un fichier à part,
// chargé à la demande et mis en cache par le navigateur.
import { geoArea } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { Feature, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import countriesJson from '../../data/world/countries.json';
import topologyUrl from '../../data/world/world.topo.json?url';
import { removeSeams } from './seams.ts';
import type { CountryEntity } from './types.ts';

export type Shape = Feature<Polygon | MultiPolygon, { eid: string }>;

export interface WorldData {
  countries: CountryEntity[];
  byId: Map<string, CountryEntity>;
  /** Frontières de chaque entité. */
  shapes: Map<string, Shape>;
  /** Terres principales de chaque entité : servent au cadrage, sans les petites îles lointaines. */
  mainShapes: Map<string, Shape>;
  /** Zones sans entité (Bir Tawil, zone tampon de Chypre…), dessinées en gris. */
  neutral: Shape[];
  /** Frontières terrestres (entre deux entités ou zones). */
  borders: MultiLineString;
  /** Côtes. */
  coastlines: MultiLineString;
}

export const countries = countriesJson as unknown as CountryEntity[];

/** Part minimale de la plus grande terre pour qu'une terre compte dans le cadrage. */
const MAIN_PART_RATIO = 0.1;

/**
 * Garde les terres principales d'une entité : celles d'au moins 10 % de la plus grande.
 * Ex. : les États-Unis gardent l'Alaska mais pas Hawaï ; le Chili perd l'île de Pâques.
 */
export function mainPart(shape: Shape): Shape {
  if (shape.geometry.type === 'Polygon') return shape;
  const parts = shape.geometry.coordinates.map((coordinates) => ({
    coordinates,
    area: geoArea({ type: 'Polygon', coordinates }),
  }));
  const largest = Math.max(...parts.map((part) => part.area));
  const kept = parts.filter((part) => part.area >= largest * MAIN_PART_RATIO).map((part) => part.coordinates);
  const geometry: Polygon | MultiPolygon =
    kept.length === 1 ? { type: 'Polygon', coordinates: kept[0]! } : { type: 'MultiPolygon', coordinates: kept };
  return { ...shape, geometry };
}

type WorldTopology = Topology<{
  entities: GeometryCollection<{ eid: string }>;
  neutral: GeometryCollection<{ eid: string }>;
}>;

/** Construit les données à partir de la topologie (séparé du chargement pour les tests). */
export function buildWorldData(topology: WorldTopology, list: CountryEntity[] = countries): WorldData {
  const entities = feature(topology, topology.objects.entities).features as Shape[];
  const neutral = feature(topology, topology.objects.neutral).features as Shape[];
  const shapes = new Map(entities.map((shape) => [shape.properties.eid, shape]));
  const mainShapes = new Map(entities.map((shape) => [shape.properties.eid, mainPart(shape)]));
  // Les traits sont tirés de la topologie : chaque frontière n'est dessinée qu'une fois.
  const all: GeometryCollection = {
    type: 'GeometryCollection',
    geometries: [...topology.objects.entities.geometries, ...topology.objects.neutral.geometries],
  };
  const borders = removeSeams(mesh(topology, all, (a, b) => a !== b));
  const coastlines = removeSeams(mesh(topology, all, (a, b) => a === b));
  return {
    countries: list,
    byId: new Map(list.map((c) => [c.id, c])),
    shapes,
    mainShapes,
    neutral,
    borders,
    coastlines,
  };
}

let pending: Promise<WorldData> | null = null;

/** Charge les données du Monde (une seule fois). */
export function loadWorld(): Promise<WorldData> {
  pending ??= fetch(topologyUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Frontières introuvables (${response.status})`);
      return response.json();
    })
    .then((topology: WorldTopology) => buildWorldData(topology));
  return pending;
}
