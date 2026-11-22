// Construit la liste des villes prête à l'emploi (lot 3) à partir du choix fait à la main.
// Usage : npm run data:cities   (après npm run data:download -- cities15000 et npm run data:cities-candidates)
//
// Lit data/sources/villes.json, retrouve chaque ville dans GeoNames et produit :
//   data/world/cities.json          les villes (nom français, coordonnées, population) ;
//   data/world/RAPPORT-VILLES.md    le rapport de relecture, pays par pays.
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { distanceKm, distanceToShapeKm } from '../src/engine/geo.ts';
import type { CountryEntity } from '../src/data/types.ts';
import { RAW_DIR, SOURCES_DIR, WORLD_DIR, readJson, writeJson } from './lib/fs.ts';
import { parseGeoNames } from './cities/geonames.ts';
import { cityQuota } from './cities/quotas.ts';
import { selectCities, type CityChoice } from './cities/select.ts';

/** Une ville plus proche que ça de la capitale est presque au même endroit : on le signale. */
const NEAR_CAPITAL_KM = 15;
/** Une ville à plus de tant de km de son pays est sans doute mal rattachée. */
const OUTSIDE_KM = 20;

async function main(): Promise<void> {
  const countries = await readJson<CountryEntity[]>(join(WORLD_DIR, 'countries.json'));
  const byId = new Map(countries.map((c) => [c.id, c]));
  const topology = await readJson<Topology<{ entities: GeometryCollection<{ eid: string }> }>>(join(WORLD_DIR, 'world.topo.json'));
  const shapes = new Map(
    (feature(topology, topology.objects.entities).features as Array<Feature<Geometry, { eid: string }>>).map((f) => [f.properties.eid, f]),
  );
  const geo = parseGeoNames(await readFile(join(RAW_DIR, 'geonames', 'cities15000.txt'), 'utf8'), new Set(byId.keys()), shapes);
  const labelsPath = join(RAW_DIR, 'wikidata', 'city-labels.json');
  const labels: Record<string, { fr: string | null }> = existsSync(labelsPath) ? await readJson(labelsPath) : {};
  const frenchNames = Object.fromEntries(Object.entries(labels).map(([id, value]) => [id, value.fr]));
  const choices = await readJson<Record<string, CityChoice[]>>(join(SOURCES_DIR, 'villes.json'));

  const { cities, errors } = selectCities(choices, geo, frenchNames);
  for (const country of Object.keys(choices)) {
    if (!country.startsWith('_') && !byId.has(country)) errors.push(`Pays inconnu dans villes.json : ${country}`);
  }
  if (errors.length) throw new Error(`À corriger dans data/sources/villes.json :\n- ${errors.join('\n- ')}`);

  // Contrôles de relecture (avertissements, pas des erreurs).
  const warnings: string[] = [];
  for (const city of cities) {
    const country = byId.get(city.country)!;
    const shape = shapes.get(city.country);
    const point: [number, number] = [city.lon, city.lat];
    if (shape && !geoContains(shape, point) && distanceToShapeKm(shape as never, city.lon, city.lat) > OUTSIDE_KM) {
      warnings.push(`${city.name} (${country.name}) est à plus de ${OUTSIDE_KM} km de son pays sur la carte.`);
    }
    if (country.capital && distanceKm(point, [country.capital.lon, country.capital.lat]) < NEAR_CAPITAL_KM) {
      warnings.push(`${city.name} est à moins de ${NEAR_CAPITAL_KM} km de ${country.capital.name}, la capitale.`);
    }
  }

  await writeJson(join(WORLD_DIR, 'cities.json'), cities);
  await writeFile(join(WORLD_DIR, 'RAPPORT-VILLES.md'), report(countries, cities, warnings), 'utf8');
  console.log(`✓ ${cities.length} villes dans ${new Set(cities.map((c) => c.country)).size} pays.`);
  if (warnings.length) console.log(`${warnings.length} point(s) à vérifier :\n- ${warnings.join('\n- ')}`);
}

function report(countries: CountryEntity[], cities: Array<{ country: string; name: string; aliases: string[]; population: number }>, warnings: string[]): string {
  const lines = [
    '# Villes : rapport de relecture',
    '',
    '> Généré par `npm run data:cities` à partir de `data/sources/villes.json` (à modifier là, pas ici).',
    '> Capitale exclue (déjà travaillée par les exercices de capitales). Entre parenthèses : autres noms acceptés en saisie.',
    '',
    `**${cities.length} villes** dans ${new Set(cities.map((c) => c.country)).size} pays.`,
    '',
  ];
  if (warnings.length) lines.push('## Points à vérifier', '', ...warnings.map((w) => `- ${w}`), '');
  lines.push('## Par pays', '', '| Pays | Quota | Villes |', '|---|---|---|');
  for (const country of [...countries].sort((a, b) => a.name.localeCompare(b.name, 'fr'))) {
    const list = cities.filter((c) => c.country === country.id);
    const quota = cityQuota(country);
    if (list.length === 0 && quota === 0) continue;
    const names = list.map((c) => `${c.name}${c.aliases.length ? ` (${c.aliases.join(', ')})` : ''} — ${(c.population / 1000).toFixed(0)} k`).join(' ; ');
    lines.push(`| ${country.name} | ${list.length} / ${quota} | ${names || '—'} |`);
  }
  return `${lines.join('\n')}\n`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
