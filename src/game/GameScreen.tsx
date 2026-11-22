// Écran de jeu : une question à la fois, réponse par clic, saisie ou choix.
//
// Déroulé d'une question :
// - bonne réponse → validée tout de suite (en saisie, dès que le nom est juste) et on enchaîne ;
// - erreur → on réessaie avec un indice qui se précise (zoom sur la région puis les voisins, lettres, drapeau retiré) ;
// - après le dernier essai, ou sur « Je ne sais pas » → la réponse s'affiche en vert, on clique « Continuer ».
// Une question ratée au premier essai revient plus tard dans la manche (boucle de consolidation),
// et seule la toute première réponse à un élément met à jour la mémoire (FSRS).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { flagUrl } from '../data/flags.ts';
import type { WorldData } from '../data/world.ts';
import { createConsolidation, currentItem, isFinished, progress, submitAnswer, type ConsolidationState } from '../engine/consolidation.ts';
import type { AnswerMode } from '../engine/grading.ts';
import { cardKey, masteryOf, type MasteryLevel } from '../engine/srs.ts';
import { suggest } from '../engine/text-match.ts';
import { detectDevice } from '../lib/device.ts';
import type { HighlightKind, MapInsets, MapLabel, MapLine, MapPick, MapPin, WorldMap } from '../map/world-map.ts';
import { WorldMapView } from '../map/WorldMapView.tsx';
import { getSetting, putSetting } from '../storage/db.ts';
import { progressDb } from '../storage/progress-db.ts';
import { capitalAnchors, pendingCapitalEntities } from './anchors.ts';
import { entityNoun, EXERCISES, hasOwnFlag, hintFor, MAX_TRIES, showFrame, type Hint, type HintLevel } from './exercises.ts';
import { parseQuestionKey, questionKey } from './questions.ts';
import { seededRng } from './selection.ts';
import {
  buildFlagChoices,
  evaluateAnswer,
  isExactTypedAnswer,
  summarize,
  type AnswerInput,
  type Evaluation,
  type SessionLogEntry,
  type SessionSummary,
} from './session.ts';
import type { PreparedGame } from './start.ts';
import { BulbIcon, CloseIcon, CompassRose, PlaneIcon, PushPin } from '../ui/icons.tsx';
import './game.css';

/** Durée d'affichage du « ✓ » et du vert sur la carte après une bonne réponse (ms). */
const SUCCESS_FLASH_MS = 1200;

/** Exercices où l'élément demandé est montré sur la carte (on peut donc zoomer dessus sans rien dévoiler). */
const SHOWS_TARGET = new Set(['name-country', 'name-capital', 'country-to-flag']);

/** Exercices sur les capitales : la bonne capitale est pointée sur la carte une fois la réponse donnée. */
const CAPITAL_EXERCISES = new Set(['locate-capital', 'capital-to-country', 'name-capital']);

/**
 * Exercices de placement au plus près (jugés à la distance) : la carte montre des capitales voisines pour s'y
 * retrouver, de moins en moins à mesure que l'élément est retenu. Pas de fleuves ni de limites intérieures :
 * essayés le 22/11/2026, ils brouillaient la carte et ralentissaient le zoom (décision d'Arno).
 */
const PLACEMENT_EXERCISES = new Set(['locate-capital']);

const formatKm = (km: number) => `${Math.round(km).toLocaleString('fr-FR')} km`;

interface Props {
  world: WorldData;
  game: PreparedGame;
  onFinish: (summary: SessionSummary) => void;
  onQuit: () => void;
}

/** Réponse dévoilée (après le dernier essai ou « Je ne sais pas »), en attente de « Continuer ». */
interface Reveal {
  evaluation: Evaluation;
  retryIn: number | null;
  click: [number, number] | null;
}

/**
 * Cadrage de la carte demandé pendant une question (indice, réponse dévoilée). Il est lié à l'état de la
 * manche où il a été demandé : à la question suivante, il ne vaut plus.
 */
interface Frame {
  state: ConsolidationState;
  ids: string[];
  points: [number, number][];
  /** Étendue minimale du cadrage (km). */
  minKm: number;
}

/** Ce que la première réponse à la question a enregistré (pour le bilan). */
interface FirstTry {
  responseMs: number;
  mode: AnswerMode;
  usedHint: boolean;
  distanceKm?: number;
  masteryBefore?: MasteryLevel;
  masteryAfter?: MasteryLevel;
}

