import { describe, expect, it } from 'vitest';
import { gradeAnswer, lengthWeight, median, recordTiming, type GradeInput } from './grading.ts';
import { ENGINE_SETTINGS } from './settings.ts';

/** Médiane de référence : 3 s. */
const stats = { samples: Array.from({ length: 10 }, () => 3000) };
const answer = (overrides: Partial<GradeInput>): GradeInput => ({
  correct: true,
  responseMs: 3000,
  usedHint: false,
  mode: 'pin',
  stats,
  ...overrides,
});

describe('gradeAnswer', () => {
  it('note « À revoir » une réponse fausse', () => {
    expect(gradeAnswer(answer({ correct: false }))).toMatchObject({ grade: 'again', reason: 'wrong' });
  });

  it('note « Correct » une réponse juste en temps normal', () => {
    expect(gradeAnswer(answer({ responseMs: 3500 }))).toMatchObject({ grade: 'good', reason: 'normal' });
  });

  it('note « Facile » une réponse juste et rapide (< 0,6 × médiane)', () => {
    expect(gradeAnswer(answer({ responseMs: 1500 }))).toMatchObject({ grade: 'easy', reason: 'fast' });
  });

  it('note « Difficile », jamais « À revoir », une réponse juste mais lente (> 2 × médiane)', () => {
    expect(gradeAnswer(answer({ responseMs: 7000 }))).toMatchObject({ grade: 'hard', reason: 'slow' });
  });

  it('note « Difficile » une réponse juste avec indice, même rapide', () => {
    expect(gradeAnswer(answer({ responseMs: 1000, usedHint: true }))).toMatchObject({ grade: 'hard', reason: 'hint' });
  });

  it('ignore un temps aberrant (> 3 × médiane) : seule la justesse compte', () => {
    const result = gradeAnswer(answer({ responseMs: 10_000 }));
    expect(result).toMatchObject({ grade: 'good', reason: 'outlier', countsForTiming: false });
  });

  it('ignore toujours un temps de plus de 30 s', () => {
    const result = gradeAnswer(answer({ responseMs: 31_000, stats: { samples: [] } }));
    expect(result).toMatchObject({ grade: 'good', reason: 'outlier', countsForTiming: false });
  });

  it('ne juge pas la vitesse tant qu’il y a trop peu de mesures', () => {
    const result = gradeAnswer(answer({ responseMs: 500, stats: { samples: [3000, 3000] } }));
    expect(result).toMatchObject({ grade: 'good', reason: 'no-timing', countsForTiming: true });
  });

  it('ne compte dans les statistiques que les réponses justes, sans indice', () => {
    expect(gradeAnswer(answer({})).countsForTiming).toBe(true);
    expect(gradeAnswer(answer({ correct: false })).countsForTiming).toBe(false);
    expect(gradeAnswer(answer({ usedHint: true })).countsForTiming).toBe(false);
  });

  it('corrige le temps de saisie selon la longueur du nom', () => {
    // 6,5 s pour taper « Ouagadougou » (11 lettres) : normal, alors que 6,5 / 3 > 2.
    expect(gradeAnswer(answer({ mode: 'type', answerLength: 11, responseMs: 6500 })).grade).toBe('good');
    // 4,8 s pour taper « Lima » (4 lettres) : lent.
    expect(gradeAnswer(answer({ mode: 'type', answerLength: 4, responseMs: 4800 })).grade).toBe('hard');
  });
});

describe('lengthWeight', () => {
  it('vaut 1 hors saisie et pour un nom de longueur de référence', () => {
    expect(lengthWeight('pin', 20)).toBe(1);
    expect(lengthWeight('type', ENGINE_SETTINGS.grading.lengthReference)).toBe(1);
    expect(lengthWeight('type', 4)).toBeCloseTo(0.75);
  });
});

describe('median et recordTiming', () => {
  it('calcule la médiane', () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('ne garde que les mesures les plus récentes', () => {
    let current = { samples: [] as number[] };
    for (let i = 0; i < ENGINE_SETTINGS.grading.maxSamples + 10; i++) current = recordTiming(current, i);
    expect(current.samples).toHaveLength(ENGINE_SETTINGS.grading.maxSamples);
    expect(current.samples.at(-1)).toBe(ENGINE_SETTINGS.grading.maxSamples + 9);
  });
});
