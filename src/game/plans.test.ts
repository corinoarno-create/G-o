import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { buildWorldData, countries } from '../data/world.ts';
import type { Skill } from '../engine/srs.ts';
import type { CardRecord } from '../storage/schema.ts';
import { dueQuestions, planQuick, planReview, quickExercise, QUICK_SIZE, REVIEW_BATCH } from './plans.ts';

const topology = JSON.parse(readFileSync(join(import.meta.dirname, '../../data/world/world.topo.json'), 'utf8'));
const world = buildWorldData(topology, countries);
const now = new Date('2026-11-18T09:00:00Z');
const seeded = (seed = 7) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function card(entityId: string, skill: Skill, dueAt: string): [string, CardRecord] {
  const key = `${entityId}:${skill}`;
  return [
    key,
    {
      key,
      entityId,
      skill,
      card: { state: State.Review, reps: 2, lapses: 0, difficulty: 5, stability: 10, dueAt: new Date(dueAt), lastReviewAt: new Date('2026-11-01T00:00:00Z') } as CardRecord['card'],
    },
  ];
}

describe('dueQuestions', () => {
  it('liste les révisions dues, les plus en retard d’abord, avec le bon exercice', () => {
    const cards = new Map([
      card('fr', 'name-capital', '2026-11-17T00:00:00Z'),
      card('jp', 'flag', '2026-11-10T00:00:00Z'),
      card('pe', 'locate-country', '2026-12-01T00:00:00Z'), // pas due
      card('aq', 'name-capital', '2026-11-01T00:00:00Z'), // l'Antarctique n'a pas de capitale : ignoré
    ]);
    const due = dueQuestions(world, cards, now, () => 0);
    expect(due).toEqual([
      { entityId: 'jp', exercise: 'flag-to-country' },
      { entityId: 'fr', exercise: 'name-capital' },
    ]);
    expect(dueQuestions(world, cards, now, () => 0.99)[0]).toEqual({ entityId: 'jp', exercise: 'country-to-flag' });
  });
});

describe('planReview', () => {
  it('révise par séries de 50 au plus', () => {
    const cards = new Map(world.countries.slice(0, 80).map((c) => card(c.id, 'locate-country', '2026-11-01T00:00:00Z')));
    expect(planReview(world, cards, now, seeded())).toHaveLength(REVIEW_BATCH);
  });

  it('regroupe les questions par exercice, le bloc le plus fourni d’abord', () => {
    const cards = new Map([
      card('fr', 'name-capital', '2026-11-17T00:00:00Z'),
      card('jp', 'locate-country', '2026-11-10T00:00:00Z'),
      card('de', 'name-capital', '2026-11-12T00:00:00Z'),
      card('it', 'locate-country', '2026-11-11T00:00:00Z'),
      card('es', 'name-capital', '2026-11-13T00:00:00Z'),
    ]);
    const exercises = planReview(world, cards, now, seeded()).map((q) => q.exercise);
    expect(exercises).toEqual(['name-capital', 'name-capital', 'name-capital', 'locate-country', 'locate-country']);
  });
});

describe('planQuick', () => {
  it('propose 10 questions d’un seul exercice sur 10 pays différents, même sans aucune révision', () => {
    const questions = planQuick(world, new Map(), now, seeded());
    expect(questions).toHaveLength(QUICK_SIZE);
    expect(new Set(questions.map((q) => q.entityId)).size).toBe(QUICK_SIZE);
    expect(new Set(questions.map((q) => q.exercise)).size).toBe(1);
  });

  it('choisit l’exercice qui a le plus de révisions dues, et prend d’abord les éléments dus', () => {
    const cards = new Map([
      card('fr', 'name-capital', '2026-11-17T00:00:00Z'),
      card('de', 'name-capital', '2026-11-12T00:00:00Z'),
      card('jp', 'locate-country', '2026-11-10T00:00:00Z'),
    ]);
    expect(quickExercise(world, cards, now)).toBe('name-capital');
    const questions = planQuick(world, cards, now, seeded());
    expect(questions.every((q) => q.exercise === 'name-capital')).toBe(true);
    expect(questions).toContainEqual({ entityId: 'fr', exercise: 'name-capital' });
    expect(questions).toContainEqual({ entityId: 'de', exercise: 'name-capital' });
  });
});
