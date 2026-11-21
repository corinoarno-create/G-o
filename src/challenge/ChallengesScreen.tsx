// Page « Mes défis » : défis reçus à relever, résultats, défis envoyés en attente, et mes amis
// (les personnes croisées dans mes défis) avec le bilan de nos face-à-face et « Défier ».
import { useEffect, useState } from 'preact/hooks';
import type { WorldData } from '../data/world.ts';
import { EXERCISES, type ExerciseId } from '../game/exercises.ts';
import type { GameRequest } from '../game/plans.ts';
import type { Zone } from '../map/zones.ts';
import { connectedAccount, signIn, useSync } from '../sync/sync.ts';
import { BackIcon, TrophyIcon } from '../ui/icons.tsx';
import { drawChallenge, loadMyChallenges, readSeen } from './challenges.ts';
import { formatPoints } from './ChallengeScreen.tsx';
import { challengeStatus, friendsFrom, ranking, type Friend } from './summary.ts';
import type { Challenge } from './types.ts';
import './challenge.css';

interface Props {
  world: WorldData;
  zones: Zone[];
  onOpen: (challengeId: string) => void;
  onPlay: (request: GameRequest) => void;
  onHome: () => void;
}

const EXERCISE_IDS = Object.keys(EXERCISES) as ExerciseId[];
const COUNTS = [10, 20] as const;

