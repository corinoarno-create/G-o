// Accueil (§ 7) : deux portes.
// - Révision : l'app choisit ce que je dois revoir aujourd'hui (FSRS).
// - Mon carnet de voyage : la carte de conquête (les pays se colorent quand je les maîtrise) et une case
//   par région ; une région ouvre sa fiche (progression, puis Jouer ou Découvrir). Sur PC, la fiche
//   s'ouvre à côté du carnet ; sur téléphone, en page entière.
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { WorldData } from '../data/world.ts';
import type { AnswerMode, TimingStats } from '../engine/grading.ts';
import { loadCards, type GameRequest } from '../game/start.ts';
import { detectDevice } from '../lib/device.ts';
import type { MapFill, MapPick } from '../map/world-map.ts';
import { WorldMapView } from '../map/WorldMapView.tsx';
import type { Zone } from '../map/zones.ts';
import { installApp, usePwa } from '../pwa/pwa.ts';
import { BackupButtons } from '../sandbox/BackupButtons.tsx';
import { SyncPanel } from '../sync/SyncPanel.tsx';
import { useSync } from '../sync/sync.ts';
import { useChallengeNews } from '../challenge/challenges.ts';
import '../challenge/challenge.css';
import { getTiming } from '../storage/db.ts';
import { progressDb } from '../storage/progress-db.ts';
import type { CardRecord } from '../storage/schema.ts';
import { ArrowIcon, BookIcon, ChartIcon, CompassLogo, GlobeIcon, MapIcon, TrophyIcon } from '../ui/icons.tsx';
import { buildHomeSummary, formatWhen, type HomeSummary } from './summary.ts';
import { percent } from './zone-stats.ts';
import { ZoneSheet } from './ZoneSheet.tsx';
import './home.css';

interface Props {
  world: WorldData;
  zones: Zone[];
  onPlay: (request: GameRequest) => void;
  /** Ouvre la carte libre (« Explorer »). */
  onExplore: () => void;
  /** Ouvre la page « Ma progression ». */
  onProgress: () => void;
  /** Ouvre la page « Crédits ». */
  onCredits: () => void;
  /** Ouvre la page « Mes défis ». */
  onChallenges: () => void;
}

/** « Bonjour Arno ! » : le prénom vient du compte Google lié (sans compte, pas de prénom). */
function greeting(now: Date, firstName: string | null): string {
  const hour = now.getHours();
  const hello = hour < 5 || hour >= 19 ? 'Bonsoir' : 'Bonjour';
  return firstName ? `${hello} ${firstName} !` : `${hello} !`;
}

/** Aquarelle de chaque continent (variables de styles.css). */
const WATERCOLOR: Record<string, string> = {
  africa: 'var(--wc-africa)',
  americas: 'var(--wc-americas)',
  asia: 'var(--wc-asia)',
  europe: 'var(--wc-europe)',
  oceania: 'var(--wc-oceania)',
  antarctica: 'var(--wc-antarctica)',
};

/** Largeur à partir de laquelle la fiche d'une région s'ouvre à côté du carnet. */
const WIDE_QUERY = '(min-width: 1000px)';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const onChange = () => setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/**
 * Région ouverte, gardée le temps de la visite : après une manche lancée depuis une fiche,
 * on retrouve cette fiche en revenant à l'accueil.
 */
let rememberedTile: string | null = null;

