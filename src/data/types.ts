// Types des données géographiques prêtes à l'emploi (produites par scripts/build-world.ts).
// Partagés entre les scripts de génération et l'app.

/** Continents, selon la convention française (l'Amérique est un seul continent, découpé en sous-régions). */
export type ContinentId = 'africa' | 'americas' | 'antarctica' | 'asia' | 'europe' | 'oceania';

export type SubregionId =
  | 'northern-africa'
  | 'western-africa'
  | 'middle-africa'
  | 'eastern-africa'
  | 'southern-africa'
  | 'northern-america'
  | 'central-america'
  | 'caribbean'
  | 'south-america'
  | 'central-asia'
  | 'eastern-asia'
  | 'south-eastern-asia'
  | 'southern-asia'
  | 'western-asia'
  | 'northern-europe'
  | 'western-europe'
  | 'central-europe'
  | 'southern-europe'
  | 'southeast-europe'
  | 'eastern-europe'
  | 'australia-new-zealand'
  | 'melanesia'
  | 'micronesia'
  | 'polynesia'
  | 'antarctica';

/**
 * Statut de l'entité, toujours neutre et factuel :
 * - un-member : État membre de l'ONU ;
 * - un-observer : État observateur à l'ONU (Palestine, Vatican) ;
 * - limited-recognition : État à reconnaissance limitée (Kosovo, Taïwan…) ;
 * - disputed-territory : territoire dont le statut est disputé (Sahara occidental) ;
 * - dependency : territoire rattaché à un autre État (Groenland, Guam, Hong Kong…) ;
 * - overseas-region : région d'outre-mer faisant partie intégrante d'un État (DROM) ;
 * - other : cas à part (Antarctique).
 */
export type EntityStatus =
  | 'un-member'
  | 'un-observer'
  | 'limited-recognition'
  | 'disputed-territory'
  | 'dependency'
  | 'overseas-region'
  | 'other';

export interface Capital {
  /** Nom français courant. */
  name: string;
  /** Autres graphies acceptées en saisie (en plus de la tolérance aux fautes). */
  aliases: string[];
  lat: number;
  lon: number;
}

export interface CountryEntity {
  /** Identifiant stable : code ISO 3166-1 alpha-2 en minuscules, ou code maison (« cyn », « sol »). */
  id: string;
  /** Code ISO alpha-3 quand il existe. */
  iso3: string | null;
  /** Nom français courant, tel qu'affiché dans les questions. */
  name: string;
  /** Autres noms acceptés en saisie. */
  aliases: string[];
  /** Capitale principale : c'est elle qu'on place sur la carte. Null s'il n'y en a pas (Antarctique, Macao…). */
  capital: Capital | null;
  /** Autres capitales officielles, acceptées comme bonnes réponses en saisie (ex. La Paz pour la Bolivie). */
  otherCapitals: Capital[];
  continent: ContinentId;
  subregion: SubregionId;
  status: EntityStatus;
  /** Pour un territoire rattaché : identifiant de l'État de rattachement. */
  sovereign: string | null;
  population: number | null;
  populationYear: number | null;
  populationSource: 'world-bank' | 'wikidata' | 'manual' | null;
  /** Superficie (km²) calculée à partir des frontières simplifiées ; sert à repérer les petites entités. */
  areaKm2: number;
  /** Point d'ancrage [longitude, latitude] : étiquette, cercle de repère des micro-États. */
  anchor: [number, number];
  /** Nom du fichier drapeau dans data/flags/, ou null. */
  flag: string | null;
  /** Si le drapeau est identique à celui d'une autre entité (ex. Guadeloupe → France), l'identifiant de celle-ci. */
  flagSameAs: string | null;
}

/** Ville à apprendre (lot 3, mode Expert), hors capitale. Générée par scripts/build-cities.ts. */
export interface CityEntity {
  /** « c » + identifiant GeoNames. */
  id: string;
  /** Entité (pays ou territoire) où se trouve la ville. */
  country: string;
  /** Nom français affiché. */
  name: string;
  /** Autres noms acceptés en saisie (« Mumbai » pour Bombay). */
  aliases: string[];
  lon: number;
  lat: number;
  population: number;
}
