// Éléments demandés : un pays (ou sa capitale, son drapeau), ou une ville (mode Expert).
// Une question porte sur un identifiant d'élément : le code du pays (« fr ») ou celui de la ville (« c2995469 »).
// Ces fonctions évitent de supposer partout qu'un élément est un pays.
import type { CityEntity, CountryEntity } from '../data/types.ts';
import type { WorldData } from '../data/world.ts';
import { EXERCISES, type ExerciseId } from './exercises.ts';

export const isCityExercise = (exercise: ExerciseId) => EXERCISES[exercise].kind === 'city';

/**
 * Éléments qu'on peut demander dans cet exercice, parmi des pays (ceux d'une zone) : les pays éligibles,
 * ou les villes de ces pays.
 */
export function itemIds(world: WorldData, exercise: ExerciseId, countryIds: readonly string[]): string[] {
  if (isCityExercise(exercise)) return countryIds.flatMap((id) => (world.citiesByCountry.get(id) ?? []).map((city) => city.id));
  const definition = EXERCISES[exercise];
  return countryIds.filter((id) => {
    const entity = world.byId.get(id);
    return entity !== undefined && definition.eligible(entity);
  });
}

/** L'élément peut-il être demandé dans cet exercice ? */
export function isEligible(world: WorldData, exercise: ExerciseId, id: string): boolean {
  if (isCityExercise(exercise)) return world.cityById.has(id);
  const entity = world.byId.get(id);
  return entity !== undefined && EXERCISES[exercise].eligible(entity);
}

/** Pays d'un élément : lui-même, ou le pays de la ville. */
export function itemCountry(world: WorldData, id: string): CountryEntity | undefined {
  const city = world.cityById.get(id);
  return world.byId.get(city ? city.country : id);
}

/** Nom d'un élément, tel qu'on l'affiche (« Lyon », « France »). */
export function itemName(world: WorldData, id: string): string {
  return world.cityById.get(id)?.name ?? world.byId.get(id)?.name ?? id;
}

/** Ville d'un identifiant, s'il en est une. */
export const cityOf = (world: WorldData, id: string): CityEntity | undefined => world.cityById.get(id);

/** Noms acceptés pour une ville. */
export const cityAnswers = (city: CityEntity) => [city.name, ...city.aliases];

/**
 * Autres réponses possibles pour une ville : les autres villes du pays et sa capitale (une confusion entre deux
 * villes du même pays est une erreur, pas une faute de frappe).
 */
export function cityRivals(world: WorldData, city: CityEntity): string[] {
  const country = world.byId.get(city.country);
  const others = (world.citiesByCountry.get(city.country) ?? []).filter((other) => other.id !== city.id).flatMap(cityAnswers);
  const capitals = country ? [country.capital, ...country.otherCapitals].flatMap((capital) => (capital ? [capital.name, ...capital.aliases] : [])) : [];
  return [...others, ...capitals];
}

/**
 * Ce qu'il fallait répondre, avec son contexte : « Lyon (France) » pour une ville, « Lima (Pérou) » pour un
 * exercice de capitales, « Pérou » sinon.
 */
export function answerLabel(world: WorldData, exercise: ExerciseId, id: string): string {
  const city = world.cityById.get(id);
  if (city) return `${city.name} (${world.byId.get(city.country)?.name ?? city.country})`;
  const entity = world.byId.get(id);
  if (!entity) return id;
  const capitalExercise = exercise === 'name-capital' || exercise === 'locate-capital' || exercise === 'capital-to-country';
  return capitalExercise && entity.capital ? `${entity.capital.name} (${entity.name})` : entity.name;
}
