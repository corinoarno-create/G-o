// Construit les données du Monde prêtes à l'emploi à partir des sources brutes (data/raw/).
// Usage : npm run data:world   (après npm run data:download)
//
// Produit :
//   data/world/world.topo.json  frontières simplifiées (objets « entities » et « neutral ») ;
//   data/world/countries.json   fiches des entités (noms, capitales, statut, population…) ;
//   data/flags/<id>.svg         drapeaux ;
//   data/world/RAPPORT.md       rapport de relecture.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RAW_DIR, ROOT, SOURCES_DIR, WORLD_DIR, readJson, writeJson } from './lib/fs.ts';
import { buildWorldGeometry, type NeCollection } from './world/geometry.ts';
import {
  buildEntities,
  indexWikidata,
  type MledozeCountry,
  type Overrides,
  type WikidataResults,
  type WorldBankResponse,
} from './world/entities.ts';
import { buildFlags } from './world/flags.ts';
import { checkEntities } from './world/checks.ts';
import { buildReport } from './world/report.ts';

/** Choix structurants, rappelés en tête du rapport pour validation. */
const DECISIONS = [
  "Frontières : Natural Earth « de facto », sauf la **Crimée** (rattachée à l'Ukraine) et le **Sahara occidental** (territoire entier, y compris la partie administrée par le Maroc), qui suivent les frontières reconnues par l'ONU.",
  'Zones laissées neutres (grises, jamais demandées) : Bir Tawil, zone tampon de Chypre, bases britanniques de Chypre, glacier de Siachen, champ de glace Sud de Patagonie, île Brésilienne, Spratleys, Paracels, récifs disputés des Caraïbes et de Scarborough, Guantánamo, îles Ashmore-et-Cartier et de la mer de Corail, Clipperton.',
  "Capitales multiples : la première est celle qu'on place sur la carte ; les autres sont acceptées en saisie (Bolivie, Afrique du Sud, Malaisie, Sri Lanka, Eswatini, Palestine, Montserrat, Géorgie du Sud).",
  'Guinée équatoriale : la capitale est **Ciudad de la Paz** depuis le décret de janvier 2026 ; Malabo, où le transfert est encore en cours, reste acceptée en saisie.',
  "Sous-régions de l'ONU (M49), sauf l'**Iran**, rangé en Asie de l'Ouest avec le Moyen-Orient plutôt qu'en Asie du Sud. L'Amérique est un seul continent, découpé en Amérique du Nord, Amérique centrale, Caraïbes et Amérique du Sud.",
  "Pas de capitale demandée pour : Antarctique, Hong Kong, Macao, Tokelau, île Bouvet, îles Heard-et-MacDonald, îles mineures éloignées des États-Unis.",
  'Les DROM (Guadeloupe, Martinique, Guyane, La Réunion, Mayotte) sont des entités à part. Les territoires dont le drapeau est celui de leur État (signalés « = fr », « = no »…) seront exclus du mode Drapeaux.',
];

async function main(): Promise<void> {
  const raw = (path: string) => join(RAW_DIR, path);
  console.log('Lecture des sources…');
  const [units, disputed, mledoze, wikidataMain, wikidataExtra, worldBank, overrides] = await Promise.all([
    readJson<NeCollection>(raw('natural-earth/ne_10m_admin_0_map_units.geojson')),
    readJson<NeCollection>(raw('natural-earth/ne_10m_admin_0_disputed_areas.geojson')),
    readJson<MledozeCountry[]>(raw('mledoze/countries.json')),
    readJson<WikidataResults>(raw('wikidata/capitals.json')),
    readJson<WikidataResults>(raw('wikidata/capitals-extra.json')),
    readJson<WorldBankResponse>(raw('world-bank/population.json')),
    readJson<Overrides>(join(SOURCES_DIR, 'overrides-monde.json')),
  ]);

  console.log('Géométrie…');
  const geometry = await buildWorldGeometry(units, disputed);

  console.log('Fiches des entités…');
  const built = buildEntities({
    mledoze,
    wikidata: indexWikidata(wikidataMain, wikidataExtra),
    worldBank,
    units,
    geometry: geometry.entities,
    overrides,
  });

  console.log('Drapeaux…');
  const manualSameAs: Record<string, string> = {};
  for (const [id, override] of Object.entries(overrides)) {
    if (!id.startsWith('_') && !Array.isArray(override) && override.flagSameAs) manualSameAs[id] = override.flagSameAs;
  }
  const flags = await buildFlags(
    built.entities,
    {
      flagIconsDir: join(ROOT, 'node_modules', 'flag-icons', 'flags', '4x3'),
      rawDir: RAW_DIR,
      outputDir: join(ROOT, 'data', 'flags'),
    },
    manualSameAs,
  );
  const entities = flags.entities;

  const checks = checkEntities(entities, geometry.entities);
  if (checks.errors.length) {
    throw new Error(`Données incohérentes :\n- ${checks.errors.join('\n- ')}`);
  }
  const warnings = [...built.warnings, ...flags.warnings, ...checks.warnings];

  await writeFile(join(WORLD_DIR, 'world.topo.json'), geometry.topology, 'utf8');
  await writeJson(join(WORLD_DIR, 'countries.json'), entities);
  await writeFile(join(WORLD_DIR, 'RAPPORT.md'), buildReport(entities, warnings, DECISIONS), 'utf8');

  console.log(`✓ ${entities.length} entités, ${(geometry.topology.length / 1024).toFixed(0)} Ko de frontières.`);
  if (warnings.length) console.log(`${warnings.length} point(s) à vérifier :\n- ${warnings.join('\n- ')}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
