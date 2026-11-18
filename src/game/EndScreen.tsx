// Fin de manche festive (§ 8) : score, précision, temps, éléments acquis ou maîtrisés,
// et les éléments à revoir, présentés comme une occasion et non comme un échec.
import { useMemo } from 'preact/hooks';
import type { WorldData } from '../data/world.ts';
import { MASTERY_LABELS } from '../engine/srs.ts';
import { EXERCISES } from './exercises.ts';
import type { SessionSummary } from './session.ts';
import type { GameConfig } from './start.ts';

interface Props {
  world: WorldData;
  config: GameConfig;
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
function title(accuracy: number): string {
  if (accuracy === 1) return 'Sans faute !';
  if (accuracy >= 0.8) return 'Très belle manche !';
  if (accuracy >= 0.5) return 'Belle progression !';
  return 'Manche terminée !';
}

const CONFETTI_COLORS = ['#2f8f6f', '#e8a33d', '#3fae63', '#4c8ed9', '#d9534f', '#a66cd9'];

export function EndScreen({ world, config, summary, onReplayMissed, onRestart, onExit }: Props) {
  const exercise = EXERCISES[config.exercise];
  const nameOf = (id: string) => world.byId.get(id)?.name ?? id;
  const answerOf = (id: string) => {
    const entity = world.byId.get(id);
    if (!entity) return '';
    return config.exercise === 'name-capital' || config.exercise === 'locate-capital'
      ? `${entity.capital?.name ?? '—'} (${entity.name})`
      : entity.name;
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
        <p class="end__kicker">
          {exercise.label} · {config.zone.label}
        </p>
        <h1 class="end__title">{title(summary.accuracy)}</h1>

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
              {summary.promoted.map(({ entityId, level }) => (
                <li key={entityId}>
                  {nameOf(entityId)} <span class={`end__badge is-${level}`}>{MASTERY_LABELS[level]}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {summary.missed.length > 0 && (
          <section class="end__section">
            <h2>À revoir bientôt</h2>
            <ul class="end__list">
              {summary.missed.map((id) => (
                <li key={id}>{answerOf(id)}</li>
              ))}
            </ul>
          </section>
        )}

        <div class="end__actions">
          {summary.missed.length > 0 && (
            <button type="button" class="game__button" onClick={onReplayMissed}>
              Revoir ces {summary.missed.length} élément{summary.missed.length > 1 ? 's' : ''}
            </button>
          )}
          <button type="button" class="game__button game__button--secondary" onClick={onRestart}>
            Nouvelle manche
          </button>
          <button type="button" class="game__link" onClick={onExit}>
            Retour à la carte
          </button>
        </div>
      </div>
    </div>
  );
}
