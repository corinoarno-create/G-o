// Statistiques de la page « Ma progression » (lot C), calculées à partir des cartes mémoire et du
// journal des réponses. Fonctions pures : l'affichage est dans ProgressScreen.tsx.
import { CONTINENT_LABELS } from '../data/labels.ts';
import type { ContinentId } from '../data/types.ts';
import type { WorldData } from '../data/world.ts';
import { median, type AnswerMode } from '../engine/grading.ts';
import { cardKey, masteryOf, parseCardKey, SKILL_LABELS, trackOf, type MasteryLevel, type Skill } from '../engine/srs.ts';
import { EXERCISES, type ExerciseId } from '../game/exercises.ts';
import { EXERCISES_FOR_SKILL } from '../game/questions.ts';
import { weakness } from '../game/selection.ts';
import type { CardRecord, ReviewRecord } from '../storage/schema.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nombre de jours de l'histogramme d'activité. */
export const ACTIVITY_DAYS = 30;
/** Nombre de semaines de la courbe des temps. */
export const SPEED_WEEKS = 8;
/** Nombre de jours de la prévision des révisions. */
export const UPCOMING_DAYS = 7;
/** Nombre de points faibles listés. */
export const WEAK_COUNT = 10;

export type MasteryCounts = Record<MasteryLevel, number> & { total: number };

export interface ProgressStats {
  figures: {
    /** Jours où j'ai répondu à au moins une question. */
    daysPlayed: number;
    /** Réponses données (premiers essais, nouveaux essais compris). */
    answers: number;
    /** Part de premières réponses justes sur les 30 derniers jours (null sans réponse). */
    accuracy: number | null;
    acquired: number;
    mastered: number;
  };
  /** Premières réponses justes et fausses, jour par jour (le plus ancien d'abord). */
  activity: Array<{ day: Date; correct: number; wrong: number }>;
  /** Par compétence ; celles du volet Expert sont marquées (affichées à part). */
  masteryBySkill: Array<{ skill: Skill; label: string; counts: MasteryCounts; expert: boolean }>;
  /** Par continent : le carnet seul (sans l'expert), comme sur l'accueil. */
  masteryByContinent: Array<{ id: ContinentId; label: string; counts: MasteryCounts }>;
  /** Temps médians (ms) semaine par semaine, et écart médian (km) pour « Placer la capitale ». */
  speed: Array<{ weekStart: Date; medians: Record<AnswerMode, number | null>; capitalKm: number | null }>;
  /** Révisions prévues jour par jour ; le premier jour compte aussi celles en retard. */
  upcoming: Array<{ day: Date; count: number }>;
  weak: Array<{ entityId: string; skill: Skill; exercise: ExerciseId; lapses: number; mastery: MasteryLevel }>;
}

/** Minuit (heure locale) du jour donné. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Lundi (minuit) de la semaine du jour donné. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const offset = (day.getDay() + 6) % 7; // lundi = 0
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset);
}

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const emptyCounts = (): MasteryCounts => ({ new: 0, learning: 0, acquired: 0, mastered: 0, total: 0 });

/** Exercice qui représente une compétence (pour savoir si une entité y est éligible, et pour la rejouer). */
export const exerciseOfSkill = (skill: Skill): ExerciseId => EXERCISES_FOR_SKILL[skill][0]!;

