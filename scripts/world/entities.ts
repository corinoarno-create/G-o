// Construction des fiches des entités du Monde (pays et territoires) :
// noms français, capitales, continent, statut, population, superficie, point d'ancrage.
//
// Sources : mledoze/countries (liste, codes, régions, noms FR), Wikidata (capitales en français,
// coordonnées, population de secours), Banque mondiale (population), Natural Earth (géométrie, rattachement).
// Les corrections manuelles de data/sources/overrides-monde.json passent en dernier.
import { geoArea } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Capital, ContinentId, CountryEntity, EntityStatus, SubregionId } from '../../src/data/types.ts';
import { entityIdForUnit, NEUTRAL, type NeCollection } from './geometry.ts';

const EARTH_RADIUS_KM = 6371.0088;

// ---------------------------------------------------------------------------------------------
// Formats des sources
// ---------------------------------------------------------------------------------------------

export interface MledozeCountry {
  cca2: string;
  cca3: string;
  independent: boolean | null;
  unMember: boolean;
  region: string;
  subregion: string;
  translations: { fra?: { common: string; official: string } };
  name: { common: string };
}

export interface WikidataResults {
  results: {
    bindings: Array<Record<string, { value: string } | undefined>>;
  };
}

/** Réponse de l'API Banque mondiale : [métadonnées, enregistrements]. */
export type WorldBankResponse = [
  unknown,
  Array<{ countryiso3code: string; date: string; value: number | null }> | null,
];

type CapitalOverride = string | { pick?: string; name?: string; aliases?: string[]; lat?: number; lon?: number };

export interface EntityOverride {
  name?: string;
  aliases?: string[];
  iso3?: string | null;
  capital?: CapitalOverride | null;
  /** Variantes du nom de la capitale acceptées en saisie (ex. « Kyiv » pour Kiev). */
  capitalAliases?: string[];
  otherCapitals?: CapitalOverride[];
  /** Drapeau identique à celui d'une autre entité, quand le SVG diffère mais pas le dessin. */
  flagSameAs?: string;
  status?: EntityStatus;
  sovereign?: string | null;
  continent?: ContinentId;
  subregion?: SubregionId;
  anchor?: [number, number];
  population?: { value: number; year: number } | null;
}

export type Overrides = Record<string, EntityOverride | string[]>;

// ---------------------------------------------------------------------------------------------
// Régions : correspondance entre les sous-régions de mledoze et nos identifiants
// ---------------------------------------------------------------------------------------------

const SUBREGIONS: Record<string, [ContinentId, SubregionId]> = {
  'Northern Africa': ['africa', 'northern-africa'],
  'Western Africa': ['africa', 'western-africa'],
  'Middle Africa': ['africa', 'middle-africa'],
  'Eastern Africa': ['africa', 'eastern-africa'],
  'Southern Africa': ['africa', 'southern-africa'],
  'North America': ['americas', 'northern-america'],
  'Central America': ['americas', 'central-america'],
  Caribbean: ['americas', 'caribbean'],
  'South America': ['americas', 'south-america'],
  'Central Asia': ['asia', 'central-asia'],
  'Eastern Asia': ['asia', 'eastern-asia'],
  'South-Eastern Asia': ['asia', 'south-eastern-asia'],
  'Southern Asia': ['asia', 'southern-asia'],
  'Western Asia': ['asia', 'western-asia'],
  'Northern Europe': ['europe', 'northern-europe'],
  'Western Europe': ['europe', 'western-europe'],
  'Central Europe': ['europe', 'central-europe'],
  'Southern Europe': ['europe', 'southern-europe'],
  'Southeast Europe': ['europe', 'southeast-europe'],
  'Eastern Europe': ['europe', 'eastern-europe'],
  'Australia and New Zealand': ['oceania', 'australia-new-zealand'],
  Melanesia: ['oceania', 'melanesia'],
  Micronesia: ['oceania', 'micronesia'],
  Polynesia: ['oceania', 'polynesia'],
};

