// Défis : ce que l'interface appelle (tirer une série, enregistrer un résultat, signaler les
// nouveautés). Le module en ligne (remote.ts, avec Firebase) est chargé à la demande.
//
// Un résultat qui n'a pas pu partir (pas de réseau) est gardé ici et renvoyé plus tard.
import { useEffect, useState } from 'preact/hooks';
import type { WorldData } from '../data/world.ts';
import type { ExerciseId } from '../game/exercises.ts';
import { requestTitle } from '../game/plans.ts';
import type { SessionSummary } from '../game/session.ts';
import { shuffle } from '../game/selection.ts';
import { eligibleIds, type PreparedGame } from '../game/start.ts';
import type { Zone } from '../map/zones.ts';
import { connectedAccount, useSync } from '../sync/sync.ts';
import { newsCount, resultFromSummary, type SeenResults } from './summary.ts';
import { newChallengeId, type Challenge, type ChallengePlay, type ChallengeResult } from './types.ts';

const loadRemote = () => import('./remote.ts');

/** Une nouvelle série tirée au hasard dans la zone, à jouer pour lancer un défi. */
export function drawChallenge(
  world: WorldData,
  zone: Zone,
  exercise: ExerciseId,
  count: number | 'all',
  invite: string[] = [],
): ChallengePlay {
  const ids = shuffle(eligibleIds(world, exercise, zone));
  const picked = count === 'all' ? ids : ids.slice(0, count);
  return {
    id: newChallengeId(),
    role: 'create',
    title: requestTitle({ kind: 'builder', exercise, zone, count, content: 'mix' }),
    zoneId: zone.id,
    exercise,
    questions: picked.map((entityId) => ({ entityId, exercise })),
    invite,
  };
}

/** Relever un défi reçu : la même série, dans le même ordre. */
export const answerPlay = (challenge: Challenge): ChallengePlay => ({
  id: challenge.id,
  role: 'answer',
  title: challenge.title,
  zoneId: challenge.zoneId,
  exercise: challenge.exercise,
  questions: challenge.questions,
  invite: [],
});

// --- Résultats en attente d'envoi ------------------------------------------------------------

interface Pending {
  play: ChallengePlay;
  result: ChallengeResult;
}

const PENDING_KEY = 'geo-defis-en-attente';

function readPending(): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]') as Pending[];
  } catch {
    return [];
  }
}

function writePending(list: Pending[]): void {
  try {
    if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // Stockage refusé : tant pis, le résultat ne sera pas renvoyé.
  }
}

async function send({ play, result }: Pending): Promise<void> {
  const me = connectedAccount();
  if (!me) throw new Error('Pas de compte connecté.');
  const remote = await loadRemote();
  if (play.role === 'create') await remote.createChallenge(play, me, result, play.invite);
  else await remote.submitResult(play.id, me, result);
}

/** Renvoie les résultats restés en attente. */
export async function flushPending(): Promise<void> {
  const list = readPending();
  if (!list.length || !connectedAccount()) return;
  const left: Pending[] = [];
  for (const pending of list) {
    try {
      await send(pending);
    } catch (error) {
      console.error(error);
      left.push(pending);
    }
  }
  writePending(left);
}

/**
 * Enregistre le résultat d'une manche de défi (crée le défi, ou ajoute ma réponse).
 * Renvoie false s'il n'a pas pu partir : il est gardé et repartira au retour du réseau.
 */
export async function finishChallenge(play: ChallengePlay, summary: SessionSummary): Promise<boolean> {
  const pending: Pending = { play, result: resultFromSummary(summary) };
  try {
    await send(pending);
    return true;
  } catch (error) {
    console.error(error);
    writePending([...readPending().filter((p) => p.play.id !== play.id), pending]);
    return false;
  }
}

/** Lancer un défi avec la manche qu'on vient de jouer (une seule sorte d'exercice). */
export function playFromGame(game: PreparedGame): ChallengePlay | null {
  const exercises = new Set(game.questions.map((q) => q.exercise));
  if (game.challenge || exercises.size !== 1 || game.questions.length === 0) return null;
  return {
    id: newChallengeId(),
    role: 'create',
    title: game.title,
    zoneId: game.zone.id,
    exercise: game.questions[0]!.exercise,
    questions: game.questions,
    invite: [],
  };
}

// --- Nouveautés ------------------------------------------------------------------------------

const SEEN_KEY = 'geo-defis-vus';

export function readSeen(): SeenResults {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as SeenResults;
  } catch {
    return {};
  }
}

/** Retient que j'ai vu les résultats de ce défi (la pastille disparaît). */
export function markSeen(challenge: Challenge): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [challenge.id]: Object.keys(challenge.results).length }));
  } catch {
    // Sans stockage, la pastille reviendra : sans gravité.
  }
}

export async function loadMyChallenges(): Promise<Challenge[]> {
  const me = connectedAccount();
  if (!me) return [];
  await flushPending();
  return (await loadRemote()).listChallenges(me.uid);
}

/** Nombre de défis à signaler sur l'accueil (reçus à jouer, nouveaux résultats). */
export function useChallengeNews(): number {
  const sync = useSync();
  const [count, setCount] = useState(0);
  const connected = sync.phase === 'synced' || sync.phase === 'syncing';
  useEffect(() => {
    if (!connected) return undefined;
    let cancelled = false;
    const me = connectedAccount();
    loadMyChallenges()
      .then((list) => {
        if (!cancelled && me) setCount(newsCount(list, me.uid, readSeen()));
      })
      .catch((error: unknown) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [connected, sync.lastSyncAt]);
  return count;
}
