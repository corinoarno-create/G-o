// Accueil (§ 7), façon carnet de voyage : la carte de conquête (les pays se colorent quand je les maîtrise)
// et, à côté, ce que je peux travailler aujourd'hui.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { modeOf, sanitizeChoice } from '../builder/options.ts';
import type { WorldData } from '../data/world.ts';
import type { AnswerMode, TimingStats } from '../engine/grading.ts';
import { loadCards, type GameRequest } from '../game/start.ts';
import { QUICK_PHRASES } from '../game/plans.ts';
import { detectDevice } from '../lib/device.ts';
import type { MapFill } from '../map/world-map.ts';
import { WorldMapView } from '../map/WorldMapView.tsx';
import type { Zone } from '../map/zones.ts';
import { BackupButtons } from '../sandbox/BackupButtons.tsx';
import { getFavorites, getTiming } from '../storage/db.ts';
import { progressDb } from '../storage/progress-db.ts';
import type { FavoriteRecord } from '../storage/schema.ts';
import { ArrowIcon, BookIcon, CompassLogo, MapIcon } from '../ui/icons.tsx';
import { buildHomeSummary, formatWhen, type HomeSummary } from './summary.ts';
import './home.css';

interface Props {
  world: WorldData;
  zones: Zone[];
  onPlay: (request: GameRequest) => void;
  /** Ouvre la carte, avec ou sans le constructeur de session. */
  onExplore: (withBuilder: boolean) => void;
}

