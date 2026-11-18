// Base de progression de l'app : ouverte une seule fois, avec demande de stockage persistant.
import { requestPersistentStorage } from '../lib/device.ts';
import { openGeoDb, type GeoDatabase } from './db.ts';

let pending: Promise<GeoDatabase> | null = null;

export function progressDb(): Promise<GeoDatabase> {
  pending ??= openGeoDb().then((db) => {
    // Sans attendre : si le navigateur refuse, l'app marche quand même (d'où l'export régulier).
    void requestPersistentStorage();
    return db;
  });
  return pending;
}
