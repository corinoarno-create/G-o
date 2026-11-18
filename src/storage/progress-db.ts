// Base de progression de l'app : ouverte une fois (et rouverte si elle a dû être fermée),
// avec demande de stockage persistant.
import { requestPersistentStorage } from '../lib/device.ts';
import { openGeoDb, type GeoDatabase } from './db.ts';

let pending: Promise<GeoDatabase> | null = null;
let persistenceRequested = false;

export function progressDb(): Promise<GeoDatabase> {
  pending ??= openGeoDb(undefined, () => {
    pending = null;
  }).then((db) => {
    if (!persistenceRequested) {
      persistenceRequested = true;
      // Sans attendre : si le navigateur refuse, l'app marche quand même (d'où l'export régulier).
      void requestPersistentStorage();
    }
    return db;
  });
  return pending;
}