function greeting(now: Date): string {
  const hour = now.getHours();
  return hour < 5 || hour >= 19 ? 'Bonsoir Arno !' : 'Bonjour Arno !';
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

export function HomeScreen({ world, zones, onPlay, onExplore }: Props) {
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const now = new Date();

  useEffect(() => {
    void (async () => {
      const db = await progressDb();
      const device = detectDevice();
      const modes: AnswerMode[] = ['pin', 'type', 'choice'];
      const [cards, timingList, favoriteList] = await Promise.all([
        loadCards(),
        Promise.all(modes.map(async (mode) => [mode, await getTiming(db, device, mode)] as [AnswerMode, TimingStats])),
        getFavorites(db),
      ]);
      setSummary(buildHomeSummary(world, zones, cards, new Map(timingList), new Date()));
      setFavorites(favoriteList.sort((a, b) => a.name.localeCompare(b.name, 'fr')));
    })();
  }, [world, zones]);

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

  const playFavorite = (favorite: FavoriteRecord) => {
    const choice = sanitizeChoice(favorite.config);
    const zone = zones.find((z) => z.id === choice.zoneId) ?? zones[0]!;
    onPlay({ kind: 'builder', exercise: modeOf(choice).exercise, zone, count: choice.count, content: choice.content });
  };

  const progress = summary?.progress;
  const seen = progress ? progress.total - progress.new : 0;
  const explored = progress ? Math.round(((progress.acquired + progress.mastered) / progress.total) * 100) : 0;
  const today = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

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
          <button type="button" class="btn home__pill" onClick={() => onExplore(false)}>
            <MapIcon size={18} /> Explorer la carte
          </button>
        </nav>
      </header>

      <main class="home__main">
        <div class="home__intro home__intro--mobile">
          <h1>{greeting(now)}</h1>
          <p>Où partons-nous aujourd’hui ?</p>
        </div>

        <section class="paper-card tilt-left home__carnet" aria-label="Mon carnet de voyage">
          <span class="tape tape--left" />
          <span class="tape tape--right tape--teal" />
          <div class="home__carnet-head">
            <h2>Mon carnet de voyage</h2>
            <span>{progress ? `${explored} % acquis` : ''}</span>
          </div>
          <div class="home__map">
            <WorldMapView world={world} zone={zones[0]!} fills={fills} interactive={false} />
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
          {summary && (
            <div class="home__continents">
              {summary.continents.map((continent) => (
                <div key={continent.id} class={`home__continent is-${continent.id}`}>
                  <span class="hand">{continent.label}</span>
                  <strong>{Math.round(continent.share * 100)} %</strong>
                </div>
              ))}
            </div>
          )}
        </section>

        <section class="home__today" aria-label="Aujourd’hui">
          <div class="home__intro home__intro--desktop">
            <h1>{greeting(now)}</h1>
            <p>{today}</p>
          </div>

          {!summary ? (
            <p class="home__loading hand">On ouvre le carnet…</p>
          ) : (
            <>
              <div class="paper-card tilt-right home__review">
                <span class="tape tape--right" />
                <h2>Révisions du jour</h2>
                {summary.due > 0 ? (
                  <>
                    <p>
                      <strong>
                        {summary.due} escale{summary.due > 1 ? 's' : ''} à revisiter
                      </strong>{' '}
                      · environ {summary.estimatedMinutes} min
                      {summary.due > summary.reviewBatch ? ` (par séries de ${summary.reviewBatch})` : ''}
                    </p>
                    <button type="button" class="btn btn--terracotta btn--big home__go" onClick={() => onPlay({ kind: 'review' })}>
                      C’est parti ! <ArrowIcon />
                    </button>
                  </>
                ) : seen > 0 ? (
                  <p>
                    Tout est à jour, bravo !
                    {summary.nextDueAt && ` Prochaine escale ${formatWhen(summary.nextDueAt, now)}.`}
                  </p>
                ) : (
                  <p>Ton carnet est encore vierge : lance un entretien rapide ou une découverte !</p>
                )}
              </div>

              <div class="home__pair">
                <div class="paper-card home__small home__quick">
                  <h3>Entretien rapide</h3>
                  <p>10 questions pour {QUICK_PHRASES[summary.quickExercise]}.</p>
                  <button type="button" class="btn btn--teal" onClick={() => onPlay({ kind: 'quick', exercise: summary.quickExercise })}>
                    Lancer
                  </button>
                </div>
                {summary.discoveries[0] && (
                  <div class="home__small home__stamp">
                    <div class="home__stamp-head">
                      <h3>À découvrir</h3>
                      <span class="home__new">nouveau</span>
                    </div>
                    <p>
                      <strong>
                        {summary.discoveries[0].categoryLabel} · {summary.discoveries[0].zone.label}
                      </strong>{' '}
                      — {summary.discoveries[0].unseen} à découvrir, 5 par 5 : observer, reconnaître, retrouver
                    </p>
                    <button
                      type="button"
                      class="btn btn--gold"
                      onClick={() =>
                        onPlay({
                          kind: 'discovery',
                          exercise: summary.discoveries[0]!.exercise,
                          zone: summary.discoveries[0]!.zone,
                        })
                      }
                    >
                      Découvrir
                    </button>
                  </div>
                )}
              </div>

              <div class="home__routes">
                <h3>Mes itinéraires</h3>
                <div class="home__tags">
                  {favorites.map((favorite) => (
                    <button type="button" key={favorite.id} class="home__tag" onClick={() => playFavorite(favorite)}>
                      <span class="home__tag-hole" />
                      {favorite.name}
                    </button>
                  ))}
                  <button type="button" class="btn-ghost home__compose" onClick={() => onExplore(true)}>
                    + Composer une manche
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        <footer class="home__footer">
          <p>Ton carnet reste dans ce navigateur : exporte-le de temps en temps pour le garder ou le passer sur un autre appareil.</p>
          <BackupButtons />
        </footer>
      </main>

      <nav class="home__tabbar" aria-label="Navigation">
        <button type="button" class="is-active" aria-current="page">
          <BookIcon size={24} />
          Carnet
        </button>
        <button type="button" onClick={() => onExplore(false)}>
          <MapIcon size={24} />
          Explorer
        </button>
        <button type="button" onClick={() => onExplore(true)}>
          <ArrowIcon size={24} />
          Composer
        </button>
      </nav>
    </div>
  );
}
