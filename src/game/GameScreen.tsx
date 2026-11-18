// Écran de jeu : une question à la fois, réponse par clic, saisie ou choix, retour immédiat,
// et boucle de consolidation (un élément raté revient quelques questions plus tard).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { flagUrl } from '../data/flags.ts';
import type { WorldData } from '../data/world.ts';
import {
  createConsolidation,
  currentItem,
  isFinished,
  progress,
  submitAnswer,
  type ConsolidationState,
} from '../engine/consolidation.ts';
import { suggest } from '../engine/text-match.ts';
import { detectDevice } from '../lib/device.ts';
import type { HighlightKind, MapInsets, MapPick, MapPin, WorldMap } from '../map/world-map.ts';
import { WorldMapView } from '../map/WorldMapView.tsx';
import { putSetting } from '../storage/db.ts';
import { progressDb } from '../storage/progress-db.ts';
import { entityNoun, EXERCISES, hasOwnFlag, hintFor, type Hint } from './exercises.ts';
import {
  buildFlagChoices,
  evaluateAnswer,
  summarize,
  type AnswerInput,
  type Evaluation,
  type SessionLogEntry,
  type SessionSummary,
} from './session.ts';
import type { PreparedGame } from './start.ts';
import './game.css';

/** Délai avant de passer seul à la question suivante après une bonne réponse (ms). */
const AUTO_ADVANCE_MS = 1100;

interface Props {
  world: WorldData;
  game: PreparedGame;
  onFinish: (summary: SessionSummary) => void;
  onQuit: () => void;
}

interface Feedback {
  evaluation: Evaluation;
  retryIn: number | null;
  /** Point cliqué (pour Placer les capitales). */
  click: [number, number] | null;
}

