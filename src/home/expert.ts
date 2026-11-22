// Sceau Expert : un pays le reçoit quand tout son volet expert est acquis : placer sa capitale, placer et
// nommer chacune de ses villes. Il récompense la maîtrise durable, pas le simple fait d'avoir vu l'élément.
import type { CountryEntity } from '../data/types.ts';
import type { WorldData } from '../data/world.ts';
import { cardKey, masteryOf } from '../engine/srs.ts';
import type { CardRecord } from '../storage/schema.ts';

/** Cartes mémoire du volet expert d'un pays (aucune pour un territoire sans capitale ni ville). */
export function expertCardKeys(world: WorldData, entity: CountryEntity): string[] {
  const keys = entity.capital ? [cardKey(entity.id, 'locate-capital')] : [];
  for (const city of world.citiesByCountry.get(entity.id) ?? []) keys.push(cardKey(city.id, 'locate-city'), cardKey(city.id, 'name-city'));
  return keys;
}

/** Le pays a-t-il son sceau ? Toutes ses cartes expert acquises ou maîtrisées (et au moins une). */
export function hasSeal(world: WorldData, entity: CountryEntity, cards: Map<string, CardRecord>): boolean {
  const keys = expertCardKeys(world, entity);
  return (
    keys.length > 0 &&
    keys.every((key) => {
      const record = cards.get(key);
      const level = record ? masteryOf(record.card) : 'new';
      return level === 'acquired' || level === 'mastered';
    })
  );
}