export function buildProgressStats(world: WorldData, cards: Map<string, CardRecord>, reviews: ReviewRecord[], now: Date): ProgressStats {
  const today = startOfDay(now);
  const skills = Object.keys(SKILL_LABELS) as Skill[];

  // Maîtrise de chaque carte possible, par compétence et par continent.
  const bySkill = new Map(skills.map((skill) => [skill, emptyCounts()]));
  const byContinent = new Map<ContinentId, MasteryCounts>();
  for (const entity of world.countries) {
    if (entity.continent === 'antarctica') continue;
    for (const skill of skills) {
      if (!EXERCISES[exerciseOfSkill(skill)].eligible(entity)) continue;
      const record = cards.get(cardKey(entity.id, skill));
      const level = record ? masteryOf(record.card) : 'new';
      const skillCounts = bySkill.get(skill)!;
      skillCounts[level] += 1;
      skillCounts.total += 1;
      if (trackOf(skill) === 'expert') continue;
      const continentCounts = byContinent.get(entity.continent) ?? emptyCounts();
      continentCounts[level] += 1;
      continentCounts.total += 1;
      byContinent.set(entity.continent, continentCounts);
    }
  }
  // Villes (mode Expert) : comptées par compétence seulement (l'expert ne compte pas par continent).
  for (const city of world.cities) {
    for (const skill of ['locate-city', 'name-city'] as const) {
      const record = cards.get(cardKey(city.id, skill));
      const level = record ? masteryOf(record.card) : 'new';
      const skillCounts = bySkill.get(skill)!;
      skillCounts[level] += 1;
      skillCounts.total += 1;
    }
  }
  const totals = [...bySkill.values()].reduce(
    (sum, counts) => ({ acquired: sum.acquired + counts.acquired, mastered: sum.mastered + counts.mastered }),
    { acquired: 0, mastered: 0 },
  );

  // Activité : premières réponses des 30 derniers jours.
  const firstStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (ACTIVITY_DAYS - 1));
  const activity = Array.from({ length: ACTIVITY_DAYS }, (_, i) => ({
    day: new Date(firstStart.getFullYear(), firstStart.getMonth(), firstStart.getDate() + i),
    correct: 0,
    wrong: 0,
  }));
  const activityIndex = new Map(activity.map((entry, i) => [dayKey(entry.day), i]));
  const days = new Set<string>();
  for (const review of reviews) {
    days.add(dayKey(review.at));
    if (!review.firstAttempt) continue;
    const index = activityIndex.get(dayKey(review.at));
    if (index === undefined) continue;
    if (review.correct) activity[index]!.correct += 1;
    else activity[index]!.wrong += 1;
  }
  const recentCorrect = activity.reduce((sum, entry) => sum + entry.correct, 0);
  const recentTotal = activity.reduce((sum, entry) => sum + entry.correct + entry.wrong, 0);

  // Temps médians par semaine : premières réponses justes, sans indice.
  const thisWeek = startOfWeek(now);
  const weeks = Array.from({ length: SPEED_WEEKS }, (_, i) => {
    const start = new Date(thisWeek.getFullYear(), thisWeek.getMonth(), thisWeek.getDate() - 7 * (SPEED_WEEKS - 1 - i));
    return { weekStart: start, samples: { pin: [] as number[], type: [] as number[], choice: [] as number[] }, km: [] as number[] };
  });
  const weekIndex = new Map(weeks.map((week, i) => [dayKey(week.weekStart), i]));
  for (const review of reviews) {
    if (!review.firstAttempt) continue;
    const week = weeks[weekIndex.get(dayKey(startOfWeek(review.at))) ?? -1];
    if (!week) continue;
    if (review.correct && !review.usedHint) week.samples[review.mode].push(review.responseMs);
    if (review.skill === 'locate-capital' && review.distanceKm !== undefined) week.km.push(review.distanceKm);
  }
  const speed = weeks.map((week) => ({
    weekStart: week.weekStart,
    medians: { pin: median(week.samples.pin), type: median(week.samples.type), choice: median(week.samples.choice) },
    capitalKm: median(week.km),
  }));

  // Révisions à venir.
  const upcoming = Array.from({ length: UPCOMING_DAYS }, (_, i) => ({
    day: new Date(today.getFullYear(), today.getMonth(), today.getDate() + i),
    count: 0,
  }));
  for (const record of cards.values()) {
    if (record.card.reps === 0) continue;
    const index = Math.max(0, Math.floor((startOfDay(record.card.dueAt).getTime() - today.getTime()) / DAY_MS + 0.5));
    if (index < UPCOMING_DAYS) upcoming[index]!.count += 1;
  }

  // Points faibles : cartes déjà vues, classées comme le contenu « Points faibles » du constructeur.
  const weak = [...cards.values()]
    .filter((record) => record.card.reps > 0 && masteryOf(record.card) !== 'mastered' && (world.byId.has(record.entityId) || world.cityById.has(record.entityId)))
    .sort((a, b) => weakness(b.card, now) - weakness(a.card, now))
    .slice(0, WEAK_COUNT)
    .map((record) => {
      const { entityId, skill } = parseCardKey(record.key);
      return { entityId, skill, exercise: exerciseOfSkill(skill), lapses: record.card.lapses, mastery: masteryOf(record.card) };
    });

  return {
    figures: {
      daysPlayed: days.size,
      answers: reviews.length,
      accuracy: recentTotal ? recentCorrect / recentTotal : null,
      acquired: totals.acquired,
      mastered: totals.mastered,
    },
    activity,
    masteryBySkill: skills.map((skill) => ({ skill, label: SKILL_LABELS[skill], counts: bySkill.get(skill)!, expert: trackOf(skill) === 'expert' })),
    masteryByContinent: (['europe', 'americas', 'africa', 'asia', 'oceania'] as ContinentId[]).map((id) => ({
      id,
      label: CONTINENT_LABELS[id],
      counts: byContinent.get(id) ?? emptyCounts(),
    })),
    speed,
    upcoming,
    weak,
  };
}