export function HomeScreen({ world, zones, onPlay, onExplore, onProgress, onCredits, onChallenges }: Props) {
  const { installable } = usePwa();
  const { firstName, phase } = useSync();
  const news = useChallengeNews();
  // Les défis demandent un compte : sans synchronisation configurée, on ne les montre pas.
  const challengesAvailable = phase !== 'unavailable';
  const wide = useMediaQuery(WIDE_QUERY);
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [cards, setCards] = useState<Map<string, CardRecord> | null>(null);
  const [openTile, setOpenTile] = useState<string | null>(rememberedTile);
  const now = new Date();

  useEffect(() => {
    void (async () => {
      const db = await progressDb();
      const device = detectDevice();
      const modes: AnswerMode[] = ['pin', 'type', 'choice'];
      const [loadedCards, timingList] = await Promise.all([
        loadCards(),
        Promise.all(modes.map(async (mode) => [mode, await getTiming(db, device, mode)] as [AnswerMode, TimingStats])),
      ]);
      setCards(loadedCards);
      setSummary(buildHomeSummary(world, loadedCards, new Map(timingList), new Date()));
    })();
  }, [world]);

  const openRegion = (tileId: string | null) => {
    rememberedTile = tileId;
    setOpenTile(tileId);
    if (tileId && !wide) window.scrollTo({ top: 0 });
  };

  // Carte de conquête : un pays jamais travaillé reste papier ; plus il est maîtrisé, plus l'aquarelle est dense.
  const fills = useMemo(() => {
    const map = new Map<string, MapFill>();
    if (!summary) return map;
    for (const entity of world.countries) {
      const mastery = summary.entityMastery.get(entity.id) ?? 0;
      map.set(
        entity.id,
        mastery > 0
          ? { color: WATERCOLOR[entity.continent] ?? 'var(--paper-dark)', opacity: 0.3 + 0.7 * mastery }
          : { color: 'var(--paper-light)', opacity: 1 },
      );
    }
    return map;
  }, [summary, world]);

  // Toucher un pays sur la carte ouvre sa région.
  const pickOnMap = (pick: MapPick) => {
    const continent = pick.entityId ? world.byId.get(pick.entityId)?.continent : undefined;
    if (continent && zones.some((zone) => zone.id === continent)) openRegion(continent);
  };

  const progress = summary?.progress;
  const seen = progress ? progress.total - progress.new : 0;
  const overall = progress ? (progress.acquired + progress.mastered) / progress.total : 0;
  const today = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  // Sur PC, une fiche est toujours ouverte à côté du carnet (le Monde par défaut).
  const sheetTile = wide ? (openTile ?? 'world') : openTile;
  const tiles: Array<{ id: string; label: string; share: number }> = summary
    ? [...summary.continents, { id: 'world', label: 'Monde', share: overall }]
    : [];

  const sheet =
    sheetTile && cards ? (
      <ZoneSheet
        world={world}
        zones={zones}
        tileId={sheetTile}
        cards={cards}
        fills={fills}
        layout={wide ? 'panel' : 'page'}
        onPlay={onPlay}
        onClose={() => openRegion(null)}
      />
    ) : null;

  return (
    <div class="home">
      <header class="home__bar">
        <div class="home__brand">
          <CompassLogo size={44} />
          <div>
            <span class="home__logo hand">Géo</span>
            <span class="home__tagline">carnet d’explorateur</span>
          </div>
        </div>
        <nav class="home__nav" aria-label="Navigation">
          <button type="button" class="btn home__pill" onClick={onExplore}>
            <MapIcon size={18} /> Explorer la carte
          </button>
          <button type="button" class="btn home__pill" onClick={onProgress}>
            <ChartIcon size={18} /> Ma progression
          </button>
          {challengesAvailable && (
            <button type="button" class="btn home__pill" onClick={onChallenges}>
              <TrophyIcon size={18} /> Mes défis {news > 0 && <span class="news-badge">{news}</span>}
            </button>
          )}
        </nav>
      </header>

      {!wide && sheet ? (
        <main class="home__main home__main--sheet">{sheet}</main>
      ) : (
        <main class="home__main">
          <div class="home__intro">
            <h1>{greeting(now, firstName)}</h1>
            <p class="home__intro-mobile">Que veux-tu travailler ?</p>
            <p class="home__intro-desktop">{today}</p>
          </div>

          <div class="home__left">
            <section class="paper-card home__review" aria-label="Révision">
              <span class="tape tape--left" />
              <div class="home__review-head">
                <h2>Révision</h2>
                {summary && summary.due > 0 && <span>≈ {summary.estimatedMinutes} min</span>}
              </div>
              {!summary ? (
                <p class="home__loading hand">On ouvre le carnet…</p>
              ) : summary.due > 0 ? (
                <div class="home__review-body">
                  <p>
                    <strong>
                      {summary.due} élément{summary.due > 1 ? 's' : ''} à revoir
                    </strong>{' '}
                    aujourd’hui, choisis pour toi d’après ta mémoire
                    {summary.due > summary.reviewBatch ? ` (par séries de ${summary.reviewBatch})` : ''}.
                  </p>
                  <ul class="home__review-list">
                    {summary.dueByExercise.slice(0, 4).map((item) => (
                      <li key={item.exercise}>
                        <span>{item.label}</span>
                        <strong>{item.count}</strong>
                      </li>
                    ))}
                  </ul>
                  <button type="button" class="btn btn--teal btn--big home__go" onClick={() => onPlay({ kind: 'review' })}>
                    Réviser <ArrowIcon />
                  </button>
                </div>
              ) : seen > 0 ? (
                <p>
                  Tout est à jour, bravo !{summary.nextDueAt && ` Prochaine révision ${formatWhen(summary.nextDueAt, now)}.`} Envie de jouer
                  ? Choisis une région dans ton carnet.
                </p>
              ) : (
                <p>Ton carnet est encore vierge : choisis une région dans ton carnet pour découvrir tes premiers pays.</p>
              )}
            </section>

            <section class="paper-card home__carnet" aria-label="Mon carnet de voyage">
              <span class="tape tape--left" />
              <span class="tape tape--right tape--teal" />
              <div class="home__carnet-head">
                <h2>Mon carnet de voyage</h2>
                <span>{progress ? `${percent(overall)} acquis` : ''}</span>
              </div>
              <p class="home__carnet-help">Choisis une région pour voir ta progression, découvrir ou jouer.</p>
              <div class="home__map">
                <WorldMapView world={world} zone={zones[0]!} fills={fills} clickOnly onPick={pickOnMap} />
              </div>
              {progress && (
                <ul class="home__legend">
                  <li>
                    <span class="home__swatch is-mastered" /> Maîtrisé <strong>{progress.mastered}</strong>
                  </li>
                  <li>
                    <span class="home__swatch is-acquired" /> Acquis <strong>{progress.acquired}</strong>
                  </li>
                  <li>
                    <span class="home__swatch is-learning" /> En cours <strong>{progress.learning}</strong>
                  </li>
                  <li>
                    <span class="home__swatch is-new" /> À explorer <strong>{progress.new}</strong>
                  </li>
                </ul>
              )}
              <div class="home__tiles">
                {tiles.map((tile) => (
                  <button
                    type="button"
                    key={tile.id}
                    class={`home__tile is-${tile.id} ${sheetTile === tile.id ? 'is-active' : ''}`}
                    aria-pressed={sheetTile === tile.id}
                    onClick={() => openRegion(tile.id)}
                  >
                    <span class="home__tile-name hand">
                      {tile.id === 'world' && <GlobeIcon size={18} />}
                      {tile.label}
                    </span>
                    <strong>{percent(tile.share)}</strong>
                    <span class="home__tile-bar" aria-hidden="true">
                      <span style={{ width: `${Math.round(tile.share * 100)}%` }} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {wide && <div class="home__right">{sheet}</div>}

          <footer class="home__footer">
            <SyncPanel />
            <BackupButtons />
            <div class="home__footer-links">
              {installable && (
                <button type="button" class="btn btn--teal" onClick={() => void installApp()}>
                  Installer l’app
                </button>
              )}
              <button type="button" class="btn-ghost" onClick={onCredits}>
                Crédits
              </button>
            </div>
          </footer>
        </main>
      )}

      <nav class={`home__tabbar ${challengesAvailable ? 'has-4' : ''}`} aria-label="Navigation">
        <button type="button" class="is-active" aria-current="page" onClick={() => openRegion(null)}>
          <BookIcon size={24} />
          Carnet
        </button>
        <button type="button" onClick={onExplore}>
          <MapIcon size={24} />
          Explorer
        </button>
        <button type="button" onClick={onProgress}>
          <ChartIcon size={24} />
          Progression
        </button>
        {challengesAvailable && (
          <button type="button" onClick={onChallenges}>
            <span class="home__tab-icon">
              <TrophyIcon size={24} />
              {news > 0 && <span class="news-badge">{news}</span>}
            </span>
            Défis
          </button>
        )}
      </nav>
    </div>
  );
}
