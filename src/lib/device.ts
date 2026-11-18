// Appareil et stockage persistant.
import type { Device } from '../engine/grading.ts';

/**
 * Type d'appareil, pour les médianes de temps (§ 5.2 : par appareil). On se fie au pointeur principal :
 * un écran tactile sans souris (téléphone, tablette) est « mobile ».
 */
export function detectDevice(): Device {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'desktop';
  return window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop';
}

/**
 * Demande au navigateur de ne pas effacer la base quand l'espace manque (sinon la progression
 * pourrait disparaître sans prévenir). Renvoie true si le stockage est persistant.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
