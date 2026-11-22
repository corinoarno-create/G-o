// Fin de manche festive (§ 8) : score, précision, temps, éléments acquis ou maîtrisés,
// et les éléments à revoir, présentés comme une occasion et non comme un échec.
import { useMemo } from 'preact/hooks';
import type { WorldData } from '../data/world.ts';
import { MASTERY_LABELS } from '../engine/srs.ts';
import type { QuestionRef } from './questions.ts';
import type { SessionSummary } from './session.ts';
import { answerLabel } from './items.ts';

interface Props {
  world: WorldData;
  title: string;
  summary: SessionSummary;
  onReplayMissed: () => void;
  onRestart: () => void;
  /** Texte du bouton « Nouvelle manche » (« Découvrir 5 de plus » après une découverte). */
  restartLabel?: string;
  onExit: () => void;
  /** Message à afficher en tête (ex. score de défi en attente d'envoi). */
  notice?: string;
  /** Lancer un défi avec cette série (si on est connecté et qu'elle ne mêle pas les exercices). */
  onChallenge?: () => void;
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} min ${String(seconds % 60).padStart(2, '0')} s` : `${seconds} s`;
}

/** Titre selon le résultat, toujours positif. */
function headline(accuracy: number): string {
  if (accuracy === 1) return 'Sans faute !';
  if (accuracy >= 0.8) return 'Très belle manche !';
  if (accuracy >= 0.5) return 'Belle progression !';
  return 'Manche terminée !';
}

/** Confettis aux couleurs de l'aquarelle. */
const CONFETTI_COLORS = ['#e3b76b', '#a8c28a', '#e7a7a0', '#9dc3dd', '#c9a8d4', '#c8623b'];

export function EndScreen({ world, title, summary, onReplayMissed, onRestart, restartLabel, onExit, notice, onChallenge }: Props) {
  /** Ce qu'il fallait répondre, selon l'exercice : « Lima (Pérou) », « Pérou »… */
  const answerOf = ({ exercise, entityId }: QuestionRef) => {
    if (exercise === 'flag-to-country' || exercise === 'country-to-flag') return `${answerLabel(world, exercise, entityId)} (drapeau)`;
    return answerLabel(world, exercise, entityId);
  };
  // Confettis légers, calculés une fois.
  const confetti = useMemo(
    () =>
      Array.from({ length: summary.accuracy >= 0.5 ? 36 : 12 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 1.8 + Math.random() * 1.4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: Math.random() * 360,
      })),
    [summary],
  );

  return (
    <div class="end">
      <div class="end__confetti" aria-hidden="true">
        {confetti.map((piece, i) => (
          <span
            key={i}
            style={{
              left: `${piece.left}%`,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              transform: `rotate(${piece.rotate}deg)`,
            }}
          />
        ))}
      </div>

      <div class="end__card paper-card">
        <span class="tape tape--left" />
        <span class="tape tape--right tape--teal" />
        <p class="end__kicker">{title}</p>
        <h1 class="end__title">{headline(summary.accuracy)}</h1>
        {notice && <p class="end__notice">{notice}</p>}

        <dl class="end__stats">
          <div>
            <dt>Du premier coup</dt>
            <dd>
              {summary.firstTryCorrect} / {summary.total}
            </dd>
          </div>
          <div>
            <dt>Précision</dt>
            <dd>{Math.round(summary.accuracy * 100)} %</dd>
          </div>
          <div>
            <dt>Temps</dt>
            <dd>{formatDuration(summary.durationMs)}</dd>
          </div>
          {summary.averageDistanceKm !== null && (
            <div>
              <dt>Écart moyen</dt>
              <dd>{Math.round(summary.averageDistanceKm)} km</dd>
            </div>
          )}
        </dl>

        {summary.promoted.length > 0 && (
          <section class="end__section">
            <h2>Nouveaux acquis</h2>
            <ul class="end__list">
              {summary.promoted.map((item) => (
                <li key={`${item.exercise}|${item.entityId}`}>
                  {answerOf(item)} <span class={`end__badge is-${item.level}`}>{MASTERY_LABELS[item.level]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {summary.missed.length > 0 && (
          <section class="end__section">
            <h2>À revoir bientôt</h2>
            <ul class="end__list">
              {summary.missed.map((item) => (
                <li key={`${item.exercise}|${item.entityId}`}>{answerOf(item)}</li>
              ))}
            </ul>
          </section>
        )}

        <div class="end__actions">
          {summary.missed.length > 0 && (
            <button type="button" class="btn btn--terracotta" onClick={onReplayMissed}>
              {summary.missed.length === 1 ? 'Revoir cet élément' : `Revoir ces ${summary.missed.length} éléments`}
            </button>
          )}
          <button type="button" class="btn btn--teal" onClick={onRestart}>
            {restartLabel ?? 'Nouvelle manche'}
          </button>
          {onChallenge && (
            <button type="button" class="btn btn--gold" onClick={onChallenge}>
              Défier quelqu’un sur cette série
            </button>
          )}
          <button type="button" class="btn-ghost" onClick={onExit}>
            Retour à l’accueil
          </button>
        </div>
      </div>
    </div>
  );
}
