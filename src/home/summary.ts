// Résumé de l'accueil (§ 7) : ce que je peux travailler aujourd'hui.
// Calcul pur, à partir des cartes mémoire et de mes temps de référence.
import type { WorldData } from '../data/world.ts';
import { median, type AnswerMode, type TimingStats } from '../engine/grading.ts';
import { cardKey, masteryOf, type MasteryLevel, type Skill } from '../engine/srs.ts';
import { EXERCISES, type ExerciseId } from '../game/exercises.ts';
import { dueQuestions, REVIEW_BATCH } from '../game/plans.ts';
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
  discoveries: Discovery[];
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
  const skills: Skill[] = ['locate-country', 'name-country', 'locate-capital', 'name-capital', 'flag'];
  const exerciseOf: Record<Skill, ExerciseId> = {
    'locate-country': 'locate-country',
    'name-country': 'name-country',
    'locate-capital': 'locate-capital',
    'name-capital': 'name-capital',
    flag: 'flag-to-country',
  };
  const progress = { new: 0, learning: 0, acquired: 0, mastered: 0, total: 0 };
  for (const skill of skills) {
    for (const entity of world.countries) {
      if (!EXERCISES[exerciseOf[skill]].eligible(entity)) continue;
      const record = cards.get(cardKey(entity.id, skill));
      progress[record ? masteryOf(record.card) : 'new'] += 1;
      progress.total += 1;
    }
  }

  // Découvertes : pour chaque catégorie, la sous-région où il reste le plus d'éléments jamais vus.
  const today = dayKey(now);
  const discoveries: Discovery[] = [];
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
    const best = candidates[0];
    if (best) discoveries.push({ categoryLabel: category.label, exercise: category.exercise, zone: best.zone, unseen: best.unseen });
  }
  discoveries.sort((a, b) => b.unseen - a.unseen);

  return {
    due: due.length,
    reviewBatch: batch.length,
    estimatedMinutes: batch.length ? Math.max(1, Math.round(totalMs / 60_000)) : 0,
    nextDueAt: upcoming.length ? new Date(Math.min(...upcoming)) : null,
    progress,
    discoveries: discoveries.slice(0, 2),
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
