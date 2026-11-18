// Note automatique (§ 5.2) : je ne m'auto-évalue jamais. La note FSRS se déduit de la justesse,
// du temps de réponse comparé à ma médiane (par appareil et par façon de répondre) et de l'indice.
//
// Le temps est un signal bruité, d'où les précautions :
// - tant qu'il y a trop peu de mesures, la vitesse est ignorée ;
// - un temps aberrant (distraction) est ignoré : seule la justesse compte ;
// - en saisie, le temps est corrigé selon la longueur du nom ;
// - une réponse juste n'est jamais notée « À revoir », au pire « Difficile ».
import { ENGINE_SETTINGS } from './settings.ts';

/** Note FSRS : À revoir, Difficile, Correct, Facile. */
export type Grade = 'again' | 'hard' | 'good' | 'easy';

/** Façon de répondre, qui détermine la médiane de référence : clic sur la carte, saisie, choix multiple. */
export type AnswerMode = 'pin' | 'type' | 'choice';

export type Device = 'desktop' | 'mobile';

/** Mesures de temps récentes (en ms, déjà corrigées de la longueur) pour un couple appareil × façon de répondre. */
export interface TimingStats {
  samples: number[];
}

/** Clé de rangement des statistiques de temps. */
export const timingKey = (device: Device, mode: AnswerMode) => `${device}:${mode}`;

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

/** Poids de longueur d'un nom à taper (1 pour les autres façons de répondre). */
export function lengthWeight(mode: AnswerMode, answerLength = 0): number {
  if (mode !== 'type') return 1;
  const { lengthBase, lengthReference } = ENGINE_SETTINGS.grading;
  return (lengthBase + answerLength) / (lengthBase + lengthReference);
}

/** Ajoute une mesure en ne gardant que les plus récentes. */
export function recordTiming(stats: TimingStats, normalizedMs: number): TimingStats {
  const samples = [...stats.samples, Math.round(normalizedMs)];
  return { samples: samples.slice(-ENGINE_SETTINGS.grading.maxSamples) };
}

export interface GradeInput {
  correct: boolean;
  responseMs: number;
  usedHint: boolean;
  mode: AnswerMode;
  /** Longueur du nom attendu (lettres), pour la saisie. */
  answerLength?: number;
  /** Mes temps de référence pour cet appareil et cette façon de répondre. */
  stats: TimingStats;
}

export type GradeReason =
  | 'wrong' // faux ou hors tolérance
  | 'hint' // juste avec indice
  | 'slow' // juste mais lent
  | 'normal' // juste, temps normal
  | 'fast' // juste et rapide
  | 'no-timing' // juste, pas encore assez de mesures pour juger la vitesse
  | 'outlier'; // juste, temps aberrant ignoré

export interface GradeResult {
  grade: Grade;
  reason: GradeReason;
  /** Temps corrigé de la longueur (ms). */
  normalizedMs: number;
  /** Faut-il ajouter ce temps aux statistiques ? (réponse juste, sans indice, temps plausible) */
  countsForTiming: boolean;
}

export function gradeAnswer(input: GradeInput): GradeResult {
  const settings = ENGINE_SETTINGS.grading;
  const normalizedMs = input.responseMs / lengthWeight(input.mode, input.answerLength);
  const reference = input.stats.samples.length >= settings.minSamples ? median(input.stats.samples) : null;
  const outlier =
    input.responseMs > settings.outlierMaxMs || (reference !== null && normalizedMs > settings.outlierFactor * reference);
  const result = (grade: Grade, reason: GradeReason): GradeResult => ({
    grade,
    reason,
    normalizedMs,
    countsForTiming: input.correct && !input.usedHint && !outlier,
  });

  if (!input.correct) return result('again', 'wrong');
  if (input.usedHint) return result('hard', 'hint');
  if (outlier) return result('good', 'outlier');
  if (reference === null) return result('good', 'no-timing');
  const ratio = normalizedMs / reference;
  if (ratio > settings.slowFactor) return result('hard', 'slow');
  if (ratio < settings.fastFactor) return result('easy', 'fast');
  return result('good', 'normal');
}
