// Page d'un défi : l'invitation (« Arno te défie ! ») tant que je ne l'ai pas joué, puis la
// comparaison des résultats, question par question, avec « Revanche » et l'envoi du défi.
// On ne voit les scores des autres qu'après avoir joué, pour ne rien dévoiler.
import { useEffect, useState } from 'preact/hooks';
import type { WorldData } from '../data/world.ts';
import { EXERCISES } from '../game/exercises.ts';
import type { GameRequest } from '../game/plans.ts';
import type { Zone } from '../map/zones.ts';
import { connectedAccount, signIn, useSync } from '../sync/sync.ts';
import { BackIcon, CheckIcon, CloseIcon, TrophyIcon } from '../ui/icons.tsx';
import { answerPlay, drawChallenge, loadMyChallenges, markSeen } from './challenges.ts';
import { SharePanel } from './SharePanel.tsx';
import { challengeStatus, friendsFrom, ranking, type Friend } from './summary.ts';
import type { Challenge } from './types.ts';
import './challenge.css';

interface Props {
  world: WorldData;
  zones: Zone[];
  challengeId: string;
  /** Je viens de jouer ce défi. */
  justPlayed?: boolean;
  onPlay: (request: GameRequest) => void;
  onChallenges: () => void;
  onHome: () => void;
}

export const formatPoints = (points: number) => `${points.toLocaleString('fr-FR')} pts`;

