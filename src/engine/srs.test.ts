import { State } from 'ts-fsrs';
import { beforeAll, describe, expect, it } from 'vitest';
import { ENGINE_SETTINGS } from './settings.ts';
import { cardKey, createSrs, isDue, masteryOf, parseCardKey, type Srs } from './srs.ts';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-18T09:00:00Z');
const daysFrom = (date: Date, end: Date) => (end.getTime() - date.getTime()) / DAY;

let srs: Srs;
beforeAll(async () => {
  // Sans variation aléatoire, pour des résultats reproductibles.
  srs = await createSrs({ ...ENGINE_SETTINGS.srs, enableFuzz: false });
});

describe('clés de cartes', () => {
  it('associent un élément et une compétence', () => {
    expect(cardKey('fr', 'name-capital')).toBe('fr:name-capital');
    expect(parseCardKey('cyn:locate-country')).toEqual({ entityId: 'cyn', skill: 'locate-country' });
  });
});

describe('FSRS', () => {
  it('crée des cartes neuves, ni dues ni acquises', () => {
    const card = srs.newCard(now);
    expect(masteryOf(card)).toBe('new');
    expect(isDue(card, now)).toBe(false);
    expect(srs.retrievability(card, now)).toBeNull();
  });

  it('espace beaucoup un élément déjà connu (réponse facile)', () => {
    const { card } = srs.review(srs.newCard(now), 'easy', now);
    expect(daysFrom(now, card.dueAt)).toBeGreaterThan(20);
    expect(masteryOf(card)).toBe('acquired');
  });

  it('fait revenir vite un élément oublié', () => {
    const { card } = srs.review(srs.newCard(now), 'again', now);
    expect(daysFrom(now, card.dueAt)).toBeLessThan(1);
    expect(masteryOf(card)).toBe('learning');
  });

  it('allonge l’intervalle à chaque réussite', () => {
    const first = srs.review(srs.newCard(now), 'good', now).card;
    const firstInterval = daysFrom(now, first.dueAt);
    const second = srs.review(first, 'good', first.dueAt).card;
    expect(daysFrom(first.dueAt, second.dueAt)).toBeGreaterThan(firstInterval);
  });

  it('rend une carte due à sa date de révision, avec ~90 % de chances de s’en souvenir', () => {
    const { card } = srs.review(srs.newCard(now), 'good', now);
    expect(isDue(card, now)).toBe(false);
    expect(isDue(card, card.dueAt)).toBe(true);
    expect(srs.retrievability(card, now)).toBeCloseTo(1, 1);
    expect(srs.retrievability(card, card.dueAt)!).toBeGreaterThan(0.85);
    expect(srs.retrievability(card, card.dueAt)!).toBeLessThan(0.95);
  });
});

describe('niveaux de maîtrise', () => {
  it('suivent la stabilité de la mémoire', () => {
    expect(masteryOf({ state: State.Review, stability: 3 })).toBe('learning');
    expect(masteryOf({ state: State.Review, stability: 10 })).toBe('acquired');
    expect(masteryOf({ state: State.Review, stability: 45 })).toBe('mastered');
    expect(masteryOf({ state: State.Relearning, stability: 45 })).toBe('learning');
  });
});
