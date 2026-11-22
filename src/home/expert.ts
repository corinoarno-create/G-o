// Sceau Expert : un pays le reçoit quand tout son volet expert est acquis (pour l'instant, placer sa capitale ;
// plus tard, aussi ses villes). Il récompense la maîtrise durable, pas le simple fait d'avoir vu l'élément.
import type { CountryEntity } from '../data/types.ts';
import { cardKey, masteryOf, skillsOf } from '../engine/srs.ts';
import { EXERCISES } from '../game/exercises.ts';
import { EXERCISES_FOR_SKILL } from '../game/questions.ts';
import type { CardRecord } from '../storage/schema.ts';

/** Compétences expert qui concernent ce pays (un territoire sans capitale n'en a aucune). */
export function expertSkillsFor(entity: CountryEntity) {
  return skillsOf('expert').filter((skill) => EXERCISES[EXERCISES_FOR_SKILL[skill][0]!].eligible(entity));
}

/** Le pays a-t-il son sceau ? Toutes ses compétences expert acquises ou maîtrisées (et au moins une). */
export function hasSeal(entity: CountryEntity, cards: Map<string, CardRecord>): boolean {
  const skills = expertSkillsFor(entity);
  return (
    skills.length > 0 &&
    skills.every((skill) => {
      const record = cards.get(cardKey(entity.id, skill));
      const level = record ? masteryOf(record.card) : 'new';
      return level === 'acquired' || level === 'mastered';
    })
  );
}
