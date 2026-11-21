// Défis entre amis : je joue une série de questions, je l'envoie (lien ou directement à un ami),
// l'autre joue exactement la même série, et on compare (score : voir scoring.ts).
//
// Le défi est stocké en ligne (challenges/{id}) ; le lien partagé ne contient que son identifiant.
// Les « amis » ne sont pas une liste à part : ce sont les personnes croisées dans mes défis.
import type { ExerciseId } from '../game/exercises.ts';
import type { QuestionRef } from '../game/questions.ts';
import type { ChallengeScore } from './scoring.ts';

/** Une manche jouée pour un défi. */
export interface ChallengePlay {
  id: string;
  /** « create » : je lance le défi (il est enregistré en ligne à la fin, avec mon résultat) ; « answer » : je le relève. */
  role: 'create' | 'answer';
  title: string;
  zoneId: string;
  exercise: ExerciseId;
  questions: QuestionRef[];
  /** Amis à qui l'envoyer directement dès la fin (revanche, « Défier Maria »). */
  invite: string[];
}

/** Le résultat d'un joueur. */
export interface ChallengeResult extends ChallengeScore {
  /** Détail par question, dans l'ordre : [juste (1/0), temps (ms), indice (1/0), écart (km) ou null]. */
  answers: Array<[number, number, number, number | null]>;
  playedAt: number;
}

export interface Challenge {
  id: string;
  creator: string;
  title: string;
  zoneId: string;
  exercise: ExerciseId;
  questions: QuestionRef[];
  createdAt: number;
  /** Tous ceux qui ont joué ou à qui le défi a été envoyé. */
  participants: string[];
  /** Ceux à qui le défi a été envoyé directement. */
  invited: string[];
  /** Prénom de chaque joueur (écrit par lui-même). */
  names: Record<string, string>;
  results: Record<string, ChallengeResult>;
}

/** Identifiant court et difficile à deviner (le lien suffit pour ouvrir le défi). */
export function newChallengeId(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

/** Adresse du défi, à partager. */
export function challengeUrl(id: string): string {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.searchParams.set('defi', id);
  return url.toString();
}
