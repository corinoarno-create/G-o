// Écran de découverte en 3 temps : Observer (on regarde chaque élément sur la carte), Reconnaître
// (un QCM à 4 propositions), puis Retrouver (la vraie manche, lancée par l'application).
// Rien n'est enregistré dans la mémoire (FSRS) avant l'étape Retrouver.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SUBREGION_LABELS } from '../data/labels.ts';
import { flagUrl } from '../data/flags.ts';
import type { CountryEntity } from '../data/types.ts';
import type { WorldData } from '../data/world.ts';
import { entityNoun } from '../game/exercises.ts';
import type { HighlightKind, MapInsets, MapLabel, MapPin, WorldMap } from '../map/world-map.ts';
import { WorldMapView } from '../map/WorldMapView.tsx';
import { CloseIcon, CompassRose, PushPin } from '../ui/icons.tsx';
import type { PreparedDiscovery } from './start.ts';
import { buildChoices, choiceLabel, discoveryFamily, nextQueue, recognizeQuestion, type DiscoveryPhase } from './discovery.ts';
import '../game/game.css';
import './discovery.css';

interface Props {
  world: WorldData;
  discovery: PreparedDiscovery;
  /** Les deux premières étapes sont finies : on lance la vraie manche. */
  onDone: () => void;
  onQuit: () => void;
}

const capitalOf = (entity: CountryEntity): [number, number] | null => (entity.capital ? [entity.capital.lon, entity.capital.lat] : null);

