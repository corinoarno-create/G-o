// Nombre de villes par pays, selon sa taille et son importance (§ 3), sans compter la capitale.
import type { CountryEntity } from '../../src/data/types.ts';

/** Grands pays : 10 villes (liste du cahier des charges, plus le Canada et l'Afrique du Sud). */
export const BIG_COUNTRIES = new Set([
  'cn', 'in', 'us', 'br', 'ru', 'jp', 'mx', 'ng', 'id', 'fr', 'de', 'it', 'gb', 'es', 'au', 'ar', 'eg', 'tr', 'ir', 'pk',
  'ca', 'za',
]);

/**
 * 10 pour les grands pays ; 5 pour les pays moyens (au moins 10 millions d'habitants ou 1 million de km²) ;
 * 3 pour les petits (au moins 1 million d'habitants) ; 1 pour les très petits (au moins 100 000 habitants) ;
 * aucune pour les micro-États et petits territoires, dont la capitale suffit.
 */
export function cityQuota(country: Pick<CountryEntity, 'id' | 'population' | 'areaKm2'>): number {
  const population = country.population ?? 0;
  if (BIG_COUNTRIES.has(country.id)) return 10;
  if (population >= 10_000_000 || country.areaKm2 >= 1_000_000) return 5;
  if (population >= 1_000_000) return 3;
  if (population >= 100_000) return 1;
  return 0;
}
