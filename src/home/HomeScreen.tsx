// Accueil (§ 7) : ce que je peux travailler aujourd'hui, sur un ton positif.
import { useEffect, useState } from 'preact/hooks';
import { modeOf, sanitizeChoice } from '../builder/options.ts';
import type { WorldData } from '../data/world.ts';
import type { AnswerMode, TimingStats } from '../engine/grading.ts';
import { MASTERY_LABELS } from '../engine/srs.ts';
import { loadCards, type GameRequest } from '../game/start.ts';
import { detectDevice } from '../lib/device.ts';
import type { Zone } from '../map/zones.ts';
import { BackupButtons } from '../sandbox/BackupButtons.tsx';
import { getFavorites, getTiming } from '../storage/db.ts';
import { progressDb } from '../storage/progress-db.ts';
import type { FavoriteRecord } from '../storage/schema.ts';
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
  if (hour < 5 || hour >= 19) return 'Bonsoir !';
  return 'Bonjour !';
}

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

  const playFavorite = (favorite: FavoriteRecord) => {
    const choice = sanitizeChoice(favorite.config);
    const zone = zones.find((z) => z.id === choice.zoneId) ?? zones[0]!;
    onPlay({ kind: 'builder', exercise: modeOf(choice).exercise, zone, count: choice.count, content: choice.content });
  };

  const progress = summary?.progress;
  const seen = progress ? progress.total - progress.new : 0;

  return (
    <div class="home">
      <header class="home__bar">
        <span class="home__logo">Géo</span>
        <button type="button" class="home__explore" onClick={() => onExplore(false)}>
          🗺️ Explorer la carte
        </button>
      </header>

      <main class="home__main">
        <div class="home__intro">
          <h1>{greeting(now)}</h1>
          <p>Voici ce que tu peux travailler aujourd’hui.</p>
        </div>

        {!summary ? (
          <p class="home__loading">Un instant…</p>
        ) : (
          <>
            <section class="home-card home-card--primary">
              <div>
                <h2>Révisions du jour</h2>
                {summary.due > 0 ? (
                  <p>
                    <strong>
                      {summary.due} élément{summary.due > 1 ? 's' : ''}
                    </strong>{' '}
                    (≈ {summary.estimatedMinutes} min{summary.due > summary.reviewBatch ? `, par séries de ${summary.reviewBatch}` : ''})
                  </p>
                ) : seen > 0 ? (
                  <p>
                    Tout est à jour 🎉
                    {summary.nextDueAt && ` Prochaine révision ${formatWhen(summary.nextDueAt, now)}.`}
                  </p>
                ) : (
                  <p>Pas encore de révisions : commence par un entretien rapide ou une découverte.</p>
                )}
              </div>
              {summary.due > 0 && (
                <button type="button" class="home__go" onClick={() => onPlay({ kind: 'review' })}>
                  Réviser
                </button>
              )}
            </section>

            <section class="home-card">
              <div>
                <h2>Entretien rapide</h2>
                <p>10 questions mêlées : pays, capitales et drapeaux.</p>
              </div>
              <button type="button" class="home__go home__go--light" onClick={() => onPlay({ kind: 'quick' })}>
                Lancer
              </button>
            </section>

            {summary.discoveries.map((discovery) => (
              <section class="home-card" key={discovery.exercise}>
                <div>
                  <h2>À découvrir</h2>
                  <p>
                    <strong>
                      {discovery.categoryLabel} · {discovery.zone.label}
                    </strong>{' '}
                    : {discovery.unseen} jamais vu{discovery.unseen > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  class="home__go home__go--light"
                  onClick={() =>
                    onPlay({ kind: 'builder', exercise: discovery.exercise, zone: discovery.zone, count: 10, content: 'new' })
                  }
                >
                  Découvrir
                </button>
              </section>
            ))}

            <section class="home-card home-card--column">
              <div class="home-card__row">
                <div>
                  <h2>Composer une manche</h2>
                  <p>Choisis la zone, la catégorie, le mode et le nombre de questions.</p>
                </div>
                <button type="button" class="home__go home__go--light" onClick={() => onExplore(true)}>
                  Composer
                </button>
              </div>
              {favorites.length > 0 && (
                <ul class="home__favorites">
                  {favorites.map((favorite) => (
                    <li key={favorite.id}>
                      <button type="button" onClick={() => playFavorite(favorite)}>
                        ▶ {favorite.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {progress && (
              <section class="home-card home-card--column">
                <h2>Ma progression</h2>
                <div class="home__bar-chart" role="img" aria-label={`${progress.acquired + progress.mastered} acquis ou maîtrisés sur ${progress.total}`}>
                  {(['mastered', 'acquired', 'learning'] as const).map((level) => (
                    <span key={level} class={`is-${level}`} style={{ width: `${(progress[level] / progress.total) * 100}%` }} />
                  ))}
                </div>
                <ul class="home__legend">
                  {(['mastered', 'acquired', 'learning', 'new'] as const).map((level) => (
                    <li key={level}>
                      <span class={`home__dot is-${level}`} /> {MASTERY_LABELS[level]} : <strong>{progress[level]}</strong>
                    </li>
                  ))}
                </ul>
                <p class="home__note">Sur {progress.total} cartes : chaque pays compte pour sa position, son nom, sa capitale et son drapeau.</p>
              </section>
            )}
          </>
        )}

        <footer class="home__footer">
          <p>Ta progression reste dans ce navigateur : exporte-la de temps en temps pour la garder ou la passer sur un autre appareil.</p>
          <BackupButtons />
        </footer>
      </main>
    </div>
  );
}
