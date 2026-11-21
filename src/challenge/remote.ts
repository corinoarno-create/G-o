// Défis en ligne (Firestore « lite »). Chargé à la demande, comme la synchronisation.
//
// Un défi = un document challenges/{id}. Chaque joueur n'y écrit que sa propre case
// (résultat, prénom, participation) ; le créateur peut en plus y inviter des amis.
// Les règles de sécurité (firestore.rules) le garantissent côté serveur.
import {
  arrayUnion,
  collection,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore/lite';
import { onlineDb } from '../sync/firebase.ts';
import type { Challenge, ChallengeResult } from './types.ts';

const challengeRef = (id: string) => doc(onlineDb(), 'challenges', id);

function fromData(id: string, data: Record<string, unknown>): Challenge | null {
  try {
    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now();
    const results: Record<string, ChallengeResult> = {};
    for (const [uid, value] of Object.entries((data.results ?? {}) as Record<string, { text?: string }>)) {
      if (typeof value?.text === 'string') results[uid] = JSON.parse(value.text) as ChallengeResult;
    }
    return {
      id,
      creator: String(data.creator),
      title: String(data.title),
      zoneId: String(data.zoneId),
      exercise: data.exercise as Challenge['exercise'],
      questions: JSON.parse(String(data.questions)) as Challenge['questions'],
      createdAt,
      participants: (data.participants as string[]) ?? [],
      invited: (data.invited as string[]) ?? [],
      names: (data.names as Record<string, string>) ?? {},
      results,
    };
  } catch (error) {
    console.error('Défi illisible', id, error);
    return null;
  }
}

/** Enregistre un défi que je viens de jouer, avec mon résultat. */
export async function createChallenge(
  challenge: Pick<Challenge, 'id' | 'title' | 'zoneId' | 'exercise' | 'questions'>,
  me: { uid: string; firstName: string },
  result: ChallengeResult,
  invite: string[] = [],
): Promise<void> {
  await setDoc(challengeRef(challenge.id), {
    creator: me.uid,
    title: challenge.title,
    zoneId: challenge.zoneId,
    exercise: challenge.exercise,
    questions: JSON.stringify(challenge.questions),
    createdAt: serverTimestamp(),
    participants: [me.uid, ...invite.filter((uid) => uid !== me.uid)],
    invited: invite,
    names: { [me.uid]: me.firstName },
    results: { [me.uid]: { text: JSON.stringify(result) } },
  });
}

/** Envoie un défi que j'ai créé à un ami (il le verra dans « Mes défis »). */
export async function inviteToChallenge(id: string, friendUid: string): Promise<void> {
  await updateDoc(challengeRef(id), { participants: arrayUnion(friendUid), invited: arrayUnion(friendUid) });
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  const snapshot = await getDoc(challengeRef(id));
  return snapshot.exists() ? fromData(id, snapshot.data()) : null;
}

/** Enregistre mon résultat à un défi reçu. */
export async function submitResult(id: string, me: { uid: string; firstName: string }, result: ChallengeResult): Promise<void> {
  await updateDoc(
    challengeRef(id),
    new FieldPath('results', me.uid),
    { text: JSON.stringify(result) },
    new FieldPath('names', me.uid),
    me.firstName,
    'participants',
    arrayUnion(me.uid),
  );
}

/** Tous les défis où je figure (créés, reçus, relevés), du plus récent au plus ancien. */
export async function listChallenges(uid: string): Promise<Challenge[]> {
  const snapshot = await getDocs(query(collection(onlineDb(), 'challenges'), where('participants', 'array-contains', uid)));
  return snapshot.docs
    .map((item) => fromData(item.id, item.data()))
    .filter((challenge): challenge is Challenge => challenge !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}
