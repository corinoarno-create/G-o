// Lecture des villes GeoNames (cities15000) et rattachement à nos entités.
import { geoContains } from 'd3-geo';
import type { Feature, Geometry } from 'geojson';

export interface GeoCity {
  geonameId: string;
  /** Nom usuel (souvent dans la langue locale, translittéré). */
  name: string;
  asciiName: string;
  /** Noms dans d'autres langues et graphies (sans indication de langue). */
  alternateNames: string[];
  lat: number;
  lon: number;
  /** Code de lieu GeoNames (PPLC : capitale, PPLA : chef-lieu…). */
  featureCode: string;
  /** Identifiant de notre entité (code ISO alpha-2 en minuscules, ou cyn / sol). */
  country: string;
  population: number;
}

/** Quartiers et lieux qui ne sont pas des villes à part entière. */
const SKIPPED_CODES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW']);

/**
 * Lit cities15000.txt. Les villes de Chypre du Nord et du Somaliland, rangées par GeoNames sous Chypre et la
 * Somalie, sont rattachées à leur entité d'après leur position (frontières « de facto » de la carte).
 */
export function parseGeoNames(text: string, known: Set<string>, shapes: Map<string, Feature<Geometry>>): GeoCity[] {
  const cities: GeoCity[] = [];
  const split = [
    { from: 'cy', to: 'cyn' },
    { from: 'so', to: 'sol' },
  ];
  for (const line of text.split('\n')) {
    const p = line.split('\t');
    if (p.length < 15 || SKIPPED_CODES.has(p[7]!)) continue;
    let country = p[8]!.toLowerCase();
    const lon = Number(p[5]);
    const lat = Number(p[4]);
    for (const { from, to } of split) {
      const shape = shapes.get(to);
      if (country === from && shape && geoContains(shape, [lon, lat])) country = to;
    }
    if (!known.has(country)) continue;
    cities.push({
      geonameId: p[0]!,
      name: p[1]!,
      asciiName: p[2]!,
      alternateNames: p[3] ? p[3].split(',') : [],
      lat,
      lon,
      featureCode: p[7]!,
      country,
      population: Number(p[14]) || 0,
    });
  }
  return cities;
}
