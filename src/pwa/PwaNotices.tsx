// Bandeaux discrets : nouvelle version prête, ou app prête à marcher hors ligne.
// Affichés hors des manches seulement, pour ne jamais recharger l'app en pleine question.
import { useEffect } from 'preact/hooks';
import { dismissOfflineReady, dismissUpdate, updateApp, usePwa } from './pwa.ts';
import './pwa.css';

export function PwaNotices() {
  const { updateReady, offlineReady } = usePwa();

  // « Prête hors ligne » : une information, qui s'efface seule.
  useEffect(() => {
    if (!offlineReady) return undefined;
    const timer = setTimeout(dismissOfflineReady, 5000);
    return () => clearTimeout(timer);
  }, [offlineReady]);

  if (updateReady) {
    return (
      <div class="pwa-notice paper-card" role="status">
        <p>Une nouvelle version de Géo est prête.</p>
        <div class="pwa-notice__actions">
          <button type="button" class="btn btn--teal" onClick={updateApp}>
            Mettre à jour
          </button>
          <button type="button" class="btn-ghost" onClick={dismissUpdate}>
            Plus tard
          </button>
        </div>
      </div>
    );
  }
  if (offlineReady) {
    return (
      <div class="pwa-notice paper-card" role="status">
        <p>Géo est prête à fonctionner hors ligne.</p>
        <button type="button" class="btn-ghost" onClick={dismissOfflineReady}>
          OK
        </button>
      </div>
    );
  }
  return null;
}
