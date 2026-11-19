// Application installable (étape 8) : service worker (hors ligne, mises à jour) et invitation à installer.
// Un petit état partagé, lu par les écrans avec le hook usePwa().
import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';

/** Événement « beforeinstallprompt » (Chrome, Android) : pas encore dans les types du DOM. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaState {
  /** Une nouvelle version est téléchargée et attend d'être appliquée. */
  updateReady: boolean;
  /** L'app vient d'être mise en cache : elle marchera hors ligne. */
  offlineReady: boolean;
  /** Le navigateur propose l'installation (bouton « Installer l'app »). */
  installable: boolean;
}

let state: PwaState = { updateReady: false, offlineReady: false, installable: false };
let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;
let installPrompt: InstallPromptEvent | null = null;
const listeners = new Set<(state: PwaState) => void>();

function setState(patch: Partial<PwaState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

/** À appeler une fois au démarrage. */
export function startPwa(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (event) => {
    // On garde l'invitation pour la proposer au bon moment, par notre propre bouton.
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    setState({ installable: true });
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    setState({ installable: false });
  });
  if (!('serviceWorker' in navigator)) return;
  applyUpdate = registerSW({
    onNeedRefresh: () => setState({ updateReady: true }),
    onOfflineReady: () => setState({ offlineReady: true }),
  });
}

/** Applique la nouvelle version (la page se recharge). */
export function updateApp(): void {
  void applyUpdate?.(true);
}

export function dismissUpdate(): void {
  setState({ updateReady: false });
}

export function dismissOfflineReady(): void {
  setState({ offlineReady: false });
}

/** Ouvre la fenêtre d'installation du navigateur. */
export async function installApp(): Promise<void> {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  setState({ installable: false });
  await prompt.prompt();
  await prompt.userChoice;
}

export function usePwa(): PwaState {
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
