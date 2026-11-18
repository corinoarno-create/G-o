import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import type { CardRecord } from '../storage/schema.ts';
import { availableFor, contentCounts, selectItems, shuffle, weakness } from './selection.ts';

const now = new Date('2026-11-18T09:00:00Z');
/** Générateur pseudo-aléatoire reproductible. */
const seeded = (seed = 42) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const card = (id: string, dueAt: string, extra: Partial<CardRecord['card']> = {}): [string, CardRecord] => [
  `${id}:flag`,
  {
    key: `${id}:flag`,
    entityId: id,
    skill: 'flag',
    card: {
      state: State.Review,
      reps: 1,
      lapses: 0,
      difficulty: 5,
      stability: 10,
      lastReviewAt: new Date('2026-11-01T00:00:00Z'),
      dueAt: new Date(dueAt),
      ...extra,
    } as CardRecord['card'],
  },
];

const cards = new Map([
  card('a', '2026-11-10T00:00:00Z'), // due depuis 8 jours
  card('b', '2026-11-17T00:00:00Z', { lapses: 3, difficulty: 9 }), // due depuis 1 jour, souvent oubliée
  card('c', '2026-12-30T00:00:00Z'), // pas due
]);
const eligible = ['a', 'b', 'c', 'd', 'e']; // d et e : jamais vus

describe('selectItems', () => {
  const pick = (content: 'due' | 'new' | 'mix' | 'weak', count: number | 'all' = 'all') =>
    selectItems(eligible, 'flag', cards, { content, count }, now, seeded()).sort();

  it('« À réviser » ne prend que les révisions dues', () => {
    expect(pick('due')).toEqual(['a', 'b']);
  });

  it('« Nouveaux » ne prend que des éléments jamais vus', () => {
    expect(pick('new')).toEqual(['d', 'e']);
  });

  it('« Points faibles » prend les éléments vus, les plus fragiles d’abord', () => {
    expect(pick('weak')).toEqual(['a', 'b', 'c']);
    expect(selectItems(eligible, 'flag', cards, { content: 'weak', count: 1 }, now, seeded())).toEqual(['b']);
  });

  it('« Mélange » prend d’abord les révisions dues, puis des nouveautés', () => {
    const three = selectItems(eligible, 'flag', cards, { content: 'mix', count: 3 }, now, seeded());
    expect(three).toContain('a');
    expect(three).toContain('b');
    expect(three).not.toContain('c');
    expect(pick('mix')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('contentCounts', () => {
  it('compte les éléments disponibles pour chaque type de contenu', () => {
    const counts = contentCounts(eligible, 'flag', cards, now);
    expect(counts).toEqual({ total: 5, due: 2, fresh: 2, seen: 3 });
    expect(availableFor('due', counts)).toBe(2);
    expect(availableFor('new', counts)).toBe(2);
    expect(availableFor('weak', counts)).toBe(3);
    expect(availableFor('mix', counts)).toBe(5);
  });
});

describe('weakness', () => {
  it('augmente avec les oublis, la difficulté et le temps écoulé', () => {
    const base = { lapses: 0, difficulty: 5, stability: 10, lastReviewAt: now };
    expect(weakness({ ...base, lapses: 2 }, now)).toBeGreaterThan(weakness(base, now));
    expect(weakness({ ...base, difficulty: 9 }, now)).toBeGreaterThan(weakness(base, now));
    expect(weakness({ ...base, lastReviewAt: new Date('2026-09-01T00:00:00Z') }, now)).toBeGreaterThan(weakness(base, now));
  });
});

describe('shuffle', () => {
  it('garde tous les éléments sans modifier l’original', () => {
    const items = [1, 2, 3, 4, 5];
    expect(shuffle(items, seeded()).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });
});
