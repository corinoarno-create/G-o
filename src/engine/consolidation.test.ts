import { describe, expect, it } from 'vitest';
import {
  createConsolidation,
  currentItem,
  isFinished,
  progress,
  submitAnswer,
  type ConsolidationState,
} from './consolidation.ts';

/** Répond à la question en cours. */
const answer = (state: ConsolidationState, correct: boolean) => submitAnswer(state, correct, 3);

describe('boucle de consolidation', () => {
  it('pose chaque élément une fois quand tout est réussi', () => {
    let state = createConsolidation(['a', 'b', 'c', 'b']);
    expect(state.total).toBe(3);
    const asked: string[] = [];
    while (!isFinished(state)) {
      asked.push(currentItem(state)!);
      state = answer(state, true).state;
    }
    expect(asked).toEqual(['a', 'b', 'c']);
    expect(state.firstResult).toEqual({ a: true, b: true, c: true });
    expect(progress(state)).toEqual({ solved: 3, total: 3 });
  });

  it('fait revenir un élément raté trois questions plus tard', () => {
    const start = createConsolidation(['a', 'b', 'c', 'd', 'e', 'f']);
    const { state, outcome } = answer(start, false);
    expect(outcome).toEqual({ item: 'a', correct: false, firstAttempt: true, retryIn: 3 });
    expect(state.queue).toEqual(['b', 'c', 'd', 'a', 'e', 'f']);
  });

  it('ne termine la manche que quand tout est réussi', () => {
    let state = createConsolidation(['a', 'b']);
    state = answer(state, false).state; // a raté → revient en fin de file
    expect(state.queue).toEqual(['b', 'a']);
    state = answer(state, true).state; // b
    expect(isFinished(state)).toBe(false);
    const last = answer(state, false); // a raté encore : c'est le dernier, il revient tout de suite
    expect(last.outcome.retryIn).toBe(0);
    expect(currentItem(last.state)).toBe('a');
    const done = answer(last.state, true);
    expect(isFinished(done.state)).toBe(true);
    expect(done.state.attempts).toEqual({ a: 3, b: 1 });
  });

  it('garde le résultat de la première réponse pour FSRS', () => {
    let state = createConsolidation(['a', 'b', 'c', 'd']);
    state = answer(state, false).state; // a raté
    state = answer(state, true).state; // b
    state = answer(state, true).state; // c
    state = answer(state, true).state; // d
    const retry = answer(state, true); // a réussi au 2e essai
    expect(retry.outcome.firstAttempt).toBe(false);
    expect(retry.state.firstResult.a).toBe(false);
    expect(retry.state.solved).toEqual(['b', 'c', 'd', 'a']);
  });

  it('ne modifie pas l’état précédent', () => {
    const start = createConsolidation(['a', 'b']);
    answer(start, false);
    expect(start.queue).toEqual(['a', 'b']);
    expect(start.attempts).toEqual({});
  });

  it('refuse une réponse quand la manche est terminée', () => {
    const done = answer(createConsolidation(['a']), true).state;
    expect(() => answer(done, true)).toThrow();
  });
});