export function GameScreen({ world, game, onFinish, onQuit }: Props) {
  const exercise = EXERCISES[game.config.exercise];
  const zone = game.config.zone;
  const device = useMemo(() => detectDevice(), []);
  const [consolidation, setConsolidation] = useState<ConsolidationState>(() => createConsolidation(game.items));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [pending, setPending] = useState<MapPick | null>(null);
  const [typed, setTyped] = useState('');
  const [autocomplete, setAutocomplete] = useState(game.autocomplete);
  const log = useRef<SessionLogEntry[]>([]);
  const startedAt = useRef(performance.now());
  const questionShownAt = useRef(performance.now());
  const mapRef = useRef<WorldMap | null>(null);
  const flew = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapAreaRef = useRef<HTMLElement>(null);
  const promptRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [insets, setInsets] = useState<MapInsets | undefined>(undefined);

  // Place prise par la question et le panneau de réponse, mesurée au début et quand l'écran change de taille
  // (pas à chaque question, pour ne pas recadrer la carte sans arrêt).
  useLayoutEffect(() => {
    const area = mapAreaRef.current;
    if (!area) return undefined;
    const measure = () => {
      const prompt = promptRef.current;
      const panel = panelRef.current;
      if (!prompt || !panel) return;
      setInsets({
        top: prompt.offsetTop + prompt.offsetHeight + 8,
        bottom: area.clientHeight - panel.offsetTop + 8,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);
  const continueRef = useRef<HTMLButtonElement>(null);

  const entityId = currentItem(consolidation);
  const entity = entityId ? world.byId.get(entityId) : undefined;

  // Propositions de drapeaux : fixées par élément, pour qu'un nouvel essai montre les mêmes.
  const flagPool = useMemo(() => world.countries.filter(hasOwnFlag), [world]);
  const choicesCache = useRef(new Map<string, string[]>());
  const choices = useMemo(() => {
    if (exercise.id !== 'country-to-flag' || !entity) return [];
    let cached = choicesCache.current.get(entity.id);
    if (!cached) {
      cached = buildFlagChoices(entity, flagPool, Math.random);
      choicesCache.current.set(entity.id, cached);
    }
    return cached;
  }, [exercise.id, entity, flagPool]);

  // Nouvelle question : on remet le chrono à zéro et on recentre si on avait zoomé pour corriger.
  useEffect(() => {
    if (!entityId || feedback) return;
    questionShownAt.current = performance.now();
    setHint(null);
    setPending(null);
    setTyped('');
    if (flew.current) {
      mapRef.current?.resetView(500);
      flew.current = false;
    }
    inputRef.current?.focus();
  }, [entityId, feedback, consolidation]);

  // Fin de la manche.
  useEffect(() => {
    if (!isFinished(consolidation) || game.items.length === 0) return;
    void game.recorder.flush().then(() =>
      onFinish(summarize(exercise.id, log.current, performance.now() - startedAt.current)),
    );
  }, [consolidation]);

  const answer = (input: AnswerInput) => {
    if (!entity || feedback) return;
    const responseMs = performance.now() - questionShownAt.current;
    const evaluation = evaluateAnswer(exercise.id, entity, input, world);
    const next = submitAnswer(consolidation, evaluation.correct);
    const recorded = game.recorder.record({
      entityId: entity.id,
      skill: exercise.skill,
      mode: evaluation.mode,
      correct: evaluation.correct,
      responseMs,
      usedHint: hint !== null,
      firstAttempt: next.outcome.firstAttempt,
      answerLength: evaluation.answerLength,
      distanceKm: evaluation.distanceKm,
      typed: evaluation.typed,
    });
    log.current.push({
      entityId: entity.id,
      correct: evaluation.correct,
      firstAttempt: next.outcome.firstAttempt,
      responseMs,
      distanceKm: evaluation.distanceKm,
      masteryBefore: recorded.masteryBefore,
      masteryAfter: recorded.masteryAfter,
    });
    const click = input.kind === 'pin' ? input.lonLat : null;
    setFeedback({ evaluation, retryIn: next.outcome.retryIn, click });
    setPending(null);
    // En cas d'erreur, on montre la bonne réponse de près.
    if (!evaluation.correct) {
      const ids = [entity.id, ...(evaluation.chosenEntityId ? [evaluation.chosenEntityId] : [])];
      const points = exercise.id === 'locate-capital' && entity.capital
        ? [[entity.capital.lon, entity.capital.lat] as [number, number], ...(click ? [click] : [])]
        : [];
      if (exercise.answerMode === 'pin' || exercise.id === 'flag-to-country') {
        mapRef.current?.flyTo(ids, 650, points);
        flew.current = true;
      }
    }
    pendingState.current = next.state;
  };

  // État suivant de la consolidation, appliqué quand on passe à la question suivante.
  const pendingState = useRef<ConsolidationState | null>(null);
  const goNext = () => {
    if (!pendingState.current) return;
    const nextState = pendingState.current;
    pendingState.current = null;
    setFeedback(null);
    setConsolidation(nextState);
  };

  // Bonne réponse : on enchaîne tout seul. Erreur : on attend « Continuer », le temps de bien voir.
  useEffect(() => {
    if (!feedback) return;
    if (feedback.evaluation.correct) {
      const timer = setTimeout(goNext, AUTO_ADVANCE_MS);
      return () => clearTimeout(timer);
    }
    continueRef.current?.focus();
    return undefined;
  }, [feedback]);

  // Clic sur la carte : réponse directe à la souris, à confirmer au doigt (toucher puis valider).
  const onPick = (pick: MapPick) => {
    if (feedback || !entity) return;
    const pinExercise = exercise.answerMode === 'pin' || exercise.id === 'flag-to-country';
    if (!pinExercise) return;
    if (exercise.id !== 'locate-capital' && !pick.entityId) return; // clic dans la mer : on ignore
    if (device === 'mobile') setPending(pick);
    else answer({ kind: 'pin', entityId: pick.entityId, lonLat: pick.lonLat });
  };

  const confirmPending = () => {
    if (pending) answer({ kind: 'pin', entityId: pending.entityId, lonLat: pending.lonLat });
  };

  const giveUp = () => {
    if (exercise.answerMode === 'type') answer({ kind: 'type', text: '' });
    else if (exercise.answerMode === 'choice') answer({ kind: 'choice', entityId: '' });
    else answer({ kind: 'pin', entityId: null, lonLat: null });
  };

  const toggleAutocomplete = () => {
    const value = !autocomplete;
    setAutocomplete(value);
    void progressDb().then((db) => putSetting(db, 'autocomplete', value));
  };

  // Mise en évidence sur la carte.
  const highlights = useMemo(() => {
    const map = new Map<string, HighlightKind>();
    if (!entity) return map;
    const showsTarget = ['name-country', 'name-capital', 'country-to-flag'].includes(exercise.id);
    if (!feedback) {
      if (showsTarget) map.set(entity.id, 'target');
      if (pending?.entityId && exercise.id !== 'locate-capital') map.set(pending.entityId, 'selected');
      return map;
    }
    const chosen = feedback.evaluation.chosenEntityId;
    if (chosen && chosen !== entity.id && exercise.id !== 'country-to-flag') map.set(chosen, 'wrong');
    map.set(entity.id, feedback.evaluation.correct ? 'correct' : 'target');
    return map;
  }, [entity, exercise.id, feedback, pending]);

  const pins = useMemo<MapPin[]>(() => {
    if (exercise.id === 'locate-capital') {
      if (!feedback) return pending?.lonLat ? [{ lonLat: pending.lonLat, kind: 'selected' }] : [];
      const target: MapPin[] = entity?.capital
        ? [{ lonLat: [entity.capital.lon, entity.capital.lat], kind: feedback.evaluation.correct ? 'correct' : 'target' }]
        : [];
      const click: MapPin[] =
        feedback.click && !feedback.evaluation.correct ? [{ lonLat: feedback.click, kind: 'wrong' }] : [];
      return [...click, ...target];
    }
    // Après une question sur la capitale, on montre où elle est.
    if (exercise.id === 'name-capital' && feedback && entity?.capital) {
      return [{ lonLat: [entity.capital.lon, entity.capital.lat], kind: feedback.evaluation.correct ? 'correct' : 'target' }];
    }
    return [];
  }, [entity, exercise.id, feedback, pending]);

  const suggestions = useMemo(() => {
    if (!autocomplete || exercise.answerMode !== 'type' || feedback) return [];
    const names =
      exercise.id === 'name-capital'
        ? world.countries.flatMap((c) => (c.capital ? [c.capital.name] : []))
        : world.countries.map((c) => c.name);
    return suggest(typed, names);
  }, [autocomplete, exercise, feedback, typed, world]);

  const { solved, total } = progress(consolidation);
  const flag = entity ? flagUrl(entity.flag) : null;

  if (!entity) {
    return (
      <div class="game game--empty">
        <p>Rien à demander dans cette zone pour cet exercice.</p>
        <button type="button" class="game__button" onClick={onQuit}>
          Retour
        </button>
      </div>
    );
  }

  const retryText =
    feedback && !feedback.evaluation.correct
      ? feedback.retryIn === 0
        ? 'On le revoit tout de suite.'
        : `On le revoit dans ${feedback.retryIn} question${feedback.retryIn === 1 ? '' : 's'}.`
      : '';

  return (
    <div class="game">
      <header class="game__bar">
        <button type="button" class="game__quit" onClick={onQuit} aria-label="Quitter la manche" title="Quitter">
          ×
        </button>
        <div class="game__progress" aria-label={`${solved} réussis sur ${total}`}>
          <div class="game__progress-fill" style={{ width: `${total ? (solved / total) * 100 : 0}%` }} />
        </div>
        <span class="game__count">
          {solved} / {total}
        </span>
      </header>

      <main class="game__map" ref={mapAreaRef}>
        <WorldMapView
          world={world}
          zone={zone}
          highlights={highlights}
          pins={pins}
          insets={insets}
          onPick={onPick}
          onReady={(map) => (mapRef.current = map)}
        />

        <section class="game__prompt" aria-live="polite" ref={promptRef}>
          <Prompt exerciseId={exercise.id} entityName={entity.name} capitalName={entity.capital?.name ?? ''} flag={flag} noun={entityNoun(entity)} />
          {hint && !feedback && <p class="game__hint">💡 {hint.text}</p>}
        </section>

        <section class="game__panel" ref={panelRef}>
          {feedback ? (
            <div class={`game__feedback ${feedback.evaluation.correct ? 'is-correct' : 'is-wrong'}`} role="status">
              {exercise.id === 'country-to-flag' && flag && <img class="game__answer-flag" src={flag} alt={`Drapeau de ${entity.name}`} />}
              <p class="game__message">{feedback.evaluation.message}</p>
              {!feedback.evaluation.correct && (
                <p class="game__answer">
                  Réponse : <strong>{feedback.evaluation.answerLabel}</strong>
                </p>
              )}
              {retryText && <p class="game__retry">{retryText}</p>}
              <button type="button" class="game__button" ref={continueRef} onClick={goNext}>
                Continuer
              </button>
            </div>
          ) : (
            <>
              {exercise.answerMode === 'type' && (
                <form
                  class="game__form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (typed.trim()) answer({ kind: 'type', text: typed });
                  }}
                >
                  <input
                    ref={inputRef}
                    class="game__input"
                    value={typed}
                    onInput={(event) => setTyped(event.currentTarget.value)}
                    placeholder={exercise.id === 'name-capital' ? 'Capitale…' : 'Nom du pays…'}
                    autocomplete="off"
                    autocapitalize="sentences"
                    spellcheck={false}
                    enterKeyHint="done"
                    aria-label="Ta réponse"
                  />
                  <button type="submit" class="game__button" disabled={!typed.trim()}>
                    Valider
                  </button>
                  {suggestions.length > 0 && (
                    <ul class="game__suggestions">
                      {suggestions.map((name) => (
                        <li key={name}>
                          <button type="button" onClick={() => answer({ kind: 'type', text: name })}>
                            {name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </form>
              )}

              {exercise.answerMode === 'choice' && (
                <div class="game__choices">
                  {choices.map((id) => {
                    const url = flagUrl(world.byId.get(id)?.flag ?? null);
                    const removed = hint?.eliminate?.includes(id);
                    return (
                      <button
                        type="button"
                        key={id}
                        class="game__choice"
                        disabled={removed}
                        onClick={() => answer({ kind: 'choice', entityId: id })}
                        aria-label="Choisir ce drapeau"
                      >
                        {url && <img src={url} alt="" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {pending && (
                <div class="game__confirm">
                  {/* Surtout pas le nom du pays touché : il donnerait la réponse. */}
                  <span>{exercise.id === 'locate-capital' ? 'Ce point ?' : `Ce ${entityNoun(entity)} ?`}</span>
                  <button type="button" class="game__button" onClick={confirmPending}>
                    Valider
                  </button>
                </div>
              )}

              <div class="game__tools">
                <button type="button" class="game__link" onClick={() => setHint(hintFor(exercise.id, entity, choices))} disabled={hint !== null}>
                  Indice
                </button>
                <button type="button" class="game__link" onClick={giveUp}>
                  Je ne sais pas
                </button>
                {exercise.answerMode === 'type' && (
                  <label class="game__toggle">
                    <input type="checkbox" checked={autocomplete} onChange={toggleAutocomplete} /> Suggestions
                  </label>
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function Prompt(props: { exerciseId: string; entityName: string; capitalName: string; flag: string | null; noun: string }) {
  switch (props.exerciseId) {
    case 'locate-country':
      return (
        <>
          <p class="game__ask">Où est…</p>
          <h2 class="game__subject">{props.entityName}</h2>
        </>
      );
    case 'locate-capital':
      return (
        <>
          <p class="game__ask">Où est la capitale…</p>
          <h2 class="game__subject">{props.capitalName}</h2>
        </>
      );
    case 'name-country':
      return <h2 class="game__subject game__subject--small">Quel est ce {props.noun} ?</h2>;
    case 'name-capital':
      return (
        <>
          <p class="game__ask">Capitale de…</p>
          <h2 class="game__subject">{props.entityName}</h2>
        </>
      );
    case 'flag-to-country':
      return (
        <>
          {props.flag && <img class="game__flag" src={props.flag} alt="Drapeau à reconnaître" />}
          <p class="game__ask">Quel {props.noun} ? Tape son nom ou clique sur la carte.</p>
        </>
      );
    default:
      return (
        <>
          <p class="game__ask">Drapeau de…</p>
          <h2 class="game__subject">{props.entityName}</h2>
        </>
      );
  }
}