const formatDate = (ms: number) => new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/** Formulaire « Défier María » : région, exercice, nombre de questions. */
function ChallengeFriend({ friend, world, zones, onPlay }: { friend: Friend; world: WorldData; zones: Zone[]; onPlay: Props['onPlay'] }) {
  const regions = zones.filter((zone) => zone.kind === 'world' || zone.kind === 'continent');
  const [zoneId, setZoneId] = useState(regions[0]?.id ?? 'world');
  const [exercise, setExercise] = useState<ExerciseId>('locate-capital');
  const [count, setCount] = useState<number>(10);
  const go = () => {
    const zone = regions.find((z) => z.id === zoneId) ?? regions[0]!;
    const play = drawChallenge(world, zone, exercise, count, [friend.uid]);
    onPlay({ kind: 'questions', title: `Défi · ${play.title}`, zone, questions: play.questions, challenge: play });
  };
  return (
    <div class="defis__form">
      <label>
        Région
        <select value={zoneId} onChange={(e) => setZoneId(e.currentTarget.value)}>
          {regions.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Exercice
        <select value={exercise} onChange={(e) => setExercise(e.currentTarget.value as ExerciseId)}>
          {EXERCISE_IDS.map((id) => (
            <option key={id} value={id}>
              {EXERCISES[id].label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Questions
        <select value={count} onChange={(e) => setCount(Number(e.currentTarget.value))}>
          {COUNTS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <button type="button" class="btn btn--terracotta" onClick={go}>
        Jouer, puis envoyer à {friend.name}
      </button>
    </div>
  );
}

export function ChallengesScreen({ world, zones, onOpen, onPlay, onHome }: Props) {
  const sync = useSync();
  const me = connectedAccount();
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openFriend, setOpenFriend] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    loadMyChallenges()
      .then(setChallenges)
      .catch((reason: unknown) => {
        console.error(reason);
        setError('Impossible de charger tes défis. Vérifie ta connexion, puis réessaie.');
      });
  }, [me?.uid]);

  const header = (
    <header class="defis__head">
      <button type="button" class="btn-ghost" onClick={onHome}>
        <BackIcon /> Accueil
      </button>
      <h1 class="hand">Mes défis</h1>
    </header>
  );

  if (!me) {
    return (
      <div class="defis">
        {header}
        <section class="paper-card defis__card">
          <p>
            Défie tes proches sur la même série de questions et comparez vos scores. Pour cela, connecte-toi avec ton compte
            Google (une seule fois par appareil).
          </p>
          <button
            type="button"
            class="btn btn--teal"
            disabled={sync.phase === 'connecting'}
            onClick={() =>
              void signIn((name) => window.confirm(`Ce carnet est celui d’un autre compte. Le remplacer par celui de ${name} ?`))
            }
          >
            Se connecter avec Google
          </button>
        </section>
      </div>
    );
  }

  if (error || !challenges) {
    return (
      <div class="defis">
        {header}
        <p class="defis__empty">{error ?? 'Chargement de tes défis…'}</p>
      </div>
    );
  }

  const friends = friendsFrom(challenges, me.uid);
  const names = new Map(friends.map((f) => [f.uid, f.name]));
  const seen = readSeen();
  const toPlay = challenges.filter((c) => challengeStatus(c, me.uid) === 'to-play');
  const done = challenges.filter((c) => challengeStatus(c, me.uid) === 'done');
  const waiting = challenges.filter((c) => challengeStatus(c, me.uid) === 'waiting');
  const nameOf = (uid: string, c: Challenge) => c.names[uid] ?? names.get(uid) ?? 'Un ami';

  return (
    <div class="defis">
      {header}
      {challenges.length === 0 && (
        <p class="defis__empty">
          Aucun défi pour l’instant. Ouvre une région de ton carnet, choisis un exercice, puis « Défier » : tu joues la série,
          et tu l’envoies à qui tu veux.
        </p>
      )}

      {toPlay.length > 0 && (
        <section class="paper-card defis__card">
          <h2 class="hand">À relever</h2>
          <ul class="defis__list">
            {toPlay.map((c) => (
              <li key={c.id}>
                <button type="button" class="defis__item is-new" onClick={() => onOpen(c.id)}>
                  <span>
                    <strong>{nameOf(c.creator, c)} te défie</strong> · {c.title}
                  </span>
                  <span class="defis__meta">{formatDate(c.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section class="paper-card defis__card">
          <h2 class="hand">Résultats</h2>
          <ul class="defis__list">
            {done.map((c) => {
              const ranked = ranking(c, names);
              const fresh = Object.keys(c.results).length > (seen[c.id] ?? 1);
              return (
                <li key={c.id}>
                  <button type="button" class={`defis__item ${fresh ? 'is-new' : ''}`} onClick={() => onOpen(c.id)}>
                    <span>
                      <strong>{c.title}</strong>
                      <span class="defis__scores">
                        {ranked.map((r, i) => (
                          <span key={r.uid}>
                            {i > 0 && ' · '}
                            {r.rank === 1 && <TrophyIcon size={14} />} {r.uid === me.uid ? 'Toi' : r.name} {formatPoints(r.result.score)}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span class="defis__meta">{fresh ? 'Nouveau' : formatDate(c.createdAt)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {waiting.length > 0 && (
        <section class="paper-card defis__card">
          <h2 class="hand">En attente</h2>
          <ul class="defis__list">
            {waiting.map((c) => {
              const invited = c.invited.map((uid) => nameOf(uid, c));
              return (
                <li key={c.id}>
                  <button type="button" class="defis__item" onClick={() => onOpen(c.id)}>
                    <span>
                      <strong>{c.title}</strong>
                      <span class="defis__scores">
                        {invited.length ? `Envoyé à ${invited.join(', ')}` : 'Pas encore envoyé : touche pour partager le lien'}
                      </span>
                    </span>
                    <span class="defis__meta">{formatDate(c.createdAt)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {friends.length > 0 && (
        <section class="paper-card defis__card">
          <h2 class="hand">Mes amis</h2>
          <ul class="defis__friends">
            {friends.map((friend) => (
              <li key={friend.uid}>
                <div class="defis__friend">
                  <span>
                    <strong>{friend.name}</strong>
                    <span class="defis__scores">
                      {friend.wins + friend.losses + friend.draws > 0
                        ? `Toi ${friend.wins} – ${friend.losses} ${friend.name}${friend.draws ? ` · ${friend.draws} égalité${friend.draws > 1 ? 's' : ''}` : ''}`
                        : 'Premier face-à-face à venir'}
                    </span>
                  </span>
                  <button
                    type="button"
                    class="btn btn--teal"
                    aria-expanded={openFriend === friend.uid}
                    onClick={() => setOpenFriend(openFriend === friend.uid ? null : friend.uid)}
                  >
                    Défier
                  </button>
                </div>
                {openFriend === friend.uid && <ChallengeFriend friend={friend} world={world} zones={zones} onPlay={onPlay} />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
