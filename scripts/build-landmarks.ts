// Construit les repères de la carte pour placer capitales et villes (décidé le 22/11/2026) :
// fleuves, grands lacs et limites intérieures (régions, États, provinces).
// Usage : npm run data:landmarks   (après npm run data:download)
//
// Produit data/world/landmarks.topo.json, chargé seulement quand un exercice de placement commence.
// Objets : « riversMajor » (grands fleuves, visibles dès la vue d'ensemble), « riversMinor » (affluents,
// jusqu'au niveau du Rhône et du Pô, visibles une fois zoomé), « lakes », « admin1 » (visibles une fois zoomé).
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import mapshaper from 'mapshaper';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { RAW_DIR, WORLD_DIR, readJson } from './lib/fs.ts';
import { selectAdmin1Lines, type Admin1LineProperties } from './world/landmarks.ts';

/** Rang Natural Earth maximal des fleuves gardés (7 : niveau du Rhône et du Pô, d'après la mesure du 22/11/2026). */
const MAX_RIVER_RANK = 7;
/** Au-delà de ce rang, un fleuve n'apparaît qu'une fois zoomé. */
const MAJOR_RIVER_RANK = 4;
/** Rang maximal des lacs gardés. */
const MAX_LAKE_RANK = 6;
/**
 * Finesse des tracés (mètres) : un détail plus petit disparaît. Bien assez pour situer une ville à l'échelle
 * d'un pays, et le fichier reste léger (réglage taille / finesse).
 */
const SIMPLIFY = { rivers: 4000, lakes: 2500, admin1: '2%' };

interface RankedProperties {
  scalerank: number;
  featurecla: string;
}

async function main(): Promise<void> {
  const raw = (file: string) => join(RAW_DIR, 'natural-earth', file);
  console.log('Lecture des sources…');
  const [rivers, lakes, admin1, countries] = await Promise.all([
    readJson<FeatureCollection<Geometry, RankedProperties>>(raw('ne_10m_rivers_lake_centerlines.geojson')),
    readJson<FeatureCollection<Geometry, RankedProperties>>(raw('ne_10m_lakes.geojson')),
    readJson<FeatureCollection<Geometry, Admin1LineProperties>>(raw('ne_10m_admin_1_states_provinces_lines.geojson')),
    readJson<Array<{ iso3: string | null; areaKm2: number }>>(join(WORLD_DIR, 'countries.json')),
  ]);
  const areaByIso3 = new Map(countries.flatMap((c) => (c.iso3 ? [[c.iso3, c.areaKm2] as const] : [])));

  // Les « lignes de lac » (tracé d'un fleuve à travers un lac) sont inutiles : le lac est dessiné.
  const keptRivers = rivers.features.filter((f) => f.properties.featurecla === 'River' && f.properties.scalerank <= MAX_RIVER_RANK);
  const strip = (features: Feature<Geometry, unknown>[]): FeatureCollection => ({
    type: 'FeatureCollection',
    features: features.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: {} })),
  });
  const layers = {
    'riversMajor.json': strip(keptRivers.filter((f) => f.properties.scalerank <= MAJOR_RIVER_RANK)),
    'riversMinor.json': strip(keptRivers.filter((f) => f.properties.scalerank > MAJOR_RIVER_RANK)),
    'lakes.json': strip(lakes.features.filter((f) => f.properties.scalerank <= MAX_LAKE_RANK)),
    'admin1.json': strip(selectAdmin1Lines(admin1.features, areaByIso3)),
  };

  console.log('Simplification…');
  const commands = [
    '-i riversMajor.json riversMinor.json lakes.json admin1.json combine-files',
    // Lignes : on les regroupe avant de simplifier (l'app n'a besoin que des tracés), sinon chacun des
    // milliers de petits tronçons garde ses points et le fichier double de taille.
    '-dissolve target=riversMajor,riversMinor,admin1',
    `-simplify interval=${SIMPLIFY.rivers} target=riversMajor,riversMinor`,
    `-simplify interval=${SIMPLIFY.lakes} keep-shapes target=lakes`,
    `-simplify ${SIMPLIFY.admin1} target=admin1`,
    '-dissolve2 target=lakes',
    '-o format=topojson quantization=100000 target=riversMajor,riversMinor,lakes,admin1 landmarks.topo.json',
  ].join(' ');
  const output = await mapshaper.applyCommands(commands, layers);
  const value = output['landmarks.topo.json'];
  const topology = typeof value === 'string' ? value : new TextDecoder().decode(value);
  await writeFile(join(WORLD_DIR, 'landmarks.topo.json'), topology, 'utf8');
  console.log(
    `✓ ${keptRivers.length} fleuves, ${layers['lakes.json'].features.length} lacs, ${layers['admin1.json'].features.length} limites intérieures : ${(topology.length / 1024).toFixed(0)} Ko.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