export function formatTime(ms: number): string {
  const seconds = Math.round(ms / 100) / 10;
  if (seconds < 60) return `${seconds.toLocaleString('fr-FR')} s`;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)} min ${String(whole % 60).padStart(2, '0')} s`;
}

/** Nom affiché d'une question : la capitale pour les exercices de capitales, sinon le pays. */
function questionLabel(world: WorldData, exercise: Challenge['exercise'], entityId: string): string {
  const entity = world.byId.get(entityId);
  if (!entity) return entityId;
  const capitalExercise = exercise === 'locate-capital' || exercise === 'name-capital' || exercise === 'capital-to-country';
  return capitalExercise && entity.capital ? `${entity.capital.name} (${entity.name})` : entity.name;
}

/** Titre de la comparaison, toujours positif. */
function headline(challenge: Challenge, uid: string, names: Map<string, string>): string {
  const ranked = ranking(challenge, names);
  if (ranked.length < 2) return 'Défi lancé !';
  const leaders = ranked.filter((r) => r.rank === 1);
  if (leaders.length > 1) return leaders.some((r) => r.uid === uid) ? 'Égalité parfaite !' : 'Ex æquo en tête !';
  return leaders[0]!.uid === uid ? 'Victoire !' : `${leaders[0]!.name} l’emporte !`;
}

export function ChallengeScreen({ world, zones, challengeId, justPlayed, onPlay, onChallenges, onHome }: Props) {
  const sync = useSync();
  const me = connectedAccount();
  const [challenge, setChallenge] = useState<Challenge | null | 'missing'>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    void (async () => {
      try {
        const { getChallenge } = await import('./remote.ts');
        const [found, mine] = await Promise.all([getChallenge(challengeId), loadMyChallenges()]);
        if (cancelled) return;
        setChallenge(found ?? 'missing');
        setFriends(friendsFrom(mine, me.uid));
        if (found && found.results[me.uid]) markSeen(found);
      } catch (reason) {
        console.error(reason);
        if (!cancelled) setError('Impossible de charger le défi. Vérifie ta connexion, puis réessaie.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [challengeId, me?.uid, version]);

  const back = (
    <button type="button" class="btn-ghost challenge__back" onClick={onChallenges}>
      <BackIcon /> Mes défis
    </button>
  );

  if (!me) {
    return (
      <div class="challenge">
        <div class="challenge__card paper-card">
          <TrophyIcon size={40} />
          <h1 class="challenge__title hand">Un défi t’attend !</h1>
          <p>Connecte-toi avec ton compte Google pour le relever. Tu ne le feras qu’une fois : ensuite, l’app s’en souvient.</p>
          <div class="challenge__actions">
            <button
              type="button"
              class="btn btn--teal"
              disabled={sync.phase === 'connecting'}
              onClick={() =>
                void signIn((name) =>
                  window.confirm(`Ce carnet est celui d’un autre compte. Le remplacer par celui de ${name} ?`),
                )
              }
            >
              Se connecter avec Google
            </button>
            <button type="button" class="btn-ghost" onClick={onHome}>
              Plus tard
            </button>
          </div>
          {sync.message && <p class="challenge__note">{sync.message}</p>}
        </div>
      </div>
    );
  }

  if (error || challenge === 'missing' || challenge === null) {
    return (
      <div class="challenge">
        <div class="challenge__card paper-card">
          {challenge === null && !error ? (
            <p>Chargement du défi…</p>
          ) : (
            <>
              <p>{error ?? 'Ce défi est introuvable : le lien est peut-être incomplet.'}</p>
              <div class="challenge__actions">
                <button type="button" class="btn btn--teal" onClick={onChallenges}>
                  Mes défis
                </button>
                <button type="button" class="btn-ghost" onClick={onHome}>
                  Accueil
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const names = new Map(friends.map((f) => [f.uid, f.name]));
  const creatorName = challenge.names[challenge.creator] ?? names.get(challenge.creator) ?? 'Un ami';
  const zone = zones.find((z) => z.id === challenge.zoneId) ?? zones[0]!;
  const status = challengeStatus(challenge, me.uid);
  const exerciseLabel = EXERCISES[challenge.exercise].label;
  const count = challenge.questions.length;

  if (status === 'to-play') {
    const others = Object.keys(challenge.results).map((uid) => challenge.names[uid] ?? names.get(uid) ?? 'Un ami');
    return (
      <div class="challenge">
        <div class="challenge__card paper-card">
          <span class="tape tape--left" />
          {back}
          <TrophyIcon size={40} />
          <p class="challenge__kicker">{challenge.title}</p>
          <h1 class="challenge__title hand">{creatorName} te défie !</h1>
          <p>
            {count} question{count > 1 ? 's' : ''} · {exerciseLabel} · {zone.label}
          </p>
          <p class="challenge__note">
            Score : 100 points par bonne réponse du premier coup, jusqu’à 50 de plus pour la rapidité. Les scores se
            dévoilent quand tu as joué.
            {others.length > 0 && ` Déjà relevé par : ${others.join(', ')}.`}
          </p>
          <div class="challenge__actions">
            <button
              type="button"
              class="btn btn--terracotta btn--big"
              onClick={() =>
                onPlay({
                  kind: 'questions',
                  title: `Défi · ${challenge.title}`,
                  zone,
                  questions: challenge.questions,
                  challenge: answerPlay(challenge),
                })
              }
            >
              Relever le défi
            </button>
          </div>
        </div>
      </div>
    );
  }

  const ranked = ranking(challenge, names);
  const players = ranked.map((r) => r.uid);
  const opponents = players.filter((uid) => uid !== me.uid);
  const rematch = () => {
    const play = drawChallenge(world, zone, challenge.exercise, count, opponents);
    onPlay({ kind: 'questions', title: `Défi · ${play.title}`, zone, questions: play.questions, challenge: play });
  };

  return (
    <div class="challenge">
      <div class="challenge__card challenge__card--wide paper-card">
        <span class="tape tape--left" />
        <span class="tape tape--right tape--teal" />
        {back}
        <p class="challenge__kicker">{challenge.title}</p>
        <h1 class="challenge__title hand">{headline(challenge, me.uid, names)}</h1>
        {justPlayed && status === 'waiting' && (
          <p>Ton score est enregistré. Envoie le défi : la comparaison s’affichera quand l’autre aura joué.</p>
        )}

        <table class="challenge__ranking">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Joueur</th>
              <th scope="col">Score</th>
              <th scope="col">Justes</th>
              <th scope="col">Temps</th>
              {ranked.some((r) => r.result.medianKm !== null) && <th scope="col">Écart</th>}
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr key={r.uid} class={r.uid === me.uid ? 'is-me' : ''}>
                <td>{r.rank === 1 && ranked.length > 1 ? <TrophyIcon size={18} /> : r.rank}</td>
                <th scope="row">{r.uid === me.uid ? `${r.name} (toi)` : r.name}</th>
                <td>
                  <strong>{formatPoints(r.result.score)}</strong>
                </td>
                <td>
                  {r.result.correct}/{r.result.total}
                </td>
                <td>{formatTime(r.result.timeMs)}</td>
                {ranked.some((x) => x.result.medianKm !== null) && (
                  <td>{r.result.medianKm === null ? '–' : `${Math.round(r.result.medianKm)} km`}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {ranked.length > 1 && (
          <details class="challenge__details">
            <summary>Question par question</summary>
            <table class="challenge__grid">
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  {ranked.map((r) => (
                    <th scope="col" key={r.uid}>
                      {r.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {challenge.questions.map((question, i) => (
                  <tr key={`${question.entityId}-${i}`}>
                    <th scope="row">{questionLabel(world, question.exercise, question.entityId)}</th>
                    {ranked.map((r) => {
                      const answer = r.result.answers[i];
                      if (!answer) return <td key={r.uid}>–</td>;
                      const [correct, ms, hint] = answer;
                      return (
                        <td key={r.uid} class={correct ? 'is-right' : 'is-wrong'}>
                          {correct ? <CheckIcon size={16} /> : <CloseIcon size={14} />} {formatTime(ms)}
                          {hint ? ' · indice' : ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}

        <SharePanel
          challenge={challenge}
          myUid={me.uid}
          myName={me.firstName}
          friends={friends}
          onInvited={() => setVersion((v) => v + 1)}
        />

        <div class="challenge__actions">
          {opponents.length > 0 && (
            <button type="button" class="btn btn--terracotta" onClick={rematch}>
              Revanche
            </button>
          )}
          <button type="button" class="btn-ghost" onClick={onHome}>
            Accueil
          </button>
        </div>
      </div>
    </div>
  );
}
