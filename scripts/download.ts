// Télécharge les sources brutes dans data/raw/<source>/ (dossier ignoré par git).
// Usage : npm run data:download            (tout)
//         npm run data:download -- rivers   (seulement les fichiers dont le nom contient « rivers »)
// Chaque source va dans son propre dossier ; un fichier sources.json note la date et l'URL.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RAW_DIR, readJson, writeJson } from './lib/fs.ts';

interface Source {
  dir: string;
  file: string;
  url: string;
  licence: string;
  /** Options de requête (ex. en-têtes pour Wikidata). */
  init?: RequestInit;
}

// Requête Wikidata : pour chaque entité qui a un code ISO 3166-1 alpha-2 (P297) et n'est pas dissoute,
// on récupère sa ou ses capitales actuelles (P36 sans date de fin), leur nom français et leurs coordonnées,
// ainsi que la population de l'entité (P1082, la valeur la plus récente sera choisie au traitement).
const WIKIDATA_QUERY = `
SELECT ?iso ?entity ?entityLabel ?capital ?capitalLabel ?coord ?population ?popDate WHERE {
  ?entity wdt:P297 ?iso .
  FILTER NOT EXISTS { ?entity wdt:P576 ?dissolved }
  OPTIONAL {
    ?entity p:P36 ?capStmt .
    ?capStmt ps:P36 ?capital .
    FILTER NOT EXISTS { ?capStmt pq:P582 ?capEnd }
    FILTER NOT EXISTS { ?capStmt wikibase:rank wikibase:DeprecatedRank }
    OPTIONAL { ?capital wdt:P625 ?coord }
  }
  OPTIONAL {
    ?entity p:P1082 ?popStmt .
    ?popStmt ps:P1082 ?population .
    OPTIONAL { ?popStmt pq:P585 ?popDate }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }
}`;

// Kosovo, Somaliland et Chypre du Nord n'ont pas de code ISO officiel : on les demande par identifiant Wikidata.
const WIKIDATA_EXTRA_QUERY = `
SELECT ?entity ?entityLabel ?capital ?capitalLabel ?coord ?population ?popDate WHERE {
  VALUES ?entity { wd:Q1246 wd:Q34754 wd:Q23681 }
  OPTIONAL {
    ?entity p:P36 ?capStmt .
    ?capStmt ps:P36 ?capital .
    FILTER NOT EXISTS { ?capStmt pq:P582 ?capEnd }
    OPTIONAL { ?capital wdt:P625 ?coord }
  }
  OPTIONAL {
    ?entity p:P1082 ?popStmt .
    ?popStmt ps:P1082 ?population .
    OPTIONAL { ?popStmt pq:P585 ?popDate }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }
}`;

const wikidataInit: RequestInit = {
  headers: {
    Accept: 'application/sparql-results+json',
    // Wikidata demande un User-Agent identifiable ; on reste générique.
    'User-Agent': 'geo-app-data-scripts/0.1 (personal open-source project)',
  },
};

const wikidataUrl = (query: string) =>
  `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;

const SOURCES: Source[] = [
  {
    dir: 'natural-earth',
    file: 'ne_10m_admin_0_map_units.geojson',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_map_units.geojson',
    licence: 'Domaine public (Natural Earth)',
  },
  {
    // Polygones des zones disputées : sert à rétablir les frontières reconnues par l'ONU
    // (Crimée, Sahara occidental), là où la version « de facto » de Natural Earth s'en écarte.
    dir: 'natural-earth',
    file: 'ne_10m_admin_0_disputed_areas.geojson',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_disputed_areas.geojson',
    licence: 'Domaine public (Natural Earth)',
  },
  // Repères pour placer capitales et villes (scripts/build-landmarks.ts).
  {
    dir: 'natural-earth',
    file: 'ne_10m_rivers_lake_centerlines.geojson',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_rivers_lake_centerlines.geojson',
    licence: 'Domaine public (Natural Earth)',
  },
  {
    dir: 'natural-earth',
    file: 'ne_10m_lakes.geojson',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_lakes.geojson',
    licence: 'Domaine public (Natural Earth)',
  },
  {
    dir: 'natural-earth',
    file: 'ne_10m_admin_1_states_provinces_lines.geojson',
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_1_states_provinces_lines.geojson',
    licence: 'Domaine public (Natural Earth)',
  },
  {
    // Drapeaux absents de flag-icons (entités sans code ISO officiel).
    dir: 'wikimedia',
    file: 'flag-somaliland.svg',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_Somaliland.svg',
    licence: 'Domaine public (Wikimedia Commons)',
    init: wikidataInit,
  },
  {
    dir: 'wikimedia',
    file: 'flag-northern-cyprus.svg',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_the_Turkish_Republic_of_Northern_Cyprus.svg',
    licence: 'Domaine public (Wikimedia Commons)',
    init: wikidataInit,
  },
  {
    dir: 'mledoze',
    file: 'countries.json',
    url: 'https://raw.githubusercontent.com/mledoze/countries/master/countries.json',
    licence: 'ODbL 1.0 (mledoze/countries)',
  },
  {
    dir: 'world-bank',
    file: 'population.json',
    // mrnev=1 : la valeur la plus récente non vide pour chaque pays.
    url: 'https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&mrnev=1&per_page=500',
    licence: 'CC BY 4.0 (Banque mondiale)',
  },
  {
    dir: 'wikidata',
    file: 'capitals.json',
    url: wikidataUrl(WIKIDATA_QUERY),
    licence: 'CC0 (Wikidata)',
    init: wikidataInit,
  },
  {
    dir: 'wikidata',
    file: 'capitals-extra.json',
    url: wikidataUrl(WIKIDATA_EXTRA_QUERY),
    licence: 'CC0 (Wikidata)',
    init: wikidataInit,
  },
];

async function main(): Promise<void> {
  // Avec des filtres, on ne télécharge que les fichiers concernés et on garde le journal des autres.
  const filters = process.argv.slice(2);
  const logPath = join(RAW_DIR, 'sources.json');
  type LogEntry = { url: string; licence: string; date: string; bytes: number };
  const log: Record<string, LogEntry> = filters.length && existsSync(logPath) ? await readJson<Record<string, LogEntry>>(logPath) : {};
  const selected = filters.length ? SOURCES.filter((source) => filters.some((filter) => source.file.includes(filter))) : SOURCES;
  if (selected.length === 0) throw new Error(`Aucune source ne correspond à : ${filters.join(', ')}`);
  for (const source of selected) {
    const dir = join(RAW_DIR, source.dir);
    await mkdir(dir, { recursive: true });
    process.stdout.write(`↓ ${source.dir}/${source.file} … `);
    const response = await fetch(source.url, source.init);
    if (!response.ok) {
      throw new Error(`Échec du téléchargement ${source.url} : ${response.status} ${response.statusText}`);
    }
    const body = Buffer.from(await response.arrayBuffer());
    await writeFile(join(dir, source.file), body);
    log[`${source.dir}/${source.file}`] = {
      url: source.url.length > 200 ? `${source.url.slice(0, 200)}…` : source.url,
      licence: source.licence,
      date: new Date().toISOString(),
      bytes: body.length,
    };
    console.log(`${(body.length / 1024 / 1024).toFixed(1)} Mo`);
  }
  await writeJson(logPath, log);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
