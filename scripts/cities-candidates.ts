// Prépare le choix des villes (lot 3) : pour chaque pays, les villes candidates de GeoNames, avec leur nom
// français et leur notoriété (nombre d'articles Wikipédia, via Wikidata), sans la capitale.
// Usage : npm run data:cities-candidates   (après npm run data:download -- cities15000)
//
// Produit data/raw/cities-candidates.json (fichier de travail, non versionné) : c'est à partir de lui que la
// liste des villes est choisie à la main dans data/sources/villes.json.
// Les noms et la notoriété sont mis en cache dans data/raw/wikidata/city-labels.json.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { feature } from 'topojson-client';
import type { Feature, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { distanceKm } from '../src/engine/geo.ts';
import type { CountryEntity } from '../src/data/types.ts';
import { RAW_DIR, SOURCES_DIR, WORLD_DIR, readJson, writeJson } from './lib/fs.ts';
import { parseGeoNames, type GeoCity } from './cities/geonames.ts';
import { cityQuota } from './cities/quotas.ts';

/** Candidats gardés par pays (les plus peuplés), parmi lesquels on choisit. */
const MAX_CANDIDATES = 40;
/** Une ville à moins de tant de km de la capitale est la capitale elle-même (ou l'un de ses quartiers). */
const CAPITAL_RADIUS_KM = 10;
const WIKIDATA_BATCH = 200;

export interface WikidataCity {
  fr: string | null;
  sitelinks: number;
}

async function fetchWikidata(ids: string[]): Promise<Record<string, WikidataCity>> {
  const values = ids.map((id) => `"${id}"`).join(' ');
  const query = `SELECT ?gid ?label ?links WHERE {
    VALUES ?gid { ${values} }
    ?item wdt:P1566 ?gid ; wikibase:sitelinks ?links .
    OPTIONAL { ?item rdfs:label ?label FILTER(lang(?label) = "fr") }
  }`;
  const response = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'geo-app-data-scripts/0.1 (personal open-source project)' },
  });
  if (!response.ok) throw new Error(`Wikidata : ${response.status} ${response.statusText}`);
  const json = (await response.json()) as { results: { bindings: Array<Record<string, { value: string }>> } };
  const result: Record<string, WikidataCity> = {};
  for (const row of json.results.bindings) {
    const id = row.gid!.value;
    const links = Number(row.links!.value);
    // Plusieurs éléments Wikidata pour un même lieu : on garde le plus connu.
    if (!result[id] || links > result[id].sitelinks) result[id] = { fr: row.label?.value ?? result[id]?.fr ?? null, sitelinks: links };
  }
  for (const id of ids) result[id] ??= { fr: null, sitelinks: 0 };
  return result;
}

async function main(): Promise<void> {
  const countries = await readJson<CountryEntity[]>(join(WORLD_DIR, 'countries.json'));
  const topology = await readJson<Topology<{ entities: GeometryCollection<{ eid: string }> }>>(join(WORLD_DIR, 'world.topo.json'));
  const shapes = new Map(
    (feature(topology, topology.objects.entities).features as Array<Feature<Geometry, { eid: string }>>).map((f) => [f.properties.eid, f]),
  );
  const text = await readFile(join(RAW_DIR, 'geonames', 'cities15000.txt'), 'utf8');
  const all = parseGeoNames(text, new Set(countries.map((c) => c.id)), shapes);
  const anki = await readJson<Array<{ ville: string; pays: string }>>(join(SOURCES_DIR, 'indices-anki.json'));

  // Candidats : les plus peuplés de chaque pays, sans la capitale.
  const byCountry = new Map<string, GeoCity[]>();
  for (const country of countries) {
    const capital = country.capital ? ([country.capital.lon, country.capital.lat] as [number, number]) : null;
    const list = all
      .filter((city) => city.country === country.id)
      .filter((city) => !capital || distanceKm(capital, [city.lon, city.lat]) > CAPITAL_RADIUS_KM)
      .sort((a, b) => b.population - a.population)
      .slice(0, MAX_CANDIDATES);
    byCountry.set(country.id, list);
  }

  // Noms français et notoriété, avec un cache pour ne pas tout redemander.
  const cachePath = join(RAW_DIR, 'wikidata', 'city-labels.json');
  const cache: Record<string, WikidataCity> = existsSync(cachePath) ? await readJson(cachePath) : {};
  const missing = [...byCountry.values()].flat().map((c) => c.geonameId).filter((id) => !cache[id]);
  for (let i = 0; i < missing.length; i += WIKIDATA_BATCH) {
    process.stdout.write(`Wikidata ${i + 1}–${Math.min(i + WIKIDATA_BATCH, missing.length)} / ${missing.length}…\r`);
    Object.assign(cache, await fetchWikidata(missing.slice(i, i + WIKIDATA_BATCH)));
    await writeJson(cachePath, cache);
  }
  console.log();

  const ankiKey = (pays: string, ville: string) => `${pays}|${ville}`.toLowerCase();
  const ankiSet = new Set(anki.map((a) => ankiKey(a.pays, a.ville)));
  const output = countries.map((country) => ({
    id: country.id,
    name: country.name,
    population: country.population,
    areaKm2: Math.round(country.areaKm2),
    capital: country.capital?.name ?? null,
    quota: cityQuota(country),
    candidates: (byCountry.get(country.id) ?? []).map((city) => {
      const wd = cache[city.geonameId]!;
      return {
        geonameId: city.geonameId,
        name: city.name,
        fr: wd.fr,
        population: city.population,
        sitelinks: wd.sitelinks,
        anki: wd.fr !== null && ankiSet.has(ankiKey(country.name, wd.fr)),
      };
    }),
  }));
  await writeJson(join(RAW_DIR, 'cities-candidates.json'), output);
  const total = output.reduce((n, c) => n + c.quota, 0);
  console.log(`✓ ${output.length} pays, ${missing.length} villes demandées à Wikidata, quotas : ${total} villes au total.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
