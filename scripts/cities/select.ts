// Retrouve dans GeoNames les villes choisies à la main (data/sources/villes.json). Calcul pur, testé.
import { normalize } from '../../src/engine/text-match.ts';
import type { CityEntity } from '../../src/data/types.ts';
import type { GeoCity } from './geonames.ts';

/** Entrée de villes.json : le nom français affiché, ou un objet pour préciser la recherche. */
export type CityChoice = string | { nom: string; cherche?: string; geonames?: string; aussi?: string[] };

export interface Selection {
  cities: CityEntity[];
  /** Villes introuvables ou ambiguës : à corriger dans villes.json. */
  errors: string[];
}

/** Identifiant d'une ville dans l'app : « c » + identifiant GeoNames (stable, unique). */
export const cityId = (geonameId: string) => `c${geonameId}`;

/**
 * Pour chaque pays, cherche chaque ville par son nom (nom usuel, nom ASCII, autres graphies de GeoNames ou
 * nom français de Wikidata) ; s'il y a plusieurs lieux de ce nom dans le pays, on prend le plus peuplé.
 */
export function selectCities(
  choices: Record<string, CityChoice[]>,
  geoCities: GeoCity[],
  frenchNames: Record<string, string | null> = {},
): Selection {
  const byCountry = new Map<string, GeoCity[]>();
  for (const city of geoCities) {
    const list = byCountry.get(city.country) ?? [];
    list.push(city);
    byCountry.set(city.country, list);
  }
  const cities: CityEntity[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [country, list] of Object.entries(choices)) {
    if (country.startsWith('_')) continue;
    const pool = byCountry.get(country) ?? [];
    for (const choice of list) {
      const entry = typeof choice === 'string' ? { nom: choice } : choice;
      let found: GeoCity | undefined;
      if ('geonames' in entry && entry.geonames) {
        found = pool.find((city) => city.geonameId === entry.geonames);
      } else {
        const key = normalize(('cherche' in entry && entry.cherche) || entry.nom);
        const names = (city: GeoCity) => [city.name, city.asciiName, ...city.alternateNames, frenchNames[city.geonameId] ?? ''];
        found = pool
          .filter((city) => names(city).some((name) => name && normalize(name) === key))
          .sort((a, b) => b.population - a.population)[0];
      }
      if (!found) {
        errors.push(`${country} : « ${entry.nom} » introuvable dans GeoNames`);
        continue;
      }
      if (seen.has(found.geonameId)) {
        errors.push(`${country} : « ${entry.nom} » est en double`);
        continue;
      }
      seen.add(found.geonameId);
      // Autres réponses acceptées : celles données à la main, et le nom usuel de GeoNames s'il diffère.
      const aliases = new Set<string>('aussi' in entry && entry.aussi ? entry.aussi : []);
      for (const name of [found.name, found.asciiName]) {
        if (normalize(name) !== normalize(entry.nom)) aliases.add(name);
      }
      cities.push({
        id: cityId(found.geonameId),
        country,
        name: entry.nom,
        aliases: [...aliases].filter((alias) => normalize(alias) !== normalize(entry.nom)),
        lon: Math.round(found.lon * 1e4) / 1e4,
        lat: Math.round(found.lat * 1e4) / 1e4,
        population: found.population,
      });
    }
  }
  return { cities, errors };
}
