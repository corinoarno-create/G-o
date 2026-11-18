// Zones géographiques (Monde, continents, sous-régions) et cadrage de la carte pour chacune.
//
// Le cadre d'une zone est une « boîte » en longitude/latitude, calculée à partir de la partie principale
// de chaque entité (pour qu'Hawaï ou l'île de Pâques n'élargissent pas le cadre), sauf quelques zones réglées
// à la main. La carte centre ensuite une projection azimutale équivalente sur cette boîte.
import { geoBounds } from 'd3-geo';
import { CONTINENT_LABELS, SUBREGION_LABELS } from '../data/labels.ts';
import type { ContinentId, CountryEntity, SubregionId } from '../data/types.ts';
import type { Shape, WorldData } from '../data/world.ts';

/** Boîte géographique. Si east < west, elle traverse l'antiméridien (ex. Océanie : 110° → -130°). */
export interface GeoBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type ProjectionKind = 'natural-earth' | 'azimuthal';

export interface ZoneView {
  projection: ProjectionKind;
  /** Null : tout le globe. */
  box: GeoBox | null;
}

export type ZoneKind = 'world' | 'continent' | 'subregion';

export interface Zone {
  id: string;
  label: string;
  kind: ZoneKind;
  /** Zone parente (continent d'une sous-région). */
  parent: string | null;
  entityIds: string[];
  view: ZoneView;
}

/** Cadres réglés à la main, là où le calcul automatique montrerait toute la Russie. */
const BOX_OVERRIDES: Record<string, GeoBox> = {
  europe: { west: -25, south: 34, east: 45, north: 71 },
  'eastern-europe': { west: 20, south: 43, east: 60, north: 62 },
};

/** Entités ignorées pour le cadrage : leurs terres sont dispersées loin du reste de leur zone. */
const FRAMING_EXCLUDED = new Set(['um']);

/** Boîte englobant des formes, en tenant compte de l'antiméridien (calcul sphérique de d3). */
export function boxOf(shapes: Shape[]): GeoBox {
  const [[west, south], [east, north]] = geoBounds({ type: 'FeatureCollection', features: shapes });
  return { west, south, east, north };
}

/** Largeur en degrés de longitude (gère la traversée de l'antiméridien). */
export function boxWidth(box: GeoBox): number {
  return box.east >= box.west ? box.east - box.west : box.east + 360 - box.west;
}

/** Centre de la boîte [longitude, latitude], longitude ramenée dans [-180, 180]. */
export function boxCenter(box: GeoBox): [number, number] {
  let lon = box.west + boxWidth(box) / 2;
  if (lon > 180) lon -= 360;
  return [lon, (box.south + box.north) / 2];
}

/** Grille de points couvrant la boîte : c'est ce que la projection « ajuste » au cadre de l'écran. */
export function boxSamplePoints(box: GeoBox, steps = 8): [number, number][] {
  const width = boxWidth(box);
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      let lon = box.west + (width * i) / steps;
      if (lon > 180) lon -= 360;
      points.push([lon, box.south + ((box.north - box.south) * j) / steps]);
    }
  }
  return points;
}

/** Zone formée d'une liste d'entités, cadrée automatiquement sur leurs parties principales. */
export function zoneFromEntities(
  world: WorldData,
  base: Omit<Zone, 'view' | 'entityIds'>,
  entityIds: string[],
): Zone {
  const framing = entityIds
    .filter((id) => !FRAMING_EXCLUDED.has(id))
    .map((id) => world.mainShapes.get(id))
    .filter((shape): shape is Shape => shape !== undefined);
  const box = BOX_OVERRIDES[base.id] ?? boxOf(framing);
  return { ...base, entityIds, view: { projection: 'azimuthal', box } };
}

/** Toutes les zones : Monde, puis chaque continent suivi de ses sous-régions. */
export function buildZones(world: WorldData): Zone[] {
  const ids = (filter: (c: CountryEntity) => boolean) => world.countries.filter(filter).map((c) => c.id);
  const zones: Zone[] = [
    {
      id: 'world',
      label: 'Monde',
      kind: 'world',
      parent: null,
      entityIds: world.countries.map((c) => c.id),
      view: { projection: 'natural-earth', box: null },
    },
  ];
  const continents = (Object.keys(CONTINENT_LABELS) as ContinentId[]).sort((a, b) =>
    CONTINENT_LABELS[a].localeCompare(CONTINENT_LABELS[b], 'fr'),
  );
  for (const continent of continents) {
    const members = ids((c) => c.continent === continent);
    if (members.length === 0) continue;
    zones.push(
      zoneFromEntities(world, { id: continent, label: CONTINENT_LABELS[continent], kind: 'continent', parent: 'world' }, members),
    );
    const subregions = [...new Set(world.countries.filter((c) => c.continent === continent).map((c) => c.subregion))]
      .filter((subregion) => subregion !== 'antarctica')
      .sort((a: SubregionId, b: SubregionId) => SUBREGION_LABELS[a].localeCompare(SUBREGION_LABELS[b], 'fr'));
    for (const subregion of subregions) {
      zones.push(
        zoneFromEntities(
          world,
          { id: subregion, label: SUBREGION_LABELS[subregion], kind: 'subregion', parent: continent },
          ids((c) => c.subregion === subregion),
        ),
      );
    }
  }
  return zones;
}
