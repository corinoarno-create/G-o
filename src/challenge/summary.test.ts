import { describe, expect, it } from 'vitest';
import type { SessionSummary } from '../game/session.ts';
import { challengeStatus, friendsFrom, newsCount, ranking, resultFromSummary } from './summary.ts';
import type { Challenge, ChallengeResult } from './types.ts';

const result = (score: number, timeMs: number): ChallengeResult => ({
  score,
  maxScore: 300,
  correct: 2,
  total: 2,
  timeMs,
  medianKm: null,
  answers: [],
  playedAt: 0,
});

const challenge = (patch: Partial<Challenge>): Challenge => ({
  id: 'c1',
  creator: 'arno',
  title: 'Capitales d’Afrique',
  zoneId: 'africa',
  exercise: 'locate-capital',
  questions: [],
  createdAt: 1000,
  participants: ['arno'],
  invited: [],
  names: { arno: 'Arno' },
  results: { arno: result(250, 20_000) },
  ...patch,
});

describe('resultFromSummary', () => {
  it('note les premières réponses de la manche', () => {
    const summary = {
      firstAnswers: [
        { exercise: 'locate-capital', entityId: 'pe', correct: true, firstAttempt: true, responseMs: 1500, mode: 'pin', usedHint: false, distanceKm: 42.4 },
        { exercise: 'locate-capital', entityId: 'cl', correct: false, firstAttempt: true, responseMs: 4000, mode: 'pin', usedHint: true },
      ],
    } as unknown as SessionSummary;
    const r = resultFromSummary(summary, 99);
    expect(r).toMatchObject({ score: 150, correct: 1, total: 2, timeMs: 5500, medianKm: 42.4, playedAt: 99 });
    expect(r.answers).toEqual([
      [1, 1500, 0, 42],
      [0, 4000, 1, null],
    ]);
  });
});

describe('challengeStatus', () => {
  it('distingue à jouer, en attente et terminé', () => {
    expect(challengeStatus(challenge({}), 'maria')).toBe('to-play');
    expect(challengeStatus(challenge({}), 'arno')).toBe('waiting');
    expect(challengeStatus(challenge({ results: { arno: result(1, 1), maria: result(2, 1) } }), 'arno')).toBe('done');
  });
});

describe('ranking', () => {
  it('classe par score puis par temps, avec les ex æquo au même rang', () => {
    const c = challenge({
      names: { arno: 'Arno', maria: 'María' },
      results: { arno: result(200, 30_000), maria: result(250, 40_000), zoe: result(200, 30_000) },
    });
    expect(ranking(c, new Map([['zoe', 'Zoé']])).map((r) => `${r.rank}:${r.name}`)).toEqual(['1:María', '2:Arno', '2:Zoé']);
  });
});

describe('friendsFrom', () => {
  it('trouve mes amis dans mes défis et compte nos victoires', () => {
    const challenges = [
      challenge({ id: 'a', participants: ['arno', 'maria'], names: { arno: 'Arno', maria: 'María' }, results: { arno: result(300, 1), maria: result(200, 1) } }),
      challenge({ id: 'b', createdAt: 5000, creator: 'maria', participants: ['maria', 'arno'], names: { maria: 'María' }, results: { maria: result(300, 1) } }),
      challenge({ id: 'c', participants: ['arno', 'maria'], results: { arno: result(100, 1), maria: result(100, 1) } }),
    ];
    expect(friendsFrom(challenges, 'arno')).toEqual([{ uid: 'maria', name: 'María', wins: 1, losses: 0, draws: 1, lastAt: 5000 }]);
  });
});

describe('newsCount', () => {
  it('signale les défis reçus à jouer et les nouveaux résultats', () => {
    const challenges = [
      challenge({ id: 'mine-waiting' }),
      challenge({ id: 'mine-answered', results: { arno: result(1, 1), maria: result(2, 1) } }),
      challenge({ id: 'received', creator: 'maria', results: { maria: result(1, 1) } }),
    ];
    expect(newsCount(challenges, 'arno', {})).toBe(2);
    expect(newsCount(challenges, 'arno', { 'mine-answered': 2 })).toBe(1);
  });
});
