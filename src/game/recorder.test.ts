import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { getCard, getReviewsForCard, getTiming, openGeoDb, putCard } from '../storage/db.ts';
import { makeCard, testSrs, uniqueDbName } from '../storage/fixtures.test-utils.ts';
import { AnswerRecorder } from './recorder.ts';

const now = new Date('2026-11-18T09:00:00Z');

describe('AnswerRecorder', () => {
  it('met à jour FSRS et le journal à la première réponse', async () => {
    const db = await openGeoDb(uniqueDbName());
    const recorder = await AnswerRecorder.create(db, await testSrs(), 'desktop', 's1');
    const result = recorder.record(
      { entityId: 'fr', skill: 'locate-country', mode: 'pin', correct: true, responseMs: 2000, usedHint: false, firstAttempt: true },
      now,
    );
    expect(result.grade).toMatchObject({ grade: 'good', reason: 'no-timing' });
    expect(result.masteryBefore).toBe('new');
    await recorder.flush();
    const stored = await getCard(db, 'fr:locate-country');
    expect(stored?.card.reps).toBe(1);
    expect(await getTiming(db, 'desktop', 'pin')).toEqual({ samples: [2000] });
    const [review] = await getReviewsForCard(db, 'fr:locate-country');
    expect(review).toMatchObject({ correct: true, grade: 'good', sessionId: 's1', firstAttempt: true });
  });

  it('n’avance pas FSRS lors d’un nouvel essai dans la manche', async () => {
    const db = await openGeoDb(uniqueDbName());
    const recorder = await AnswerRecorder.create(db, await testSrs(), 'desktop', 's2');
    recorder.record({ entityId: 'pe', skill: 'name-capital', mode: 'type', correct: false, responseMs: 5000, usedHint: false, firstAttempt: true }, now);
    const retry = recorder.record(
      { entityId: 'pe', skill: 'name-capital', mode: 'type', correct: true, responseMs: 1500, usedHint: false, firstAttempt: false, typed: 'Lima' },
      now,
    );
    expect(retry.grade).toBeNull();
    await recorder.flush();
    expect((await getCard(db, 'pe:name-capital'))?.card.reps).toBe(1);
    const reviews = await getReviewsForCard(db, 'pe:name-capital');
    expect(reviews.map((r) => [r.correct, r.grade])).toEqual([
      [false, 'again'],
      [true, null],
    ]);
    // Une réponse fausse ne compte pas dans les temps de référence.
    expect(await getTiming(db, 'desktop', 'type')).toEqual({ samples: [] });
  });

  it('repart des cartes déjà enregistrées', async () => {
    const db = await openGeoDb(uniqueDbName());
    await putCard(db, await makeCard('jp', 'flag', new Date('2026-09-01T00:00:00Z'), 'easy'));
    const recorder = await AnswerRecorder.create(db, await testSrs(), 'mobile', 's3');
    const result = recorder.record({ entityId: 'jp', skill: 'flag', mode: 'choice', correct: true, responseMs: 900, usedHint: true, firstAttempt: true }, now);
    expect(result.masteryBefore).not.toBe('new');
    expect(result.grade).toMatchObject({ grade: 'hard', reason: 'hint' });
    await recorder.flush();
    expect((await getCard(db, 'jp:flag'))?.card.reps).toBe(2);
  });
});