export function GameScreen({ world, game, onFinish, onQuit }: Props) {
  const zone = game.zone;
  const device = useMemo(() => detectDevice(), []);
  const [consolidation, setConsolidation] = useState<ConsolidationState>(() => createConsolidation(game.questions.map(questionKey)));
  // État de la question en cours.
  const [tries, setTries] = useState(0);
  const [hintLevel, setHintLevel] = useState<0 | HintLevel>(0);
  const [hint, setHint] = useState<Hint | null>(null);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [usedHint, setUsedHint] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [wrongMark, setWrongMark] = useState<{ entityId: string | null; lonLat: [number, number] | null } | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [pending, setPending] = useState<MapPick | null>(null);
  const [typed, setTyped] = useState('');
  // Retour d'une bonne réponse, affiché pendant que la question suivante commence.
  const [success, setSuccess] = useState<{
    key: number;
    text: string;
    entityId: string;
    pin: [number, number] | null;
    /** Placer une capitale : pointillé de mon clic jusqu'à la capitale. */
    line: MapLine | null;
  } | null>(null);
  const [autocomplete, setAutocomplete] = useState(game.autocomplete);
  // Points d'ancrage (capitales voisines) : réglage mémorisé, affichés par défaut.
  const [landmarksOn, setLandmarksOn] = useState(true);
  useEffect(() => {
    void progressDb()
      .then((db) => getSetting(db, 'landmarks', true))
      .then(setLandmarksOn);
  }, []);

  const log = useRef<SessionLogEntry[]>([]);
  const startedAt = useRef(performance.now());
  const questionShownAt = useRef(performance.now());
  const firstTry = useRef<FirstTry | null>(null);
  const pendingState = useRef<ConsolidationState | null>(null);
  const mapRef = useRef<WorldMap | null>(null);
  const flew = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const mapAreaRef = useRef<HTMLElement>(null);
  const promptRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [insets, setInsets] = useState<MapInsets | undefined>(undefined);
  const [frame, setFrame] = useState<Frame | null>(null);

  // Place prise par la question et le panneau de réponse, mesurée au début et quand l'écran change de taille.
  useLayoutEffect(() => {
    const area = mapAreaRef.current;
    if (!area) return undefined;
    const measure = () => {
      const prompt = promptRef.current;
      const panel = panelRef.current;
      if (!prompt || !panel) return;
      setInsets({ top: prompt.offsetTop + prompt.offsetHeight + 8, bottom: area.clientHeight - panel.offsetTop + 8 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  // Question en cours : un élément et un exercice (une manche peut mélanger les exercices).
  const itemKey = currentItem(consolidation);
  const question = itemKey ? parseQuestionKey(itemKey) : null;
  const exercise = EXERCISES[question?.exercise ?? 'locate-country'];
  const entity = question ? world.byId.get(question.entityId) : undefined;
  const maxTries = MAX_TRIES[exercise.answerMode];
  // Manche qui enchaîne plusieurs exercices (révisions du jour) : on affiche l'exercice en cours.
  const mixed = useMemo(() => new Set(game.questions.map((q) => q.exercise)).size > 1, [game]);
  const placement = PLACEMENT_EXERCISES.has(exercise.id);
  const showLandmarks = placement && landmarksOn;

  // Points d'ancrage : quelques capitales voisines, d'autant moins que la capitale demandée est retenue
  // (fixés au début de la question). Pas dans un défi : tous les joueurs doivent avoir la même carte.
  const anchors = useMemo(() => {
    if (!showLandmarks || !entity || game.challenge) return [];
    const record = game.recorder.cards.get(cardKey(entity.id, exercise.skill));
    const mastery = record ? masteryOf(record.card) : 'new';
    return capitalAnchors(world, entity, mastery, pendingCapitalEntities(consolidation.queue));
  }, [consolidation, showLandmarks, entity, exercise.skill]);
  const anchorLabels = useMemo<MapLabel[]>(() => anchors.map((a) => ({ lonLat: a.lonLat, text: a.name, kind: 'anchor' })), [anchors]);

  // Propositions de drapeaux : fixées par question, pour qu'un nouvel essai montre les mêmes.
  const flagPool = useMemo(() => world.countries.filter(hasOwnFlag), [world]);
  const choicesCache = useRef(new Map<string, string[]>());
  const choices = useMemo(() => {
    if (exercise.id !== 'country-to-flag' || !entity || !itemKey) return [];
    let cached = choicesCache.current.get(itemKey);
    if (!cached) {
      // Dans un défi, les propositions sont les mêmes pour tous les joueurs.
      cached = buildFlagChoices(entity, flagPool, game.challenge ? seededRng(`${game.challenge.id}|${itemKey}`) : Math.random);
      choicesCache.current.set(itemKey, cached);
    }
    return cached;
  }, [exercise.id, entity, itemKey, flagPool]);

  // Nouvelle question : on remet tout à zéro, puis on cadre la carte.
  useEffect(() => {
    if (!itemKey || !entity) return;
    questionShownAt.current = performance.now();
    firstTry.current = null;
    setTries(0);
    setHintLevel(0);
    setHint(null);
    setEliminated([]);
    setUsedHint(false);
    setNotice(null);
    setWrongMark(null);
    setPending(null);
    setTyped('');
    inputRef.current?.focus();
  }, [consolidation]);

  // Cadrage de la carte : celui demandé pendant la question (indice, réponse dévoilée), sinon celui de la
  // question (l'élément montré, ou la zone entière). Il est réappliqué quand la place des panneaux change :
  // la carte se recadre alors sur la zone, ce qui effacerait le zoom (ex. la ligne d'indice agrandit la question).
  // On laisse d'abord passer les autres effets : Preact exécute celui-ci avant celui de la carte.
  const activeFrame = frame && frame.state === consolidation ? frame : null;
  useEffect(() => {
    if (!entity || !insets) return undefined;
    const timer = setTimeout(() => {
      if (activeFrame) {
        mapRef.current?.flyTo(activeFrame.ids, 600, activeFrame.points, activeFrame.minKm);
        flew.current = true;
      } else if (SHOWS_TARGET.has(exercise.id)) {
        // L'élément est montré : on zoome dessus, avec un peu de voisinage (les petites îles deviennent visibles).
        const shown = showFrame(world, entity);
        mapRef.current?.flyTo(shown.ids, 600, shown.points, shown.minKm);
        flew.current = true;
      } else if (flew.current) {
        mapRef.current?.resetView(500);
        flew.current = false;
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [consolidation, activeFrame, insets?.top, insets?.bottom]);

  // Fin de la manche.
  useEffect(() => {
    if (!isFinished(consolidation) || game.questions.length === 0) return;
    void game.recorder.flush().then(() => onFinish(summarize(log.current, performance.now() - startedAt.current)));
  }, [consolidation]);

  // Le « ✓ » et le vert sur la carte s'effacent tout seuls.
  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(null), SUCCESS_FLASH_MS);
    return () => clearTimeout(timer);
  }, [success]);

  // Réponse dévoilée : le bouton « Continuer » prend le focus (Entrée suffit pour passer).
  useEffect(() => {
    if (reveal) continueRef.current?.focus();
  }, [reveal]);

  /** Termine la question : bilan et boucle de consolidation. Renvoie l'état suivant. */
  const resolve = (solvedFirstTime: boolean) => {
    const next = submitAnswer(consolidation, solvedFirstTime);
    const info = firstTry.current;
    log.current.push({
      exercise: exercise.id,
      entityId: entity!.id,
      correct: solvedFirstTime,
      firstAttempt: next.outcome.firstAttempt,
      responseMs: info?.responseMs ?? 0,
      distanceKm: info?.distanceKm,
      mode: info?.mode,
      usedHint: info?.usedHint,
      masteryBefore: info?.masteryBefore,
      masteryAfter: info?.masteryAfter,
    });
    return next;
  };

  /** Monte l'indice au niveau donné (il ne redescend jamais). */
  const raiseHint = (level: HintLevel) => {
    if (!entity || hintLevel >= level) return;
    const next = hintFor(exercise.id, entity, level, { world, choices, eliminated });
    setHintLevel(level);
    setHint(next);
    if (next.eliminate?.length) setEliminated((list) => [...list, ...next.eliminate!]);
    // L'indice de lieu sert aussi à rendre les petites îles cliquables : la carte zoome sur la région.
    if (next.focus?.length) setFrame({ state: consolidation, ids: next.focus, points: [], minKm: next.focusKm ?? 800 });
  };

  const answer = (input: AnswerInput, giveUp = false) => {
    if (!entity || !itemKey || reveal) return;
    const evaluation = evaluateAnswer(exercise.id, entity, input, world);
    const correct = evaluation.correct && !giveUp;
    const isFirstTry = (consolidation.attempts[itemKey] ?? 0) === 0 && tries === 0;
    const responseMs = performance.now() - questionShownAt.current;
    const recorded = game.recorder.record({
      entityId: entity.id,
      skill: exercise.skill,
      mode: evaluation.mode,
      correct,
      responseMs,
      usedHint: usedHint || hintLevel > 0,
      firstAttempt: isFirstTry,
      answerLength: evaluation.answerLength,
      distanceKm: evaluation.distanceKm,
      typed: evaluation.typed,
    });
    if (tries === 0) {
      firstTry.current = {
        responseMs,
        mode: evaluation.mode,
        usedHint: usedHint || hintLevel > 0,
        distanceKm: evaluation.distanceKm,
        ...(isFirstTry ? { masteryBefore: recorded.masteryBefore, masteryAfter: recorded.masteryAfter } : {}),
      };
    }
    setPending(null);
    const click = input.kind === 'pin' ? input.lonLat : null;

    if (correct) {
      // Validation instantanée : on enchaîne tout de suite, le « ✓ » s'affiche par-dessus.
      const next = resolve(tries === 0);
      const capitalPin =
        CAPITAL_EXERCISES.has(exercise.id) && entity.capital ? ([entity.capital.lon, entity.capital.lat] as [number, number]) : null;
      const line =
        exercise.id === 'locate-capital' && click && capitalPin && evaluation.distanceKm !== undefined
          ? { from: click, to: capitalPin, label: formatKm(evaluation.distanceKm) }
          : null;
      setSuccess({ key: Date.now(), text: evaluation.message, entityId: entity.id, pin: capitalPin, line });
      setConsolidation(next.state);
      return;
    }

    const wrongTries = tries + 1;
    if (giveUp || wrongTries >= maxTries) {
      // Plus d'essai : la réponse s'affiche en vert, on la regarde, puis « Continuer ».
      const next = resolve(false);
      pendingState.current = next.state;
      setReveal({ evaluation, retryIn: next.outcome.retryIn, click });
      setWrongMark(null);
      const ids = [entity.id, ...(evaluation.chosenEntityId ? [evaluation.chosenEntityId] : [])];
      const points =
        exercise.id === 'locate-capital' && entity.capital
          ? [[entity.capital.lon, entity.capital.lat] as [number, number], ...(click ? [click] : [])]
          : [];
      if (exercise.answerMode === 'pin' || exercise.id === 'flag-to-country') setFrame({ state: consolidation, ids, points, minKm: 1000 });
      return;
    }

    // Encore un essai : on dit ce qui a été touché, et l'indice se précise.
    setTries(wrongTries);
    setNotice(`${evaluation.message} Essaie encore !`);
    setWrongMark({ entityId: evaluation.chosenEntityId ?? null, lonLat: click });
    if (exercise.answerMode === 'choice' && evaluation.chosenEntityId) {
      setEliminated((list) => [...list, evaluation.chosenEntityId!]);
    }
    raiseHint(Math.min(wrongTries, 2) as HintLevel);
    setTyped('');
    inputRef.current?.focus();
  };

  const goNext = () => {
    if (!pendingState.current) return;
    const nextState = pendingState.current;
    pendingState.current = null;
    setReveal(null);
    setConsolidation(nextState);
  };

  // Clic sur la carte : réponse directe à la souris, à confirmer au doigt (toucher puis valider).
  const onPick = (pick: MapPick) => {
    if (reveal || !entity) return;
    const pinExercise = exercise.answerMode === 'pin' || exercise.id === 'flag-to-country';
    if (!pinExercise) return;
    if (exercise.id !== 'locate-capital' && !pick.entityId) return; // clic dans la mer : on ignore
    if (device === 'mobile') setPending(pick);
    else answer({ kind: 'pin', entityId: pick.entityId, lonLat: pick.lonLat });
  };

  const giveUp = () => {
    if (exercise.answerMode === 'type') answer({ kind: 'type', text: '' }, true);
    else if (exercise.answerMode === 'choice') answer({ kind: 'choice', entityId: '' }, true);
    else answer({ kind: 'pin', entityId: null, lonLat: null }, true);
  };

  const askHint = () => {
    setUsedHint(true);
    raiseHint(hintLevel === 0 ? 1 : 2);
  };

  const onType = (value: string) => {
    setTyped(value);
    // Validation instantanée : dès que le nom est exactement juste, c'est validé.
    if (entity && isExactTypedAnswer(exercise.id, entity, value, world)) answer({ kind: 'type', text: value });
  };

  const toggleLandmarks = () => {
    const value = !landmarksOn;
    setLandmarksOn(value);
    void progressDb().then((db) => putSetting(db, 'landmarks', value));
  };

  const toggleAutocomplete = () => {
    const value = !autocomplete;
    setAutocomplete(value);
    void progressDb().then((db) => putSetting(db, 'autocomplete', value));
  };

  // Couleurs sur la carte : doré = élément demandé, bleu = sélection, rouge = erreur, vert = bonne réponse.
  const highlights = useMemo(() => {
    const map = new Map<string, HighlightKind>();
    if (success) map.set(success.entityId, 'correct');
    if (!entity) return map;
    if (reveal) {
      const chosen = reveal.evaluation.chosenEntityId;
      if (chosen && chosen !== entity.id && exercise.id !== 'country-to-flag') map.set(chosen, 'wrong');
      map.set(entity.id, 'correct');
      return map;
    }
    if (SHOWS_TARGET.has(exercise.id)) map.set(entity.id, 'target');
    // 2e indice d'une capitale à placer : son pays est montré.
    if (hint?.outline) map.set(hint.outline, 'target');
    if (wrongMark?.entityId && wrongMark.entityId !== entity.id && exercise.id !== 'country-to-flag') {
      map.set(wrongMark.entityId, 'wrong');
    }
    if (pending?.entityId && exercise.id !== 'locate-capital') map.set(pending.entityId, 'selected');
    return map;
  }, [entity, exercise.id, reveal, pending, wrongMark, success, hint]);

  const pins = useMemo<MapPin[]>(() => {
    const list: MapPin[] = anchors.map((a) => ({ lonLat: a.lonLat, kind: 'anchor' }));
    if (success?.pin) list.push({ lonLat: success.pin, kind: 'correct' });
    const capital = entity?.capital ? ([entity.capital.lon, entity.capital.lat] as [number, number]) : null;
    if (reveal) {
      if (exercise.id === 'locate-capital' && reveal.click) list.push({ lonLat: reveal.click, kind: 'wrong' });
      if (capital && CAPITAL_EXERCISES.has(exercise.id)) list.push({ lonLat: capital, kind: 'correct' });
      return list;
    }
    if (exercise.id === 'locate-capital') {
      if (wrongMark?.lonLat) list.push({ lonLat: wrongMark.lonLat, kind: 'wrong' });
      if (pending?.lonLat) list.push({ lonLat: pending.lonLat, kind: 'selected' });
    }
    return list;
  }, [entity, exercise.id, reveal, pending, wrongMark, success, anchors]);

  // Placer une capitale : un pointillé se dessine de mon clic jusqu'à la vraie position (jamais avant la fin
  // de la question, sinon il donnerait la réponse).
  const lines = useMemo<MapLine[]>(() => {
    if (success?.line) return [success.line];
    const capital = entity?.capital;
    if (reveal && exercise.id === 'locate-capital' && reveal.click && capital) {
      const distance = reveal.evaluation.distanceKm;
      return [{ from: reveal.click, to: [capital.lon, capital.lat], label: distance !== undefined ? formatKm(distance) : undefined }];
    }
    return [];
  }, [success, reveal, entity, exercise.id]);

  const suggestions = useMemo(() => {
    if (!autocomplete || exercise.answerMode !== 'type' || reveal) return [];
    const names =
      exercise.id === 'name-capital'
        ? world.countries.flatMap((c) => (c.capital ? [c.capital.name] : []))
        : world.countries.map((c) => c.name);
    return suggest(typed, names);
  }, [autocomplete, exercise, reveal, typed, world]);

  const { solved, total } = progress(consolidation);
  const flag = entity ? flagUrl(entity.flag) : null;

  if (!entity) {
    return (
      <div class="game game--empty">
        <p>{game.questions.length === 0 ? 'Rien à demander pour l’instant.' : 'Manche terminée !'}</p>
        <button type="button" class="btn btn--teal" onClick={onQuit}>
          Retour
        </button>
      </div>
    );
  }

  const retryText = reveal
    ? reveal.retryIn === 0
      ? 'On le revoit tout de suite.'
      : `On le revoit dans ${reveal.retryIn} question${reveal.retryIn === 1 ? '' : 's'}.`
    : '';

  return (
    <div class="game">
      <header class="game__bar">
        <button type="button" class="game__quit" onClick={onQuit} aria-label="Quitter la manche" title="Quitter">
          <CloseIcon />
        </button>
        <Route solved={solved} total={total} />
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
          lines={lines}
          magnify
          markerIds={SHOWS_TARGET.has(exercise.id) && entity ? [entity.id] : null}
          insets={insets}
          labels={anchorLabels}
          onPick={onPick}
          onReady={(map) => (mapRef.current = map)}
        />

        <CompassRose />

        <section class="game__prompt" aria-live="polite" ref={promptRef}>
          <PushPin />
          {mixed && (
            <p class="game__step" key={exercise.id}>
              {exercise.label}
            </p>
          )}
          <Prompt
            exerciseId={exercise.id}
            entityName={entity.name}
            capitalName={entity.capital?.name ?? ''}
            flag={flag}
            noun={entityNoun(entity)}
          />
          {hint && !reveal && (
            <p class="game__hint">
              <BulbIcon size={20} /> {hint.text}
            </p>
          )}
        </section>

        {success && (
          <div class="game__stamp" key={success.key} role="status">
            <span class="game__stamp-mark">Validé !</span>
            <span class="game__stamp-text">{success.text}</span>
          </div>
        )}

        <section class="game__panel" ref={panelRef}>
          {reveal ? (
            <div class="game__feedback" role="status">
              {exercise.id === 'country-to-flag' && flag && <img class="game__answer-flag" src={flag} alt={`Drapeau de ${entity.name}`} />}
              <p class="game__answer">
                Réponse : <strong>{reveal.evaluation.answerLabel}</strong>
              </p>
              <p class="game__retry">{retryText}</p>
              <button type="button" class="btn btn--terracotta" ref={continueRef} onClick={goNext}>
                Continuer
              </button>
            </div>
          ) : (
            <>
              {notice && (
                <p class="game__notice" role="status">
                  {notice}
                </p>
              )}

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
                    onInput={(event) => onType(event.currentTarget.value)}
                    placeholder={exercise.id === 'name-capital' ? 'Capitale…' : 'Nom du pays…'}
                    autocomplete="off"
                    autocapitalize="sentences"
                    spellcheck={false}
                    enterKeyHint="done"
                    aria-label="Ta réponse"
                  />
                  <button type="submit" class="btn btn--teal" disabled={!typed.trim()}>
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
                    return (
                      <button
                        type="button"
                        key={id}
                        class="game__choice"
                        disabled={eliminated.includes(id)}
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
                  <button
                    type="button"
                    class="btn btn--teal"
                    onClick={() => answer({ kind: 'pin', entityId: pending.entityId, lonLat: pending.lonLat })}
                  >
                    Valider
                  </button>
                </div>
              )}

              <div class="game__tools">
                <button type="button" class="btn btn--gold" onClick={askHint} disabled={hintLevel >= 2}>
                  <BulbIcon /> {hintLevel === 0 ? 'Indice' : 'Encore un indice'}
                </button>
                <button type="button" class="btn-ghost" onClick={giveUp}>
                  Je ne sais pas
                </button>
                {tries > 0 && (
                  <span class="game__tries">
                    essai {tries + 1} sur {maxTries}
                  </span>
                )}
                {placement && (
                  <label class="game__toggle" title="Capitales voisines, pour se repérer">
                    <input type="checkbox" checked={landmarksOn} onChange={toggleLandmarks} /> Repères
                  </label>
                )}
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

/** Itinéraire de la manche : une escale par élément (une barre au-delà de 20). */
function Route({ solved, total }: { solved: number; total: number }) {
  const label = `${solved} réussis sur ${total}`;
  if (total > 20) {
    const percent = total ? (solved / total) * 100 : 0;
    return (
      <div class="game__route game__route--bar" role="img" aria-label={label}>
        <div class="game__track">
          <div class="game__track-fill" style={{ width: `${percent}%` }} />
          <span class="game__plane" style={{ left: `${percent}%` }}>
            <PlaneIcon />
          </span>
        </div>
      </div>
    );
  }
  return (
    <div class="game__route" role="img" aria-label={label}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} class={`game__stop ${index < solved ? 'is-done' : index === solved ? 'is-current' : ''}`}>
          {index === solved && <PlaneIcon />}
        </span>
      ))}
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
    case 'capital-to-country':
      return (
        <>
          <p class="game__ask">Dans quel pays est…</p>
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
