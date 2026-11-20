// Synchronisation automatique entre mes appareils : quand elle a lieu, et ce qu'en voit l'interface.
// Un petit état partagé, lu par les écrans avec le hook useSync() (comme pwa.ts).
//
// Quand : au démarrage, quand l'app revient au premier plan, quand elle passe en arrière-plan
// (pour envoyer ce qui vient d'être joué), au retour du réseau, à la fin d'une manche et après
// une remise à zéro. Jamais pendant une question : rien n'interrompt le jeu.
//
// Ce qui est propre à cet appareil (compte lié, date de la dernière lecture) reste dans le
// localStorage : cela ne voyage ni avec l'export JSON ni avec la synchronisation.
import { useEffect, useState } from 'preact/hooks';
import { progressDb } from '../storage/progress-db.ts';
import { readSnapshot, replaceSnapshot } from '../storage/db.ts';
import { emptySnapshot } from '../storage/schema.ts';
import { SyncFormatError, syncOnce } from './engine.ts';
import { FIREBASE_CONFIG } from './firebase-config.ts';

export type SyncPhase =
  /** Firebase n'est pas encore configuré : la synchronisation n'apparaît pas. */
  | 'unavailable'
  | 'signed-out'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'error';

export interface SyncState {
  phase: SyncPhase;
  /** Prénom du compte lié (gardé ici pour l'afficher hors ligne). */
  firstName: string | null;
  email: string | null;
  lastSyncAt: number | null;
  message: string | null;
  /** Augmente quand une synchronisation a apporté du neuf : les écrans rechargent leurs données. */
  dataVersion: number;
}

interface Stored {
  /** Compte dont cette base locale contient la progression (gardé même après déconnexion). */
  owner?: string;
  /** Compte connecté, s'il y en a un. */
  uid?: string;
  name?: string;
  email?: string | null;
  lastPullMs?: number;
  lastSyncAt?: number;
}

const STORAGE_KEY = 'geo-sync';
/** On ne resynchronise pas au retour au premier plan si la dernière date de moins de 30 s. */
const MIN_INTERVAL_MS = 30_000;

function readStored(): Stored {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Stored;
  } catch {
    return {};
  }
}

