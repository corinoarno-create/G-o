// Construction de la géométrie du Monde à partir de Natural Earth (1:10m, « map units »).
//
// 1. Chaque unité Natural Earth reçoit l'identifiant de l'entité à laquelle elle appartient
//    (ex. Angleterre + Écosse + Pays de Galles + Irlande du Nord → « gb »).
// 2. On rétablit les frontières reconnues par l'ONU là où la version « de facto » s'en écarte
//    (Crimée → Ukraine, partie du Sahara occidental administrée par le Maroc → Sahara occidental).
// 3. On fusionne les unités par entité, on simplifie, et on exporte en TopoJSON.
// Les petites zones sans entité (Bir Tawil, zone tampon de Chypre, récifs disputés…) sont gardées
// dans un calque « neutral » : affichées en gris, jamais demandées.
import mapshaper from 'mapshaper';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

/** Propriétés Natural Earth utilisées par les scripts. */
export interface NeProperties {
  ADMIN: string;
  GEOUNIT: string;
  GU_A3: string;
  TYPE: string;
  SOVEREIGNT: string;
  ISO_A2_EH: string;
  LABEL_X: number;
  LABEL_Y: number;
  BRK_NAME?: string;
}

export type NeCollection = FeatureCollection<Geometry, NeProperties>;

/** Valeur d'identifiant réservée aux zones sans entité. */
export const NEUTRAL = '_neutral';

/** Unités Natural Earth gardées en zone neutre (code GU_A3). */
const NEUTRAL_UNITS = new Set([
  'WSB', // base souveraine d'Akrotiri
  'ESB', // base souveraine de Dhekelia
  'CNM', // zone tampon de l'ONU à Chypre
  'BRT', // Bir Tawil
  'KAS', // glacier de Siachen
  'SPI', // champ de glace Sud de Patagonie
  'BRI', // île Brésilienne
  'BJN', // banc de Bajo Nuevo
  'SER', // banc de Serranilla
  'SCR', // récif de Scarborough
  'PGA', // îles Spratleys
  'PFA', // îles Paracels
  'USG', // base de Guantánamo
  'ATC', // îles Ashmore-et-Cartier
  'CSI', // îles de la mer de Corail
  'CLP', // île Clipperton
]);

/**
 * Donne l'identifiant d'entité d'une unité Natural Earth,
 * NEUTRAL pour une zone sans entité, ou null pour une unité à ignorer (calques superposés).
 */
export function entityIdForUnit(p: NeProperties): string | null {
  if (p.TYPE === 'Overlay') return null; // zone démilitarisée coréenne, FNUOD : déjà couvertes par les pays
  if (NEUTRAL_UNITS.has(p.GU_A3)) return NEUTRAL;
  if (p.ADMIN === 'United States Minor Outlying Islands') return 'um';
  if (p.GEOUNIT === 'Jan Mayen') return 'sj'; // ISO regroupe Svalbard et Jan Mayen
  if (p.ADMIN === 'Northern Cyprus') return 'cyn';
  if (p.ADMIN === 'Somaliland') return 'sol';
  if (p.ISO_A2_EH && p.ISO_A2_EH !== '-99') return p.ISO_A2_EH.toLowerCase();
  throw new Error(`Unité Natural Earth sans entité : ${p.GEOUNIT} (${p.GU_A3})`);
}

/**
 * Zones disputées à rattacher à une autre entité que dans la version « de facto » :
 * on suit les frontières reconnues par l'ONU.
 */
export function reassignedEntityForDisputedArea(p: NeProperties): string | null {
  if (p.BRK_NAME === 'Crimea') return 'ua';
  if (p.BRK_NAME === 'W. Sahara' && p.SOVEREIGNT === 'Morocco') return 'eh';
  return null;
}

export interface WorldGeometry {
  /** TopoJSON avec deux objets : « entities » (propriété eid) et « neutral ». */
  topology: string;
  /** Mêmes entités en GeoJSON (après simplification), pour calculer superficies et points d'ancrage. */
  entities: FeatureCollection<Geometry, { eid: string }>;
}

/** Proportion de points conservés lors de la simplification (réglage taille / finesse). */
const SIMPLIFY = '8%';

export async function buildWorldGeometry(units: NeCollection, disputed: NeCollection): Promise<WorldGeometry> {
  const unitFeatures: Feature<Geometry, { eid: string }>[] = [];
  for (const feature of units.features) {
    const eid = entityIdForUnit(feature.properties);
    if (eid) unitFeatures.push({ type: 'Feature', geometry: feature.geometry, properties: { eid } });
  }
  const moved: Feature<Geometry, { eid: string }>[] = [];
  for (const feature of disputed.features) {
    const eid = reassignedEntityForDisputedArea(feature.properties);
    if (eid) moved.push({ type: 'Feature', geometry: feature.geometry, properties: { eid } });
  }
  if (moved.length !== 2) throw new Error(`Zones disputées attendues : 2, trouvées : ${moved.length}`);

  const commands = [
    '-i units.json moved.json combine-files',
    // On découpe les zones déplacées dans les unités (Russie, Maroc), puis on les ajoute à leur entité.
    '-erase moved target=units',
    '-merge-layers target=units,moved force name=all',
    '-dissolve2 eid target=all',
    // keep-shapes ne protège que le plus grand anneau de chaque entité : sans « explode », les petites îles
    // (atolls des Kiribati, Wallis, Pitcairn, New Providence aux Bahamas…) disparaîtraient avec leur capitale.
    // On simplifie donc île par île, puis on regroupe à nouveau par entité.
    '-explode target=all',
    `-simplify ${SIMPLIFY} keep-shapes target=all`,
    '-dissolve eid target=all',
    `-filter 'eid !== "${NEUTRAL}"' target=all + name=entities`,
    `-filter 'eid === "${NEUTRAL}"' target=all + name=neutral`,
    '-o format=topojson target=entities,neutral world.topo.json',
  ].join(' ');

  const output = await mapshaper.applyCommands(commands, {
    'units.json': { type: 'FeatureCollection', features: unitFeatures },
    'moved.json': { type: 'FeatureCollection', features: moved },
  });
  const value = output['world.topo.json'];
  const topology = typeof value === 'string' ? value : new TextDecoder().decode(value);
  // On repasse par topojson-client, comme le fera l'app : le GeoJSON de mapshaper suit la norme RFC 7946
  // (anneaux extérieurs dans le sens antihoraire), que d3-geo interpréterait comme « toute la Terre sauf le pays ».
  const topo = JSON.parse(topology) as Topology<{ entities: GeometryCollection<{ eid: string }> }>;
  const entities = feature(topo, topo.objects.entities) as WorldGeometry['entities'];
  return { topology, entities };
}
