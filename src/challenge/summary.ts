// Lecture des défis, sans affichage : résultat d'une manche, état d'un défi, classement,
// amis et bilan des face-à-face, nouveautés à signaler.
import type { SessionSummary } from '../game/session.ts';
import { compareScores, scoreChallenge } from './scoring.ts';
import type { Challenge, ChallengeResult } from './types.ts';

/** Résultat d'un défi à partir du bilan de la manche. */
export function resultFromSummary(summary: SessionSummary, now = Date.now()): ChallengeResult {
  const answers = summary.firstAnswers.map((entry) => ({
    correct: entry.correct,
    usedHint: entry.usedHint ?? false,
    responseMs: entry.responseMs,
    mode: entry.mode ?? 'pin',
    ...(entry.distanceKm !== undefined && { distanceKm: entry.distanceKm }),
  }));
  return {
    ...scoreChallenge(answers),
    answers: answers.map((a) => [
      a.correct ? 1 : 0,
      Math.round(a.responseMs),
      a.usedHint ? 1 : 0,
      a.distanceKm !== undefined && Number.isFinite(a.distanceKm) ? Math.round(a.distanceKm) : null,
    ]),
    playedAt: now,
  };
}

export type ChallengeStatus =
  /** On m'a envoyé ce défi et je ne l'ai pas encore joué. */
  | 'to-play'
  /** J'ai joué ; personne d'autre pour l'instant. */
  | 'waiting'
  /** Au moins deux joueurs : on peut comparer. */
  | 'done';

export function challengeStatus(challenge: Challenge, uid: string): ChallengeStatus {
  if (!challenge.results[uid]) return 'to-play';
  return Object.keys(challenge.results).length >= 2 ? 'done' : 'waiting';
}

export interface Ranked {
  uid: string;
  name: string;
  result: ChallengeResult;
  rank: number;
}

/** Classement des joueurs d'un défi (ex æquo : même rang). */
export function ranking(challenge: Challenge, names: ReadonlyMap<string, string> = new Map()): Ranked[] {
  const sorted = Object.entries(challenge.results)
    .map(([uid, result]) => ({ uid, name: challenge.names[uid] ?? names.get(uid) ?? 'Un ami', result }))
    .sort((a, b) => compareScores(a.result, b.result));
  return sorted.map((entry, i) => {
    let rank = i + 1;
    while (rank > 1 && compareScores(sorted[rank - 2]!.result, entry.result) === 0) rank -= 1;
    return { ...entry, rank };
  });
}

export interface Friend {
  uid: string;
  name: string;
  /** Face-à-face terminés : mes victoires, ses victoires, égalités. */
  wins: number;
  losses: number;
  draws: number;
  /** Dernier défi partagé (ms). */
  lastAt: number;
}

/** Les personnes croisées dans mes défis, la plus récente d'abord, avec le bilan de nos face-à-face. */
export function friendsFrom(challenges: Challenge[], uid: string): Friend[] {
  const friends = new Map<string, Friend>();
  for (const challenge of challenges) {
    for (const other of challenge.participants) {
      if (other === uid) continue;
      const friend = friends.get(other) ?? { uid: other, name: '', wins: 0, losses: 0, draws: 0, lastAt: 0 };
      friend.name ||= challenge.names[other] ?? '';
      friend.lastAt = Math.max(friend.lastAt, challenge.createdAt);
      const mine = challenge.results[uid];
      const theirs = challenge.results[other];
      if (mine && theirs) {
        const order = compareScores(mine, theirs);
        if (order < 0) friend.wins += 1;
        else if (order > 0) friend.losses += 1;
        else friend.draws += 1;
      }
      friends.set(other, friend);
    }
  }
  return [...friends.values()].map((f) => ({ ...f, name: f.name || 'Un ami' })).sort((a, b) => b.lastAt - a.lastAt);
}

/** Ce que j'ai déjà vu de chaque défi : nombre de résultats (pour signaler les nouveautés). */
export type SeenResults = Record<string, number>;

/** Défis à signaler : reçus et pas encore joués, ou avec un nouveau résultat depuis ma dernière visite. */
export function newsCount(challenges: Challenge[], uid: string, seen: SeenResults): number {
  return challenges.filter((challenge) => {
    if (!challenge.results[uid]) return challenge.creator !== uid;
    return Object.keys(challenge.results).length > (seen[challenge.id] ?? 1);
  }).length;
}