export function DiscoveryScreen({ world, discovery, onDone, onQuit }: Props) {
  const { exercise, zone } = discovery;
  const family = discoveryFamily(exercise);
  const group = useMemo(
    () => discovery.entityIds.map((id) => world.byId.get(id)).filter((e): e is CountryEntity => e !== undefined),
    [discovery, world],
  );
  const [phase, setPhase] = useState<DiscoveryPhase>('observe');
  const [index, setIndex] = useState(0);
  const [queue, setQueue] = useState<string[]>([]);
  /** Proposition ratée : on montre la bonne, puis « Continuer ». */
  const [missed, setMissed] = useState<string | null>(null);
  const [success, setSuccess] = useState(0);

  const mapRef = useRef<WorldMap | null>(null);
  const mapAreaRef = useRef<HTMLElement>(null);
  const promptRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const [insets, setInsets] = useState<MapInsets | undefined>(undefined);

  // Place prise par la carte de question et le panneau (comme en jeu).
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

  const observed = group[index];
  const asked = phase === 'recognize' ? world.byId.get(queue[0] ?? '') : undefined;
  const question = asked ? recognizeQuestion(exercise, asked) : null;

  // Propositions fixées par élément, pour qu'un nouvel essai montre les mêmes.
  const choicesCache = useRef(new Map<string, string[]>());
  const choices = useMemo(() => {
    if (!asked) return [];
    let cached = choicesCache.current.get(asked.id);
    if (!cached) {
      const pool = question?.choiceKind === 'capital' ? world.countries.filter((c) => c.capital) : world.countries;
      cached = buildChoices(asked, group, pool);
      choicesCache.current.set(asked.id, cached);
    }
    return cached;
  }, [asked, group, world, question?.choiceKind]);

  // Cadrage : chaque élément observé (avec un peu de voisinage), puis tout le groupe pour le QCM.
  useEffect(() => {
    if (!insets) return undefined;
    const timer = setTimeout(() => {
      const map = mapRef.current;
      if (!map) return;
      if (phase === 'observe' && observed) {
        const capital = family === 'capital' ? capitalOf(observed) : null;
        map.flyTo([observed.id], 700, capital ? [capital] : [], 220);
      } else if (phase === 'recognize' && asked && question) {
        // L'élément est montré sur la carte : on le cadre comme à l'étape Observer (une petite île
        // se perdrait dans une vue d'ensemble). Sinon (un drapeau), vue d'ensemble du groupe.
        if (question.highlight || question.pin) map.flyTo([asked.id], 700, question.pin ? [question.pin] : [], 220);
        else
          map.flyTo(
            group.map((e) => e.id),
            700,
            [],
            220,
          );
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [phase, index, asked?.id, insets?.top, insets?.bottom]);

  useEffect(() => {
    if (missed) continueRef.current?.focus();
  }, [missed]);

  // Le tampon « Validé ! » s'efface tout seul.
  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(0), 900);
    return () => clearTimeout(timer);
  }, [success]);

  const startRecognize = () => {
    // On ne commence pas par le dernier élément observé, encore tout frais.
    const order = [...group.map((e) => e.id)].sort(() => Math.random() - 0.5);
    if (order.length > 1 && order[0] === observed?.id) order.push(order.shift()!);
    setQueue(order);
    setPhase('recognize');
  };

  const next = () => {
    if (index < group.length - 1) setIndex(index + 1);
    else startRecognize();
  };

  const choose = (id: string) => {
    if (!asked || missed) return;
    if (id === asked.id) {
      setSuccess(Date.now());
      const rest = nextQueue(queue, true);
      if (rest.length === 0) onDone();
      else setQueue(rest);
    } else {
      setMissed(id);
    }
  };

  const continueAfterMiss = () => {
    setMissed(null);
    setQueue((current) => nextQueue(current, false));
  };

  // Clavier : flèches pour Observer, 1 à 4 pour Reconnaître, Entrée pour continuer.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (phase === 'observe') {
        if (event.key === 'ArrowRight' || event.key === 'Enter') {
          event.preventDefault();
          next();
        } else if (event.key === 'ArrowLeft' && index > 0) setIndex(index - 1);
      } else if (!missed) {
        const choice = choices[Number(event.key) - 1];
        if (choice) choose(choice);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Ce que montre la carte.
  const highlights = useMemo(() => {
    const map = new Map<string, HighlightKind>();
    if (phase === 'observe' && observed) map.set(observed.id, 'target');
    if (question?.highlight) map.set(question.highlight, 'target');
    if (missed && asked && question?.choiceKind === 'country') {
      map.set(missed, 'wrong');
      map.set(asked.id, 'correct');
    }
    return map;
  }, [phase, observed, question, missed, asked]);

  const pins = useMemo<MapPin[]>(() => {
    if (phase === 'observe' && observed && family === 'capital') {
      const capital = capitalOf(observed);
      return capital ? [{ lonLat: capital, kind: 'target' }] : [];
    }
    return question?.pin ? [{ lonLat: question.pin, kind: 'target' }] : [];
  }, [phase, observed, question, family]);

  // Étiquettes : l'élément observé en grand, ceux déjà vus en petit, pour les situer les uns par rapport aux autres.
  const labels = useMemo<MapLabel[]>(() => {
    if (phase !== 'observe') return [];
    return group.slice(0, index + 1).map((entity, i) => {
      const capital = family === 'capital' ? capitalOf(entity) : null;
      return {
        lonLat: capital ?? entity.anchor,
        text: family === 'capital' ? (entity.capital?.name ?? entity.name) : entity.name,
        kind: i === index ? 'current' : 'seen',
      };
    });
  }, [phase, index, group, family]);

  if (group.length === 0) {
    return (
      <div class="game game--empty">
        <p>Tu as déjà tout découvert ici. Bravo !</p>
        <button type="button" class="btn btn--teal" onClick={onQuit}>
          Retour
        </button>
      </div>
    );
  }

  const flagOf = (entity: CountryEntity) => flagUrl(entity.flag);

  return (
    <div class="game discovery">
      <header class="game__bar">
        <button type="button" class="game__quit" onClick={onQuit} aria-label="Quitter la découverte" title="Quitter">
          <CloseIcon />
        </button>
        <ol class="discovery__steps" aria-label="Étapes">
          <li class={phase === 'observe' ? 'is-active' : 'is-done'}>Observer</li>
          <li class={phase === 'recognize' ? 'is-active' : ''}>Reconnaître</li>
          <li>Retrouver</li>
        </ol>
        <span class="game__count">
          {phase === 'observe' ? `${index + 1} / ${group.length}` : `${group.length - queue.length} / ${group.length}`}
        </span>
      </header>

      <main class="game__map" ref={mapAreaRef}>
        <WorldMapView
          world={world}
          zone={zone}
          highlights={highlights}
          pins={pins}
          labels={labels}
          insets={insets}
          onReady={(map) => (mapRef.current = map)}
        />
        <CompassRose />

        <section class="game__prompt" aria-live="polite" ref={promptRef}>
          <PushPin />
          {phase === 'observe' && observed ? (
            <ObserveCard entity={observed} family={family} flag={flagOf(observed)} />
          ) : question && asked ? (
            <>
              {question.showFlag && flagOf(asked) && <img class="game__flag" src={flagOf(asked)!} alt="Drapeau à reconnaître" />}
              <p class="game__ask">{question.ask}</p>
              {question.subject && <h2 class="game__subject">{question.subject}</h2>}
            </>
          ) : null}
        </section>

        {success > 0 && (
          <div class="game__stamp" key={success} role="status">
            <span class="game__stamp-mark">Validé !</span>
          </div>
        )}

        <section class="game__panel" ref={panelRef}>
          {phase === 'observe' ? (
            <div class="discovery__nav">
              <button type="button" class="btn-ghost" onClick={() => setIndex(index - 1)} disabled={index === 0}>
                Précédent
              </button>
              <span class="discovery__dots" aria-hidden="true">
                {group.map((entity, i) => (
                  <span key={entity.id} class={i === index ? 'is-current' : i < index ? 'is-seen' : ''} />
                ))}
              </span>
              <button type="button" class="btn btn--terracotta" onClick={next}>
                {index < group.length - 1 ? 'Suivant' : 'Je les reconnais ?'}
              </button>
            </div>
          ) : asked && question ? (
            <>
              <p class="discovery__help">
                {missed ? 'Pas tout à fait : la bonne réponse est en vert.' : 'Choisis parmi ces propositions.'}
              </p>
              <div class={`discovery__choices ${question.choiceKind === 'flag' ? 'is-flags' : ''}`}>
                {choices.map((id, i) => {
                  const state = missed ? (id === asked.id ? 'is-correct' : id === missed ? 'is-wrong' : 'is-faded') : '';
                  const flag = question.choiceKind === 'flag' ? flagUrl(world.byId.get(id)?.flag ?? null) : null;
                  return (
                    <button
                      type="button"
                      key={id}
                      class={`discovery__choice ${state}`}
                      onClick={() => choose(id)}
                      disabled={missed !== null}
                    >
                      {flag ? (
                        <img src={flag} alt={`Drapeau ${i + 1}`} />
                      ) : (
                        <>
                          <span class="discovery__key">{i + 1}</span> {choiceLabel(world, id, question.choiceKind)}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
              {missed && (
                <button type="button" class="btn btn--terracotta discovery__continue" ref={continueRef} onClick={continueAfterMiss}>
                  Continuer
                </button>
              )}
            </>
          ) : null}
        </section>
      </main>
    </div>
  );
}

/** Fiche de l'élément observé : son nom, et selon l'exercice sa capitale ou son drapeau. */
function ObserveCard({ entity, family, flag }: { entity: CountryEntity; family: string; flag: string | null }) {
  const region = SUBREGION_LABELS[entity.subregion];
  if (family === 'capital') {
    return (
      <>
        <p class="game__ask">Observe · capitale</p>
        <h2 class="game__subject">{entity.capital?.name}</h2>
        <p class="discovery__detail">
          {entityNoun(entity) === 'pays' ? 'Pays' : 'Territoire'} : <strong>{entity.name}</strong>
        </p>
      </>
    );
  }
  if (family === 'flag') {
    return (
      <>
        {flag && <img class="game__flag" src={flag} alt={`Drapeau de ${entity.name}`} />}
        <h2 class="game__subject game__subject--small">{entity.name}</h2>
      </>
    );
  }
  return (
    <>
      <p class="game__ask">Observe · {region}</p>
      <h2 class="game__subject">{entity.name}</h2>
    </>
  );
}
