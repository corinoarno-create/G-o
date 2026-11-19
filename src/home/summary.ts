// Résumé de l'accueil (§ 7) : ce que je peux travailler aujourd'hui.
// Calcul pur, à partir des cartes mémoire et de mes temps de référence.
import { CONTINENT_LABELS } from '../data/labels.ts';
import type { ContinentId } from '../data/types.ts';
import type { WorldData } from '../data/world.ts';
import { median, type AnswerMode, type TimingStats } from '../engine/grading.ts';
import { cardKey, masteryOf, SKILL_LABELS, type MasteryLevel, type Skill } from '../engine/srs.ts';
import { EXERCISES, type ExerciseId } from '../game/exercises.ts';
import { dueQuestions, quickExercise, REVIEW_BATCH } from '../game/plans.ts';
import { EXERCISES_FOR_SKILL } from '../game/questions.ts';
import type { Zone } from '../map/zones.ts';
import type { CardRecord } from '../storage/schema.ts';

/** Temps de réponse supposés tant que je n'ai pas assez de mesures (ms). */
const DEFAULT_ANSWER_MS: Record<AnswerMode, number> = { pin: 4000, type: 6000, choice: 3000 };
/** Temps passé à lire la correction et passer à la suite (ms). */
const OVERHEAD_MS = 2500;

/** Une découverte suggérée : une catégorie dans une sous-région où il reste beaucoup à voir. */
export interface Discovery {
  categoryLabel: string;
  exercise: ExerciseId;
  zone: Zone;
  unseen: number;
}

export interface HomeSummary {
  /** Révisions dues aujourd'hui. */
  due: number;
  /** Questions de la prochaine série de révisions (50 au plus). */
  reviewBatch: number;
  /** Durée estimée de cette série (minutes, au moins 1). */
  estimatedMinutes: number;
  /** Prochaine révision à venir, s'il n'y a rien de dû. */
  nextDueAt: Date | null;
  progress: Record<MasteryLevel, number> & { total: number };
  /** Maîtrise de chaque entité, de 0 (rien vu) à 1 (tout maîtrisé) : colore la carte de conquête. */
  entityMastery: Map<string, number>;
  /** Part des cartes acquises ou maîtrisées, par continent (0 à 1). */
  continents: Array<{ id: ContinentId; label: string; share: number }>;
  discoveries: Discovery[];
  /** Exercice de l'entretien rapide (un seul par entretien). */
  quickExercise: ExerciseId;
}

const DISCOVERY_CATEGORIES: Array<{ label: string; exercise: ExerciseId }> = [
  { label: 'Pays', exercise: 'locate-country' },
  { label: 'Capitales', exercise: 'name-capital' },
  { label: 'Drapeaux', exercise: 'flag-to-country' },
];

/** Petit hachage stable, pour varier les suggestions d'un jour à l'autre à égalité. */
function hash(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
}

const dayKey = (now: Date) => `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

export function buildHomeSummary(
  world: WorldData,
  zones: Zone[],
  cards: Map<string, CardRecord>,
  timing: Map<AnswerMode, TimingStats>,
  now: Date,
): HomeSummary {
  // Révisions dues et durée estimée, d'après mes temps médians par façon de répondre.
  const due = dueQuestions(world, cards, now, () => 0);
  const batch = due.slice(0, REVIEW_BATCH);
  const typicalMs = (mode: AnswerMode) => median(timing.get(mode)?.samples ?? []) ?? DEFAULT_ANSWER_MS[mode];
  const totalMs = batch.reduce((sum, question) => sum + typicalMs(EXERCISES[question.exercise].answerMode) + OVERHEAD_MS, 0);
  const upcoming = [...cards.values()]
    .filter((record) => record.card.reps > 0 && record.card.dueAt.getTime() > now.getTime())
    .map((record) => record.card.dueAt.getTime());

  // Progrès : niveau de maîtrise de chaque carte possible (élément × compétence).
  const skills = Object.keys(SKILL_LABELS) as Skill[];
  const exerciseOf = (skill: Skill): ExerciseId => EXERCISES_FOR_SKILL[skill][0]!;
  const progress = { new: 0, learning: 0, acquired: 0, mastered: 0, total: 0 };
  const rank: Record<MasteryLevel, number> = { new: 0, learning: 1, acquired: 2, mastered: 3 };
  const entityMastery = new Map<string, number>();
  const byContinent = new Map<ContinentId, { strong: number; total: number }>();
  for (const entity of world.countries) {
    let sum = 0;
    let count = 0;
    for (const skill of skills) {
      if (!EXERCISES[exerciseOf(skill)].eligible(entity)) continue;
      const record = cards.get(cardKey(entity.id, skill));
      const level = record ? masteryOf(record.card) : 'new';
      progress[level] += 1;
      progress.total += 1;
      sum += rank[level];
      count += 1;
      const stats = byContinent.get(entity.continent) ?? { strong: 0, total: 0 };
      stats.total += 1;
      if (rank[level] >= 2) stats.strong += 1;
      byContinent.set(entity.continent, stats);
    }
    entityMastery.set(entity.id, count ? sum / (3 * count) : 0);
  }
  const continents = (['europe', 'americas', 'africa', 'asia', 'oceania'] as ContinentId[]).map((id) => {
    const stats = byContinent.get(id) ?? { strong: 0, total: 0 };
    return { id, label: CONTINENT_LABELS[id], share: stats.total ? stats.strong / stats.total : 0 };
  });

  // Découvertes : pour chaque catégorie, la sous-région où il reste le plus d'éléments jamais vus
  // (une sous-région différente pour chaque catégorie, pour varier).
  const today = dayKey(now);
  const discoveries: Discovery[] = [];
  const usedZones = new Set<string>();
  for (const category of DISCOVERY_CATEGORIES) {
    const exercise = EXERCISES[category.exercise];
    const candidates = zones
      .filter((zone) => zone.kind === 'subregion')
      .map((zone) => ({
        zone,
        unseen: zone.entityIds.filter((id) => {
          const entity = world.byId.get(id);
          return entity && exercise.eligible(entity) && (cards.get(cardKey(id, exercise.skill))?.card.reps ?? 0) === 0;
        }).length,
      }))
      .filter((candidate) => candidate.unseen > 0)
      .sort((a, b) => b.unseen - a.unseen || hash(today + a.zone.id) - hash(today + b.zone.id));
    const best = candidates.find((candidate) => !usedZones.has(candidate.zone.id)) ?? candidates[0];
    if (best) {
      usedZones.add(best.zone.id);
      discoveries.push({ categoryLabel: category.label, exercise: category.exercise, zone: best.zone, unseen: best.unseen });
    }
  }
  discoveries.sort((a, b) => b.unseen - a.unseen);

  return {
    due: due.length,
    reviewBatch: batch.length,
    estimatedMinutes: batch.length ? Math.max(1, Math.round(totalMs / 60_000)) : 0,
    nextDueAt: upcoming.length ? new Date(Math.min(...upcoming)) : null,
    progress,
    entityMastery,
    continents,
    discoveries: discoveries.slice(0, 2),
    quickExercise: quickExercise(world, cards, now),
  };
}

/** « plus tard aujourd'hui », « demain », « dans 3 jours ». */
export function formatWhen(date: Date, now: Date): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (days <= 0) return 'plus tard aujourd’hui';
  if (days === 1) return 'demain';
  return `dans ${days} jours`;
}
