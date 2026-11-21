import { describe, expect, it } from 'vitest';
import { answerPoints, compareScores, scoreChallenge, type ChallengeAnswer } from './scoring.ts';

const answer = (patch: Partial<ChallengeAnswer> = {}): ChallengeAnswer => ({
  correct: true,
  usedHint: false,
  responseMs: 2000,
  mode: 'pin',
  ...patch,
});

describe('answerPoints', () => {
  it('donne 150 points à une réponse juste et rapide, 100 à une juste mais lente', () => {
    expect(answerPoints(answer({ responseMs: 800 }))).toBe(150);
    expect(answerPoints(answer({ responseMs: 2000 }))).toBe(150);
    expect(answerPoints(answer({ responseMs: 7000 }))).toBe(125);
    expect(answerPoints(answer({ responseMs: 12_000 }))).toBe(100);
    expect(answerPoints(answer({ responseMs: 60_000 }))).toBe(100);
  });

  it('laisse plus de temps pour taper que pour cliquer', () => {
    expect(answerPoints(answer({ mode: 'type', responseMs: 12_000 }))).toBeGreaterThan(answerPoints(answer({ responseMs: 12_000 })));
  });

  it('donne 50 points avec un indice, et rien pour une réponse fausse', () => {
    expect(answerPoints(answer({ usedHint: true, responseMs: 500 }))).toBe(50);
    expect(answerPoints(answer({ correct: false, responseMs: 500 }))).toBe(0);
  });
});

describe('scoreChallenge', () => {
  it('additionne les points, les bonnes réponses, les temps, et donne l’écart médian', () => {
    const result = scoreChallenge([
      answer({ responseMs: 1000, distanceKm: 40 }),
      answer({ correct: false, responseMs: 5000, distanceKm: 900 }),
      answer({ responseMs: 12_000, distanceKm: 100 }),
    ]);
    expect(result).toEqual({ score: 250, maxScore: 450, correct: 2, total: 3, timeMs: 18_000, medianKm: 100 });
  });

  it('n’a pas d’écart médian quand on ne place rien', () => {
    expect(scoreChallenge([answer({ mode: 'choice' })]).medianKm).toBeNull();
  });
});

describe('compareScores', () => {
  it('classe par score, puis par temps à égalité', () => {
    const ranked = [
      { name: 'lent', score: 900, timeMs: 60_000 },
      { name: 'fort', score: 1000, timeMs: 90_000 },
      { name: 'rapide', score: 900, timeMs: 40_000 },
    ].sort(compareScores);
    expect(ranked.map((r) => r.name)).toEqual(['fort', 'rapide', 'lent']);
  });
});
