import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { buildWorldData, countries } from '../data/world.ts';
import type { Skill } from '../engine/srs.ts';
import { makeReview } from '../storage/fixtures.test-utils.ts';
import type { CardRecord, ReviewRecord } from '../storage/schema.ts';
import { ACTIVITY_DAYS, buildProgressStats, startOfWeek, UPCOMING_DAYS } from './stats.ts';

const topology = JSON.parse(readFileSync(join(import.meta.dirname, '../../data/world/world.topo.json'), 'utf8'));
const world = buildWorldData(topology, countries);
const now = new Date(2026, 10, 19, 15, 0); // jeudi 19 novembre 2026, 15 h (heure locale)

function card(entityId: string, skill: Skill, dueAt: Date, stability = 10, lapses = 0): [string, CardRecord] {
  const key = `${entityId}:${skill}`;
  return [
    key,
    {
      key,
      entityId,
      skill,
      card: {
        state: State.Review,
        reps: 2,
        lapses,
        difficulty: 5,
        stability,
        dueAt,
        lastReviewAt: new Date(2026, 10, 1),
      } as CardRecord['card'],
    },
  ];
}

const review = (key: string, at: Date, correct = true, patch: Partial<ReviewRecord> = {}): ReviewRecord => ({
  ...makeReview(key, at, correct),
  ...patch,
});

describe('startOfWeek', () => {
  it('commence la semaine le lundi', () => {
    expect(startOfWeek(now)).toEqual(new Date(2026, 10, 16));
    expect(startOfWeek(new Date(2026, 10, 22, 23, 0))).toEqual(new Date(2026, 10, 16));
  });
});

describe('buildProgressStats', () => {
  it('compte l’activité jour par jour (premières réponses seulement) et la précision', () => {
    const reviews = [
      review('fr:flag', new Date(2026, 10, 19, 9)),
      review('de:flag', new Date(2026, 10, 19, 10), false),
      review('de:flag', new Date(2026, 10, 19, 10, 1), true, { firstAttempt: false }),
      review('it:flag', new Date(2026, 10, 18, 9)),
      review('es:flag', new Date(2026, 8, 1, 9)), // hors des 30 jours
    ];
    const stats = buildProgressStats(world, new Map(), reviews, now);
    expect(stats.activity).toHaveLength(ACTIVITY_DAYS);
    expect(stats.activity.at(-1)).toMatchObject({ day: new Date(2026, 10, 19), correct: 1, wrong: 1 });
    expect(stats.activity.at(-2)).toMatchObject({ correct: 1, wrong: 0 });
    expect(stats.figures).toMatchObject({ daysPlayed: 3, answers: 5 });
    expect(stats.figures.accuracy).toBeCloseTo(2 / 3);
  });

  it('range la maîtrise par compétence et par continent', () => {
    const cards = new Map([card('fr', 'flag', new Date(2026, 11, 20), 45), card('jp', 'flag', new Date(2026, 11, 20), 10)]);
    const stats = buildProgressStats(world, cards, [], now);
    const flag = stats.masteryBySkill.find((entry) => entry.skill === 'flag')!;
    expect(flag.counts).toMatchObject({ mastered: 1, acquired: 1 });
    expect(flag.counts.total).toBeGreaterThan(200);
    expect(stats.masteryByContinent.find((c) => c.id === 'europe')!.counts.mastered).toBe(1);
    expect(stats.figures).toMatchObject({ acquired: 1, mastered: 1 });
  });

  it('calcule le temps médian par semaine et l’écart médian des capitales placées', () => {
    const reviews = [
      review('fr:locate-country', new Date(2026, 10, 17), true, { responseMs: 2000 }),
      review('de:locate-country', new Date(2026, 10, 18), true, { responseMs: 4000 }),
      review('it:locate-country', new Date(2026, 10, 18), true, { responseMs: 9000, usedHint: true }), // avec indice : ignoré
      review('pe:locate-capital', new Date(2026, 10, 18), true, { distanceKm: 40 }),
      review('cl:locate-capital', new Date(2026, 10, 18), false, { distanceKm: 400, skill: 'locate-capital' }),
    ];
    const week = buildProgressStats(world, new Map(), reviews, now).speed.at(-1)!;
    expect(week.weekStart).toEqual(new Date(2026, 10, 16));
    expect(week.medians.pin).toBe(2500);
    expect(week.medians.type).toBeNull();
    expect(week.capitalKm).toBe(220);
  });

  it('prévoit les révisions des prochains jours, les retards comptant pour aujourd’hui', () => {
    const cards = new Map([
      card('fr', 'flag', new Date(2026, 10, 10)), // en retard
      card('de', 'flag', new Date(2026, 10, 19, 20)),
      card('it', 'flag', new Date(2026, 10, 21, 8)),
      card('es', 'flag', new Date(2026, 11, 30)), // trop loin
    ]);
    const { upcoming } = buildProgressStats(world, cards, [], now);
    expect(upcoming).toHaveLength(UPCOMING_DAYS);
    expect(upcoming.map((entry) => entry.count)).toEqual([2, 0, 1, 0, 0, 0, 0]);
  });

  it('liste les points faibles, les plus fragiles d’abord, sans les éléments maîtrisés', () => {
    const cards = new Map([
      card('fr', 'flag', new Date(2026, 11, 1), 2, 3),
      card('de', 'name-capital', new Date(2026, 11, 1), 5, 1),
      card('it', 'flag', new Date(2026, 11, 1), 60, 4), // maîtrisé malgré tout
    ]);
    const { weak } = buildProgressStats(world, cards, [], now);
    expect(weak.map((entry) => entry.entityId)).toEqual(['fr', 'de']);
    expect(weak[0]).toMatchObject({ skill: 'flag', exercise: 'flag-to-country', lapses: 3 });
  });
});
