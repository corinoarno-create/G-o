// Fin de manche festive (§ 8) : score, précision, temps, éléments acquis ou maîtrisés,
// et les éléments à revoir, présentés comme une occasion et non comme un échec.
import { useMemo } from 'preact/hooks';
import type { WorldData } from '../data/world.ts';
import { MASTERY_LABELS } from '../engine/srs.ts';
import type { QuestionRef } from './questions.ts';
import type { SessionSummary } from './session.ts';

interface Props {
  world: WorldData;
  title: string;
  summary: SessionSummary;
  onReplayMissed: () => void;
  onRestart: () => void;
  onExit: () => void;
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

const CONFETTI_COLORS = ['#2f8f6f', '#e8a33d', '#3fae63', '#4c8ed9', '#d9534f', '#a66cd9'];

export function EndScreen({ world, title, summary, onReplayMissed, onRestart, onExit }: Props) {
  /** Ce qu'il fallait répondre, selon l'exercice : « Lima (Pérou) », « Pérou »… */
  const answerOf = ({ exercise, entityId }: QuestionRef) => {
    const entity = world.byId.get(entityId);
    if (!entity) return entityId;
    if (exercise === 'name-capital' || exercise === 'locate-capital') return `${entity.capital?.name ?? '—'} (${entity.name})`;
    if (exercise === 'flag-to-country' || exercise === 'country-to-flag') return `${entity.name} (drapeau)`;
    return entity.name;
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

      <div class="end__card">
        <p class="end__kicker">{title}</p>
        <h1 class="end__title">{headline(summary.accuracy)}</h1>

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
            <h2>🎉 Nouveaux acquis</h2>
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
            <button type="button" class="game__button" onClick={onReplayMissed}>
              {summary.missed.length === 1 ? 'Revoir cet élément' : `Revoir ces ${summary.missed.length} éléments`}
            </button>
          )}
          <button type="button" class="game__button game__button--secondary" onClick={onRestart}>
            Nouvelle manche
          </button>
          <button type="button" class="game__link" onClick={onExit}>
            Retour à l’accueil
          </button>
        </div>
      </div>
    </div>
  );
}
