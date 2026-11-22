// Résumé de l'accueil (§ 7) : les révisions du jour et l'état du carnet (maîtrise par pays et par continent).
// Calcul pur, à partir des cartes mémoire et de mes temps de référence.
import { CONTINENT_LABELS } from '../data/labels.ts';
import type { ContinentId } from '../data/types.ts';
import type { WorldData } from '../data/world.ts';
import { median, type AnswerMode, type TimingStats } from '../engine/grading.ts';
import { cardKey, masteryOf, parseCardKey, skillsOf, trackOf, type MasteryLevel, type Skill, type Track } from '../engine/srs.ts';
import { EXERCISES, type ExerciseId } from '../game/exercises.ts';
import { dueQuestions, REVIEW_BATCH } from '../game/plans.ts';
import { EXERCISES_FOR_SKILL } from '../game/questions.ts';
import type { CardRecord } from '../storage/schema.ts';
import { hasSeal } from './expert.ts';

/** Temps de réponse supposés tant que je n'ai pas assez de mesures (ms). */
const DEFAULT_ANSWER_MS: Record<AnswerMode, number> = { pin: 4000, type: 6000, choice: 3000 };
/** Temps passé à lire la correction et passer à la suite (ms). */
const OVERHEAD_MS = 2500;

/** Révisions du jour d'un volet (carnet ou expert, révisés séparément). */
export interface ReviewSummary {
  /** Révisions dues aujourd'hui. */
  due: number;
  /** Questions de la prochaine série de révisions (50 au plus). */
  reviewBatch: number;
  /** Durée estimée de cette série (minutes, au moins 1). */
  estimatedMinutes: number;
  /** Révisions dues par exercice, les plus nombreuses d'abord. */
  dueByExercise: Array<{ exercise: ExerciseId; label: string; count: number }>;
  /** Prochaine révision à venir, s'il n'y a rien de dû. */
  nextDueAt: Date | null;
}

export interface HomeSummary extends ReviewSummary {
  /** Révisions de l'expert, à part : du retard ici ne doit jamais assombrir l'accueil. */
  expert: ReviewSummary;
  /** Pays qui ont leur sceau Expert (tout le volet expert acquis). */
  seals: Set<string>;
  /** Progrès du carnet (sans l'expert). */
  progress: Record<MasteryLevel, number> & { total: number };
  /** Maîtrise de chaque entité, de 0 (rien vu) à 1 (tout maîtrisé) : colore la carte de conquête. */
  entityMastery: Map<string, number>;
  /** Part des cartes du carnet acquises ou maîtrisées, par continent (0 à 1). */
  continents: Array<{ id: ContinentId; label: string; share: number }>;
}

export function buildHomeSummary(
  world: WorldData,
  cards: Map<string, CardRecord>,
  timing: Map<AnswerMode, TimingStats>,
  now: Date,
): HomeSummary {
  // Progrès du carnet : niveau de maîtrise de chaque carte possible (élément × compétence), sans l'expert.
  const skills = skillsOf('carnet');
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
  const seals = new Set(world.countries.filter((entity) => hasSeal(world, entity, cards)).map((entity) => entity.id));
  const continents = (['europe', 'americas', 'africa', 'asia', 'oceania'] as ContinentId[]).map((id) => {
    const stats = byContinent.get(id) ?? { strong: 0, total: 0 };
    return { id, label: CONTINENT_LABELS[id], share: stats.total ? stats.strong / stats.total : 0 };
  });

  return {
    ...reviewSummary(world, cards, timing, now, 'carnet'),
    expert: reviewSummary(world, cards, timing, now, 'expert'),
    seals,
    progress,
    entityMastery,
    continents,
  };
}

/** Révisions dues d'un volet et durée estimée, d'après mes temps médians par façon de répondre. */
function reviewSummary(
  world: WorldData,
  cards: Map<string, CardRecord>,
  timing: Map<AnswerMode, TimingStats>,
  now: Date,
  track: Track,
): ReviewSummary {
  const due = dueQuestions(world, cards, now, () => 0, track);
  const batch = due.slice(0, REVIEW_BATCH);
  const typicalMs = (mode: AnswerMode) => median(timing.get(mode)?.samples ?? []) ?? DEFAULT_ANSWER_MS[mode];
  const totalMs = batch.reduce((sum, question) => sum + typicalMs(EXERCISES[question.exercise].answerMode) + OVERHEAD_MS, 0);
  const upcoming = [...cards.values()]
    .filter((record) => record.card.reps > 0 && record.card.dueAt.getTime() > now.getTime() && trackOf(parseCardKey(record.key).skill) === track)
    .map((record) => record.card.dueAt.getTime());
  // Regroupées par exercice, comme dans la manche de révision.
  const byExercise = new Map<ExerciseId, number>();
  for (const question of due) byExercise.set(question.exercise, (byExercise.get(question.exercise) ?? 0) + 1);
  const dueByExercise = [...byExercise]
    .map(([exercise, count]) => ({ exercise, label: EXERCISES[exercise].label, count }))
    .sort((a, b) => b.count - a.count);
  return {
    due: due.length,
    reviewBatch: batch.length,
    estimatedMinutes: batch.length ? Math.max(1, Math.round(totalMs / 60_000)) : 0,
    dueByExercise,
    nextDueAt: upcoming.length ? new Date(Math.min(...upcoming)) : null,
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
