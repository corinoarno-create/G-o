// Branchement sur Firebase : connexion Google (Auth) et coffre en ligne (Firestore, version « lite »,
// sans cache ni écoute en direct : l'app a déjà sa base locale, il lui suffit de lire et d'écrire).
// Ce module est chargé à la demande (import dynamique), pour ne pas alourdir le démarrage.
//
// Rangement : users/{uid}/core/state, users/{uid}/core/cards-00 … cards-15, users/{uid}/batches/{lot}.
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  type Firestore,
} from 'firebase/firestore/lite';
import { SHARD_COUNT, type RemoteBatch, type RemoteStore } from './engine.ts';
import { FIREBASE_CONFIG } from './firebase-config.ts';

export interface Account {
  uid: string;
  name: string;
  email: string | null;
}

let services: { app: FirebaseApp; auth: Auth; firestore: Firestore } | null = null;

function connect() {
  if (!FIREBASE_CONFIG) throw new Error('Firebase n’est pas configuré.');
  if (!services) {
    const app = initializeApp(FIREBASE_CONFIG);
    const auth = initializeAuth(app, {
      // La connexion est retenue (IndexedDB), y compris hors ligne.
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
    auth.languageCode = 'fr';
    services = { app, auth, firestore: getFirestore(app) };
  }
  return services;
}

const toAccount = (user: User): Account => ({
  uid: user.uid,
  name: user.displayName ?? user.email ?? 'Explorateur',
  email: user.email,
});

/** Le compte connecté, une fois la connexion retenue relue (null si personne). */
export function currentAccount(): Promise<Account | null> {
  const { auth } = connect();
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      resolve(user ? toAccount(user) : null);
    });
  });
}

/** Connexion Google, dans une fenêtre surgissante (la redirection marche mal hors du domaine Firebase). */
export async function signInWithGoogle(): Promise<Account> {
  const { auth } = connect();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const { user } = await signInWithPopup(auth, provider);
  return toAccount(user);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(connect().auth);
}

/** Le coffre en ligne d'un compte. */
export function remoteStore(uid: string): RemoteStore {
  const { firestore } = connect();
  const core = (id: string) => doc(firestore, 'users', uid, 'core', id);
  const stateRef = core('state');
  const shardRefs = Array.from({ length: SHARD_COUNT }, (_, i) => core(`cards-${String(i).padStart(2, '0')}`));
  const batches = collection(firestore, 'users', uid, 'batches');
  const text = (data: unknown): string | null => {
    const value = (data as { text?: unknown } | undefined)?.text;
    return typeof value === 'string' ? value : null;
  };

  return {
    async updateCore(compute) {
      await runTransaction(firestore, async (tx) => {
        const [state, ...shards] = await Promise.all([stateRef, ...shardRefs].map((ref) => tx.get(ref)));
        const write = compute({ state: text(state!.data()), shards: shards.map((snap) => text(snap.data())) });
        if (write.state !== undefined) tx.set(stateRef, { text: write.state, updatedAt: serverTimestamp() });
        for (const [i, value] of write.shards) tx.set(shardRefs[i]!, { text: value, updatedAt: serverTimestamp() });
      });
    },
    async batchesSince(ms) {
      const snapshot = await getDocs(query(batches, where('createdAt', '>', Timestamp.fromMillis(ms)), orderBy('createdAt')));
      const result: RemoteBatch[] = [];
      for (const item of snapshot.docs) {
        const data = item.data() as { createdAt?: Timestamp; items?: unknown };
        if (data.createdAt instanceof Timestamp && typeof data.items === 'string') {
          result.push({ createdAtMs: data.createdAt.toMillis(), items: data.items });
        }
      }
      return result;
    },
    async addBatch(items) {
      await addDoc(batches, { createdAt: serverTimestamp(), items });
    },
  };
}
