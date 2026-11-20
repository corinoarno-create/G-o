// Encart « Mes appareils » du pied de l'accueil : se connecter avec Google, voir où en est la
// synchronisation, la relancer à la main. Sans Firebase configuré, on garde l'ancien message.
import { requestSync, signIn, signOut, useSync, type SyncState } from './sync.ts';
import './sync.css';

/** « à l'instant », « il y a 3 min », « il y a 2 h », « le 18 nov. ». */
export function formatSince(at: number, now = Date.now()): string {
  const minutes = Math.round((now - at) / 60_000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `le ${new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}

function statusText(sync: SyncState): string {
  switch (sync.phase) {
    case 'connecting':
      return 'Connexion…';
    case 'syncing':
      return 'Synchronisation…';
    case 'offline':
      return 'Hors ligne : on synchronisera au retour du réseau.';
    case 'error':
      return sync.message ?? 'La synchronisation n’a pas abouti.';
    default:
      return sync.lastSyncAt ? `Synchronisé ${formatSince(sync.lastSyncAt)}` : 'Prêt à synchroniser';
  }
}

export function SyncPanel() {
  const sync = useSync();
  if (sync.phase === 'unavailable') {
    return (
      <p>Ton carnet reste dans ce navigateur : exporte-le de temps en temps pour le garder ou le passer sur un autre appareil.</p>
    );
  }

  if (sync.phase === 'signed-out' || (sync.phase === 'connecting' && !sync.firstName)) {
    return (
      <div class="sync">
        <p class="sync__text">
          <strong>Mes appareils</strong> · Connecte-toi pour retrouver ton carnet sur ton téléphone et ton PC, sans rien exporter.
        </p>
        <button
          type="button"
          class="btn btn--teal sync__button"
          disabled={sync.phase === 'connecting'}
          onClick={() =>
            void signIn((name) =>
              window.confirm(
                `Ce carnet est celui d’un autre compte. Le remplacer par celui de ${name} ? ` +
                  '(Le carnet actuel reste en sécurité dans son propre compte.)',
              ),
            )
          }
        >
          {sync.phase === 'connecting' ? 'Connexion…' : 'Se connecter avec Google'}
        </button>
        {sync.message && (
          <p class="sync__message" role="status">
            {sync.message}
          </p>
        )}
      </div>
    );
  }

  const busy = sync.phase === 'syncing' || sync.phase === 'connecting';
  return (
    <div class="sync">
      <p class="sync__text" role="status">
        <strong>Mes appareils</strong> · {sync.email ?? sync.firstName} ·{' '}
        <span class={`sync__state is-${sync.phase}`}>{statusText(sync)}</span>
      </p>
      <div class="sync__actions">
        <button type="button" class="btn-ghost" disabled={busy} onClick={() => void requestSync({ force: true })}>
          Synchroniser
        </button>
        <button type="button" class="btn-ghost" disabled={busy} onClick={() => void signOut()}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