function regionOf(country: MledozeCountry): [ContinentId, SubregionId] {
  if (country.region === 'Antarctic') return ['antarctica', 'antarctica'];
  const region = SUBREGIONS[country.subregion];
  if (!region) throw new Error(`Sous-région inconnue pour ${country.cca2} : « ${country.subregion} »`);
  return region;
}

// ---------------------------------------------------------------------------------------------
// Wikidata : capitales et population par entité
// ---------------------------------------------------------------------------------------------

interface WikidataEntity {
  capitals: Map<string, { lat: number; lon: number } | null>;
  populations: Array<{ value: number; year: number | null }>;
}

/** Les entités sans code ISO sont demandées à Wikidata par identifiant. */
const WIKIDATA_EXTRA_IDS: Record<string, string> = { Q1246: 'xk', Q34754: 'sol', Q23681: 'cyn' };

function parsePoint(wkt: string): { lat: number; lon: number } | null {
  const match = /Point\(([-\d.eE]+) ([-\d.eE]+)\)/.exec(wkt);
  return match ? { lon: Number(match[1]), lat: Number(match[2]) } : null;
}

export function indexWikidata(main: WikidataResults, extra: WikidataResults): Map<string, WikidataEntity> {
  const index = new Map<string, WikidataEntity>();
  const add = (id: string, row: Record<string, { value: string } | undefined>) => {
    let entry = index.get(id);
    if (!entry) {
      entry = { capitals: new Map(), populations: [] };
      index.set(id, entry);
    }
    const label = row.capitalLabel?.value;
    if (label) {
      const point = row.coord ? parsePoint(row.coord.value) : null;
      if (!entry.capitals.get(label)) entry.capitals.set(label, point);
    }
    if (row.population) {
      const year = row.popDate ? new Date(row.popDate.value).getUTCFullYear() : null;
      entry.populations.push({ value: Number(row.population.value), year });
    }
  };
  for (const row of main.results.bindings) {
    if (row.iso) add(row.iso.value.toLowerCase(), row);
  }
  for (const row of extra.results.bindings) {
    const qid = row.entity?.value.split('/').pop() ?? '';
    const id = WIKIDATA_EXTRA_IDS[qid];
    // Pour le Kosovo, la requête principale (par code ISO) suffit si elle a trouvé quelque chose.
    if (id && !(id === 'xk' && index.has('xk'))) add(id, row);
  }
  return index;
}

/** Population la plus récente (les valeurs sans date passent après les valeurs datées). */
function latestPopulation(entry: WikidataEntity | undefined): { value: number; year: number | null } | null {
  if (!entry || entry.populations.length === 0) return null;
  return [...entry.populations].sort((a, b) => (b.year ?? -1) - (a.year ?? -1) || b.value - a.value)[0] ?? null;
}

// ---------------------------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------------------------

export interface EntitySources {
  mledoze: MledozeCountry[];
  wikidata: Map<string, WikidataEntity>;
  worldBank: WorldBankResponse;
  units: NeCollection;
  geometry: FeatureCollection<Geometry, { eid: string }>;
  overrides: Overrides;
}

/** Fiche avant l'ajout des drapeaux (traités à part). */
export type EntityWithoutFlag = Omit<CountryEntity, 'flag' | 'flagSameAs'>;

export interface EntityBuildResult {
  entities: EntityWithoutFlag[];
  /** Remarques à relire (données manquantes, valeurs suspectes…). */
  warnings: string[];
}