function writeStored(patch: Partial<Stored>): Stored {
  const next = { ...readStored(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Stockage refusé (navigation privée) : la synchronisation marche quand même pour cette visite.
  }
  return next;
}

const firstNameOf = (name: string | undefined) => name?.trim().split(/\s+/)[0] ?? null;

const initialStored = readStored();
let state: SyncState = {
  phase: !FIREBASE_CONFIG ? 'unavailable' : initialStored.uid ? 'connecting' : 'signed-out',
  firstName: initialStored.uid ? firstNameOf(initialStored.name) : null,
  email: initialStored.uid ? (initialStored.email ?? null) : null,
  lastSyncAt: initialStored.lastSyncAt ?? null,
  message: null,
  dataVersion: 0,
};
const listeners = new Set<(state: SyncState) => void>();

function setState(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

export function useSync(): SyncState {
  const [current, setCurrent] = useState(state);
  useEffect(() => {
    listeners.add(setCurrent);
    setCurrent(state);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);
  return current;
}

/** Prénom du compte lié, pour l'accueil (« Bonjour Arno ! »). */
export const syncFirstName = () => state.firstName;

const loadFirebase = () => import('./firebase.ts');

let running: Promise<void> | null = null;
let again = false;

/** Lance une synchronisation (ou en programme une juste après celle en cours). */
export function requestSync(options: { force?: boolean } = {}): Promise<void> {
  const stored = readStored();
  if (!FIREBASE_CONFIG || !stored.uid) return Promise.resolve();
  if (!options.force && !running && stored.lastSyncAt && Date.now() - stored.lastSyncAt < MIN_INTERVAL_MS) {
    return Promise.resolve();
  }
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await runSync();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function runSync(): Promise<void> {
  const stored = readStored();
  if (!stored.uid) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setState({ phase: 'offline', message: null });
    return;
  }
  setState({ phase: 'syncing', message: null });
  try {
    const { remoteStore } = await loadFirebase();
    const result = await syncOnce(await progressDb(), remoteStore(stored.uid), stored.lastPullMs ?? 0);
    const now = Date.now();
    writeStored({ lastPullMs: result.lastPullMs, lastSyncAt: now });
    const fresh = result.cardsReceived + result.reviewsReceived > 0;
    setState({ phase: 'synced', lastSyncAt: now, dataVersion: state.dataVersion + (fresh ? 1 : 0) });
  } catch (error) {
    console.error(error);
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    setState({
      phase: offline ? 'offline' : 'error',
      message:
        error instanceof SyncFormatError
          ? error.message
          : offline
            ? null
            : 'La synchronisation n’a pas abouti. Ta progression est bien gardée ici ; on réessaiera plus tard.',
    });
  }
}

/** Au démarrage : relit le compte lié et branche les déclencheurs automatiques. */
export function startSync(): void {
  if (!FIREBASE_CONFIG || typeof window === 'undefined') return;
  document.addEventListener('visibilitychange', () => {
    // Au premier plan : récupérer ce que l'autre appareil a joué ; en arrière-plan : envoyer le mien.
    void requestSync({ force: document.visibilityState === 'hidden' });
  });
  window.addEventListener('online', () => void requestSync({ force: true }));
  window.addEventListener('offline', () => {
    if (state.phase !== 'signed-out') setState({ phase: 'offline' });
  });
  if (!readStored().uid) return;
  void (async () => {
    try {
      const { currentAccount } = await loadFirebase();
      const account = await currentAccount();
      if (!account) {
        writeStored({ uid: undefined });
        setState({ phase: 'signed-out', firstName: null, email: null });
        return;
      }
      await requestSync({ force: true });
    } catch (error) {
      console.error(error);
      setState({ phase: navigator.onLine === false ? 'offline' : 'error' });
    }
  })();
}

/**
 * Connexion Google. La première fois sur un appareil, ce qui a déjà été joué ici rejoint le compte.
 * Si la base locale appartient à un autre compte, on demande avant de la remplacer.
 */
export async function signIn(confirmReplace: (otherName: string) => boolean): Promise<void> {
  setState({ phase: 'connecting', message: null });
  try {
    const { signInWithGoogle, signOut } = await loadFirebase();
    const account = await signInWithGoogle();
    const stored = readStored();
    if (stored.owner && stored.owner !== account.uid) {
      const db = await progressDb();
      const local = await readSnapshot(db);
      if (local.cards.length + local.reviews.length > 0) {
        if (!confirmReplace(account.name)) {
          await signOut();
          setState({ phase: 'signed-out' });
          return;
        }
        // Le carnet d'ici est celui de l'autre compte (toujours dans son compte en ligne) : on repart à vide.
        await replaceSnapshot(db, emptySnapshot());
        setState({ dataVersion: state.dataVersion + 1 });
      }
    }
    writeStored({
      owner: account.uid,
      uid: account.uid,
      name: account.name,
      email: account.email,
      lastPullMs: stored.owner === account.uid ? stored.lastPullMs : 0,
    });
    setState({ firstName: firstNameOf(account.name), email: account.email });
    await requestSync({ force: true });
  } catch (error) {
    console.error(error);
    const code = (error as { code?: string }).code ?? '';
    const cancelled = code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';
    setState({
      phase: 'signed-out',
      message: cancelled
        ? null
        : code === 'auth/popup-blocked'
          ? 'La fenêtre de connexion a été bloquée par le navigateur : autorise-la, puis réessaie.'
          : 'La connexion n’a pas abouti. Vérifie ta connexion internet, puis réessaie.',
    });
  }
}

/** Déconnexion : la progression reste sur cet appareil, la synchronisation s'arrête. */
export async function signOut(): Promise<void> {
  await requestSync({ force: true });
  const { signOut: firebaseSignOut } = await loadFirebase();
  await firebaseSignOut();
  writeStored({ uid: undefined, lastSyncAt: undefined });
  setState({ phase: 'signed-out', firstName: null, email: null, lastSyncAt: null, message: null });
}
