// Progression dans une zone (fiche d'une région du carnet) : pour chaque compétence, la part acquise,
// les révisions dues et les éléments jamais vus. Calcul pur, testé.
import type { CategoryId } from '../builder/options.ts';
import type { WorldData } from '../data/world.ts';
import { cardKey, isDue, masteryOf, trackOf, type Skill } from '../engine/srs.ts';
import { EXERCISES } from '../game/exercises.ts';
import { EXERCISES_FOR_SKILL } from '../game/questions.ts';
import type { Zone } from '../map/zones.ts';
import type { CardRecord } from '../storage/schema.ts';
import { expertSkillsFor, hasSeal } from './expert.ts';

export interface SkillProgress {
  skill: Skill;
  label: string;
  /** Éléments de la zone concernés par cette compétence. */
  total: number;
  /** Acquis ou maîtrisés. */
  strong: number;
  /** Révisions dues maintenant. */
  due: number;
  /** Jamais vus. */
  fresh: number;
}

export interface CategoryProgress {
  category: CategoryId;
  label: string;
  rows: SkillProgress[];
  /** Volet Expert : affiché à part, il ne compte pas dans la part acquise du carnet. */
  expert: boolean;
}

export interface ZoneProgress {
  /** Part des cartes du carnet acquises ou maîtrisées dans la zone, sans l'expert (0 à 1). */
  share: number;
  /** Nombre d'entités de la zone. */
  entities: number;
  /** Révisions du carnet dues dans la zone. */
  due: number;
  categories: CategoryProgress[];
  /** Volet Expert de la zone : part acquise, sceaux obtenus sur les pays qui peuvent en avoir un. */
  expert: { share: number; seals: number; sealable: number };
}

/** Compétences par catégorie, dans l'ordre de la fiche. */
const LAYOUT: Array<{ category: CategoryId; label: string; rows: Array<{ skill: Skill; label: string }> }> = [
  {
    category: 'countries',
    label: 'Pays',
    rows: [
      { skill: 'locate-country', label: 'Placer les pays' },
      { skill: 'name-country', label: 'Nommer les pays' },
    ],
  },
  {
    category: 'capitals',
    label: 'Capitales',
    rows: [
      { skill: 'capital-country', label: 'Capitale → pays' },
      { skill: 'name-capital', label: 'Donner les capitales' },
    ],
  },
  { category: 'flags', label: 'Drapeaux', rows: [{ skill: 'flag', label: 'Reconnaître les drapeaux' }] },
  { category: 'expert', label: 'Expert', rows: [{ skill: 'locate-capital', label: 'Placer les capitales' }] },
];

export function zoneProgress(world: WorldData, zone: Zone, cards: Map<string, CardRecord>, now: Date): ZoneProgress {
  const totals = { carnet: { strong: 0, cards: 0, due: 0 }, expert: { strong: 0, cards: 0, due: 0 } };
  const categories = LAYOUT.map(({ category, label, rows }) => ({
    category,
    label,
    expert: rows.every((row) => trackOf(row.skill) === 'expert'),
    rows: rows.map(({ skill, label: rowLabel }) => {
      const exercise = EXERCISES[EXERCISES_FOR_SKILL[skill][0]!];
      const row: SkillProgress = { skill, label: rowLabel, total: 0, strong: 0, due: 0, fresh: 0 };
      for (const id of zone.entityIds) {
        const entity = world.byId.get(id);
        if (!entity || !exercise.eligible(entity)) continue;
        row.total += 1;
        const record = cards.get(cardKey(id, skill));
        if (!record || record.card.reps === 0) {
          row.fresh += 1;
          continue;
        }
        const level = masteryOf(record.card);
        if (level === 'acquired' || level === 'mastered') row.strong += 1;
        if (isDue(record.card, now)) row.due += 1;
      }
      const total = totals[trackOf(skill)];
      total.strong += row.strong;
      total.cards += row.total;
      total.due += row.due;
      return row;
    }),
  }));
  const entities = zone.entityIds.flatMap((id) => world.byId.get(id) ?? []);
  const sealable = entities.filter((entity) => expertSkillsFor(entity).length > 0);
  const { carnet, expert } = totals;
  return {
    share: carnet.cards ? carnet.strong / carnet.cards : 0,
    entities: zone.entityIds.length,
    due: carnet.due,
    categories,
    expert: {
      share: expert.cards ? expert.strong / expert.cards : 0,
      seals: sealable.filter((entity) => hasSeal(entity, cards)).length,
      sealable: sealable.length,
    },
  };
}

/** « 12 % », arrondi ; un début de progrès ne s'affiche jamais « 0 % ». */
export function percent(share: number): string {
  if (share <= 0) return '0 %';
  return `${Math.max(1, Math.round(share * 100))} %`;
}