export function buildEntities(sources: EntitySources): EntityBuildResult {
  const warnings: string[] = [];
  const overrides = Object.fromEntries(
    Object.entries(sources.overrides).filter(([key]) => !key.startsWith('_')),
  ) as Record<string, EntityOverride>;

  // Population Banque mondiale par code ISO alpha-3 (le Kosovo y a le code XKX).
  const worldBank = new Map<string, { value: number; year: number }>();
  for (const record of sources.worldBank[1] ?? []) {
    // Les agrégats (Monde, régions…) ont un code vide ou non national : on ne garde que les pays.
    if (record.value != null && record.countryiso3code) {
      worldBank.set(record.countryiso3code, { value: record.value, year: Number(record.date) });
    }
  }

  // Unités Natural Earth regroupées par entité : rattachement et point d'étiquette.
  const unitsByEntity = new Map<string, Feature<Geometry, NeCollection['features'][number]['properties']>[]>();
  for (const unit of sources.units.features) {
    const eid = entityIdForUnit(unit.properties);
    if (!eid || eid === NEUTRAL) continue;
    unitsByEntity.set(eid, [...(unitsByEntity.get(eid) ?? []), unit]);
  }
  // Nom d'État souverain Natural Earth → identifiant d'entité. On cherche d'abord l'unité qui porte
  // exactement ce nom (GEOUNIT « France » → fr, et non la Guyane, qui a aussi ADMIN « France »),
  // puis, à défaut, une unité de la même entité administrative (Angleterre → gb pour « United Kingdom »).
  const sovereignIds = new Map<string, string>();
  for (const pass of ['GEOUNIT', 'ADMIN'] as const) {
    for (const [eid, units] of unitsByEntity) {
      for (const unit of units) {
        const sovereignName = unit.properties.SOVEREIGNT;
        if (unit.properties[pass] === sovereignName && !sovereignIds.has(sovereignName)) {
          sovereignIds.set(sovereignName, eid);
        }
      }
    }
  }
  const geometryById = new Map(sources.geometry.features.map((f) => [f.properties.eid, f]));

  // Liste des entités : les 250 de mledoze + les deux absentes (Chypre du Nord, Somaliland).
  const base: Array<{ id: string; country: MledozeCountry | null }> = [
    ...sources.mledoze.map((country) => ({ id: country.cca2.toLowerCase(), country })),
    { id: 'cyn', country: null },
    { id: 'sol', country: null },
  ];

  const entities: EntityWithoutFlag[] = [];
  for (const { id, country } of base) {
    const override = overrides[id] ?? {};
    const wikidata = sources.wikidata.get(id);
    const problem = (message: string) => warnings.push(`${id} : ${message}`);

    // Nom
    const name = override.name ?? country?.translations.fra?.common;
    if (!name) throw new Error(`${id} : pas de nom français`);

    // Continent et sous-région
    let continent = override.continent;
    let subregion = override.subregion;
    if (!continent || !subregion) {
      if (!country) throw new Error(`${id} : continent et sous-région à fournir dans les corrections`);
      [continent, subregion] = regionOf(country);
    }

    // Capitales
    const resolveCapital = (spec: CapitalOverride | undefined, role: string): Capital | null => {
      const wikiCapitals = wikidata?.capitals ?? new Map<string, { lat: number; lon: number } | null>();
      const fromWikidata = (label: string): Capital => {
        if (!wikiCapitals.has(label)) {
          throw new Error(`${id} : ${role} « ${label} » introuvable dans Wikidata (${[...wikiCapitals.keys()].join(', ')})`);
        }
        const point = wikiCapitals.get(label);
        if (!point) throw new Error(`${id} : ${role} « ${label} » sans coordonnées dans Wikidata`);
        return { name: label, aliases: [], ...point };
      };
      if (spec === undefined) {
        if (wikiCapitals.size === 0) throw new Error(`${id} : aucune capitale dans Wikidata, à préciser`);
        if (wikiCapitals.size > 1) {
          throw new Error(`${id} : plusieurs capitales dans Wikidata (${[...wikiCapitals.keys()].join(', ')}), à choisir`);
        }
        return fromWikidata([...wikiCapitals.keys()][0]!);
      }
      if (typeof spec === 'string') return fromWikidata(spec);
      let found: Capital | null = null;
      if (spec.pick) found = fromWikidata(spec.pick);
      else if (spec.lat === undefined && wikiCapitals.size === 1) found = fromWikidata([...wikiCapitals.keys()][0]!);
      const lat = spec.lat ?? found?.lat;
      const lon = spec.lon ?? found?.lon;
      const capitalName = spec.name ?? found?.name;
      if (lat === undefined || lon === undefined || !capitalName) {
        throw new Error(`${id} : ${role} incomplète (nom ou coordonnées manquants)`);
      }
      const aliases = [...(spec.aliases ?? [])];
      if (found && found.name !== capitalName) aliases.push(found.name);
      return { name: capitalName, aliases, lat, lon };
    };
    const capital = override.capital === null ? null : resolveCapital(override.capital, 'capitale');
    if (capital && override.capitalAliases) capital.aliases.push(...override.capitalAliases);
    if (capital) capital.aliases = [...new Set(capital.aliases)].filter((alias) => alias !== capital.name);
    const otherCapitals = (override.otherCapitals ?? []).map((spec) => resolveCapital(spec, 'autre capitale')!);

    // Statut et rattachement
    let status = override.status;
    if (!status) {
      if (country?.unMember) status = 'un-member';
      else if (country?.independent === false) status = 'dependency';
      else throw new Error(`${id} : statut indéterminé, à préciser dans les corrections`);
    }
    let sovereign: string | null = null;
    if (override.sovereign !== undefined) {
      sovereign = override.sovereign;
    } else if (status === 'dependency' || status === 'overseas-region') {
      const neSovereign = unitsByEntity.get(id)?.[0]?.properties.SOVEREIGNT;
      sovereign = (neSovereign && sovereignIds.get(neSovereign)) ?? null;
      if (sovereign === id) sovereign = null;
      if (!sovereign) problem(`territoire sans État de rattachement (Natural Earth : ${neSovereign ?? '?'})`);
    }

    // Population : Banque mondiale, sinon Wikidata, sinon correction manuelle.
    const iso3 = override.iso3 !== undefined ? override.iso3 : (country?.cca3 ?? null);
    let population: number | null = null;
    let populationYear: number | null = null;
    let populationSource: CountryEntity['populationSource'] = null;
    const fromWorldBank = id === 'xk' ? worldBank.get('XKX') : iso3 ? worldBank.get(iso3) : undefined;
    const fromWikidata = latestPopulation(wikidata);
    if (override.population !== undefined) {
      if (override.population) {
        population = override.population.value;
        populationYear = override.population.year;
        populationSource = 'manual';
      }
    } else if (fromWorldBank) {
      population = fromWorldBank.value;
      populationYear = fromWorldBank.year;
      populationSource = 'world-bank';
    } else if (fromWikidata) {
      population = fromWikidata.value;
      populationYear = fromWikidata.year;
      populationSource = 'wikidata';
      if (fromWikidata.year === null || fromWikidata.year < 2010) {
        problem(`population Wikidata ancienne ou non datée (${fromWikidata.value}, ${fromWikidata.year ?? 'sans date'})`);
      }
    } else {
      problem('population inconnue');
    }

    // Géométrie : superficie et point d'ancrage
    const shape = geometryById.get(id);
    if (!shape) throw new Error(`${id} : aucune géométrie Natural Earth`);
    const areaKm2 = geoArea(shape) * EARTH_RADIUS_KM ** 2;
    let anchor = override.anchor;
    if (!anchor) {
      // Point d'étiquette Natural Earth de la plus grande unité de l'entité.
      const units = unitsByEntity.get(id) ?? [];
      const largest = [...units].sort((a, b) => geoArea(b) - geoArea(a))[0];
      if (!largest) throw new Error(`${id} : aucune unité Natural Earth`);
      anchor = [largest.properties.LABEL_X, largest.properties.LABEL_Y];
    }

    entities.push({
      id,
      iso3,
      name,
      aliases: override.aliases ?? [],
      capital,
      otherCapitals,
      continent,
      subregion,
      status,
      sovereign,
      population: population === null ? null : Math.round(population),
      populationYear,
      populationSource,
      areaKm2: Math.round(areaKm2 * 100) / 100,
      anchor: [round(anchor[0], 4), round(anchor[1], 4)],
    });
  }

  for (const key of Object.keys(overrides)) {
    if (!entities.some((entity) => entity.id === key)) warnings.push(`correction « ${key} » sans entité correspondante`);
  }
  return { entities: entities.sort((a, b) => a.name.localeCompare(b.name, 'fr')), warnings };
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
