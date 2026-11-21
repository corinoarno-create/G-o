// Envoyer un défi : directement à un ami (il le verra dans « Mes défis »), ou par un lien
// à partager (WhatsApp, SMS…). Seul le créateur peut l'envoyer directement.
import { useState } from 'preact/hooks';
import { SendIcon } from '../ui/icons.tsx';
import type { Friend } from './summary.ts';
import { challengeUrl, type Challenge } from './types.ts';

interface Props {
  challenge: Challenge;
  myUid: string;
  myName: string;
  friends: Friend[];
  /** Après un envoi direct (pour recharger le défi). */
  onInvited: () => void;
}

export function SharePanel({ challenge, myUid, myName, friends, onInvited }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const isCreator = challenge.creator === myUid;
  const candidates = isCreator ? friends.filter((f) => !challenge.participants.includes(f.uid)) : [];
  const alreadySent = friends.filter((f) => challenge.invited.includes(f.uid) && !challenge.results[f.uid]);

  const invite = async (friend: Friend) => {
    setBusy(friend.uid);
    try {
      const { inviteToChallenge } = await import('./remote.ts');
      await inviteToChallenge(challenge.id, friend.uid);
      setMessage(`Envoyé à ${friend.name} : le défi apparaîtra dans sa liste à sa prochaine visite.`);
      onInvited();
    } catch (error) {
      console.error(error);
      setMessage('L’envoi n’a pas abouti. Vérifie ta connexion, puis réessaie.');
    } finally {
      setBusy(null);
    }
  };

  const shareLink = async () => {
    const url = challengeUrl(challenge.id);
    const text = `${myName} te défie sur Géo : ${challenge.title} !`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Défi Géo', text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setMessage('Lien copié : colle-le dans ta messagerie.');
    } catch (error) {
      // Partage annulé : rien à dire. Sinon, on montre le lien à copier à la main.
      if ((error as { name?: string }).name !== 'AbortError') setMessage(url);
    }
  };

  return (
    <section class="share" aria-label="Envoyer le défi">
      <h2 class="share__title hand">Envoyer le défi</h2>
      <div class="share__buttons">
        {candidates.map((friend) => (
          <button
            type="button"
            key={friend.uid}
            class="btn btn--teal"
            disabled={busy !== null}
            onClick={() => void invite(friend)}
          >
            <SendIcon /> {friend.name}
          </button>
        ))}
        <button type="button" class="btn btn--gold" onClick={() => void shareLink()}>
          Partager le lien
        </button>
      </div>
      {alreadySent.length > 0 && (
        <p class="share__note">Déjà envoyé à {alreadySent.map((f) => f.name).join(', ')}.</p>
      )}
      {message && (
        <p class="share__note" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
