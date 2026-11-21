// Score d'un défi : la justesse d'abord, la rapidité ensuite (demande d'Arno, 21/11/2026).
// Seule la première réponse à chaque question compte, comme pour la mémoire.
// - juste du premier coup : 100 points, plus un bonus de rapidité de 0 à 50 points ;
// - juste avec un indice : 50 points, sans bonus ;
// - faux : 0 point.
// Le bonus est plein sous 2 s et tombe à zéro à un temps qui dépend de la façon de répondre
// (taper un nom prend plus longtemps que cliquer). Les deux joueurs ont les mêmes questions :
// le barème est le même pour tous.
import type { AnswerMode } from '../engine/grading.ts';

export const CHALLENGE_SCORING = {
  correctPoints: 100,
  hintPoints: 50,
  speedBonus: 50,
  /** En dessous : bonus plein. */
  fastMs: 2000,
  /** Au-delà : plus de bonus. */
  slowMs: { pin: 12_000, choice: 10_000, type: 15_000 } satisfies Record<AnswerMode, number>,
};

/** Première réponse à une question du défi. */
export interface ChallengeAnswer {
  correct: boolean;
  usedHint: boolean;
  responseMs: number;
  mode: AnswerMode;
  /** Écart au but (km), pour les exercices où l'on place sur la carte. */
  distanceKm?: number;
}

export interface ChallengeScore {
  score: number;
  /** Score maximal possible (tout juste, instantanément). */
  maxScore: number;
  correct: number;
  total: number;
  /** Somme des temps de première réponse (ms). */
  timeMs: number;
  /** Écart médian au but (km) quand l'exercice place des capitales, sinon null. */
  medianKm: number | null;
}

/** Points d'une réponse. */
export function answerPoints(answer: ChallengeAnswer, scoring = CHALLENGE_SCORING): number {
  if (!answer.correct) return 0;
  if (answer.usedHint) return scoring.hintPoints;
  const slow = scoring.slowMs[answer.mode];
  const share = Math.min(1, Math.max(0, (slow - answer.responseMs) / (slow - scoring.fastMs)));
  return scoring.correctPoints + Math.round(scoring.speedBonus * share);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function scoreChallenge(answers: ChallengeAnswer[], scoring = CHALLENGE_SCORING): ChallengeScore {
  const distances = answers.map((a) => a.distanceKm).filter((d): d is number => d !== undefined && Number.isFinite(d));
  return {
    score: answers.reduce((sum, answer) => sum + answerPoints(answer, scoring), 0),
    maxScore: answers.length * (scoring.correctPoints + scoring.speedBonus),
    correct: answers.filter((a) => a.correct).length,
    total: answers.length,
    timeMs: Math.round(answers.reduce((sum, a) => sum + a.responseMs, 0)),
    medianKm: median(distances),
  };
}

/**
 * Classement : le score, puis (à égalité) le temps le plus court.
 * Renvoie un nombre négatif si `a` est devant `b`.
 */
export const compareScores = (a: Pick<ChallengeScore, 'score' | 'timeMs'>, b: Pick<ChallengeScore, 'score' | 'timeMs'>) =>
  b.score - a.score || a.timeMs - b.timeMs;
