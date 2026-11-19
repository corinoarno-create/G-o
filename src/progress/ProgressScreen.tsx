// Page « Ma progression » (lot C) : chiffres clés, activité, maîtrise, temps de réponse, révisions à venir,
// points faibles, et remise à zéro d'une zone. Tout est calculé sur l'appareil, à partir de mes données locales.
import { useEffect, useState } from 'preact/hooks';
import type { WorldData } from '../data/world.ts';
import { MASTERY_LABELS, SKILL_LABELS, type MasteryLevel } from '../engine/srs.ts';
import type { GameRequest } from '../game/plans.ts';
import { loadCards } from '../game/start.ts';
import type { Zone } from '../map/zones.ts';
import { getAllReviews } from '../storage/db.ts';
import { progressDb } from '../storage/progress-db.ts';
import { ArrowIcon, BookIcon } from '../ui/icons.tsx';
import { ActivityChart, Legend, LineChart, SERIES_COLORS, UpcomingChart } from './charts.tsx';
import { ResetProgress } from './ResetProgress.tsx';
import { buildProgressStats, type MasteryCounts, type ProgressStats } from './stats.ts';
import './progress.css';

interface Props {
  world: WorldData;
  zones: Zone[];
  onPlay: (request: GameRequest) => void;
  onHome: () => void;
}

const LEVELS: MasteryLevel[] = ['mastered', 'acquired', 'learning', 'new'];

const seconds = (ms: number) => `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`;
const km = (value: number) => `${Math.round(value).toLocaleString('fr-FR')} km`;

export function ProgressScreen({ world, zones, onPlay, onHome }: Props) {
  const [stats, setStats] = useState<ProgressStats | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    void (async () => {
      const db = await progressDb();
      const [cards, reviews] = await Promise.all([loadCards(), getAllReviews(db)]);
      setStats(buildProgressStats(world, cards, reviews, new Date()));
    })();
  }, [world, version]);

  const playWeak = () => {
    if (!stats?.weak.length) return;
    onPlay({
      kind: 'questions',
      title: 'Mes points faibles',
      zone: zones[0]!,
      questions: stats.weak.map(({ entityId, exercise }) => ({ entityId, exercise })),
    });
  };

  return (
    <div class="progress">
      <header class="progress__bar">
        <button type="button" class="btn home__pill" onClick={onHome}>
          <BookIcon size={18} /> Carnet
        </button>
        <h1>Ma progression</h1>
      </header>

      {!stats ? (
        <p class="progress__loading hand">On feuillette le carnet…</p>
      ) : (
        <main class="progress__main">
          <section class="progress__figures" aria-label="Chiffres clés">
            <Figure value={stats.figures.daysPlayed} label={stats.figures.daysPlayed > 1 ? 'jours de voyage' : 'jour de voyage'} />
            <Figure value={stats.figures.answers} label="réponses" />
            <Figure
              value={stats.figures.accuracy === null ? '—' : `${Math.round(stats.figures.accuracy * 100)} %`}
              label="du premier coup (30 j)"
            />
            <Figure value={stats.figures.acquired} label="acquis" />
            <Figure value={stats.figures.mastered} label="maîtrisés" />
          </section>

          <section class="paper-card progress__card">
            <h2>Activité</h2>
            <p class="progress__help">Premières réponses de chaque question, sur les 30 derniers jours.</p>
            {stats.figures.answers === 0 ? (
              <Empty />
            ) : (
              <>
                <Legend
                  items={[
                    { label: 'Justes', color: SERIES_COLORS.correct },
                    { label: 'À revoir', color: SERIES_COLORS.wrong },
                  ]}
                />
                <ActivityChart data={stats.activity} />
              </>
            )}
          </section>

          <section class="paper-card progress__card">
            <h2>À venir</h2>
            <p class="progress__help">Révisions prévues sur les 7 prochains jours (celles en retard comptent pour aujourd’hui).</p>
            {stats.upcoming.every((d) => d.count === 0) ? (
              <p class="progress__empty hand">Rien de prévu : ton carnet est à jour.</p>
            ) : (
              <UpcomingChart data={stats.upcoming} />
            )}
          </section>

          <section class="paper-card progress__card progress__card--wide">
            <h2>Maîtrise</h2>
            <p class="progress__help">
              Chaque élément compte une fois par compétence. « Acquis » : souvenir solide une semaine ; « maîtrisé » : un mois.
            </p>
            <MasteryLegend />
            <div class="progress__columns">
              <div>
                <h3>Par compétence</h3>
                {stats.masteryBySkill.map((row) => (
                  <MasteryRow key={row.skill} label={row.label} counts={row.counts} />
                ))}
              </div>
              <div>
                <h3>Par continent</h3>
                {stats.masteryByContinent.map((row) => (
                  <MasteryRow key={row.id} label={row.label} counts={row.counts} />
                ))}
              </div>
            </div>
          </section>

          <section class="paper-card progress__card">
            <h2>Temps de réponse</h2>
            <p class="progress__help">Temps médian des bonnes réponses du premier coup, sans indice, semaine par semaine.</p>
            {stats.speed.every((w) => Object.values(w.medians).every((v) => v === null)) ? (
              <Empty />
            ) : (
              <>
                <Legend
                  items={[
                    { label: 'Clic', color: SERIES_COLORS.pin, line: true },
                    { label: 'Saisie', color: SERIES_COLORS.type, line: true },
                    { label: 'Choix', color: SERIES_COLORS.choice, line: true },
                  ]}
                />
                <LineChart
                  ariaLabel="Temps médian de réponse par semaine"
                  labels={stats.speed.map((w) => w.weekStart)}
                  format={seconds}
                  series={[
                    { id: 'pin', label: 'Clic', color: SERIES_COLORS.pin, values: stats.speed.map((w) => w.medians.pin) },
                    { id: 'type', label: 'Saisie', color: SERIES_COLORS.type, values: stats.speed.map((w) => w.medians.type) },
                    { id: 'choice', label: 'Choix', color: SERIES_COLORS.choice, values: stats.speed.map((w) => w.medians.choice) },
                  ].filter((s) => s.values.some((v) => v !== null))}
                />
              </>
            )}
          </section>

          <section class="paper-card progress__card">
            <h2>Précision des capitales placées</h2>
            <p class="progress__help">Écart médian entre ton clic et la capitale (premier essai), semaine par semaine.</p>
            {stats.speed.every((w) => w.capitalKm === null) ? (
              <Empty text="Joue « Capitales · Placer » pour voir ta précision." />
            ) : (
              <LineChart
                ariaLabel="Écart médian des capitales placées, par semaine"
                labels={stats.speed.map((w) => w.weekStart)}
                format={km}
                series={[{ id: 'km', label: 'Écart médian', color: SERIES_COLORS.choice, values: stats.speed.map((w) => w.capitalKm) }]}
              />
            )}
          </section>

          <section class="paper-card progress__card">
            <h2>Points faibles</h2>
            <p class="progress__help">Les éléments les plus fragiles en ce moment : oubliés souvent, ou pas revus depuis longtemps.</p>
            {stats.weak.length === 0 ? (
              <Empty text="Pas encore de points faibles : joue quelques manches." />
            ) : (
              <>
                <ol class="progress__weak">
                  {stats.weak.map((item) => {
                    const entity = world.byId.get(item.entityId);
                    const name =
                      item.skill === 'name-capital' || item.skill === 'locate-capital' || item.skill === 'capital-country'
                        ? `${entity?.capital?.name ?? '?'} (${entity?.name ?? item.entityId})`
                        : (entity?.name ?? item.entityId);
                    return (
                      <li key={`${item.entityId}:${item.skill}`}>
                        <span class="progress__weak-name">{name}</span>
                        <span class="progress__weak-skill">{SKILL_LABELS[item.skill]}</span>
                        {item.lapses > 0 && (
                          <span class="progress__weak-lapses">
                            {item.lapses} oubli{item.lapses > 1 ? 's' : ''}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
                <button type="button" class="btn btn--terracotta" onClick={playWeak}>
                  Travailler ces points faibles <ArrowIcon />
                </button>
              </>
            )}
          </section>

          <section class="paper-card progress__card progress__card--wide progress__danger">
            <h2>Repartir de zéro</h2>
            <ResetProgress zones={zones} onReset={() => setVersion((v) => v + 1)} />
          </section>
        </main>
      )}
    </div>
  );
}

function Figure({ value, label }: { value: number | string; label: string }) {
  return (
    <div class="progress__figure">
      <strong class="hand">{typeof value === 'number' ? value.toLocaleString('fr-FR') : value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Empty({ text = 'Joue quelques manches pour voir ta courbe se dessiner.' }: { text?: string }) {
  return <p class="progress__empty hand">{text}</p>;
}

function MasteryLegend() {
  return (
    <ul class="chart-legend">
      {LEVELS.map((level) => (
        <li key={level}>
          <span class={`chart-legend__swatch mastery-${level}`} />
          {MASTERY_LABELS[level]}
        </li>
      ))}
    </ul>
  );
}

/** Barre empilée des niveaux de maîtrise (du plus solide au plus neuf), avec la part acquise ou maîtrisée. */
function MasteryRow({ label, counts }: { label: string; counts: MasteryCounts }) {
  const strong = counts.total ? Math.round(((counts.acquired + counts.mastered) / counts.total) * 100) : 0;
  return (
    <div class="mastery-row">
      <span class="mastery-row__label">{label}</span>
      <div
        class="mastery-row__bar"
        role="img"
        aria-label={`${label} : ${LEVELS.map((level) => `${counts[level]} ${MASTERY_LABELS[level].toLowerCase()}`).join(', ')}`}
      >
        {LEVELS.map((level) =>
          counts[level] > 0 ? (
            <span
              key={level}
              class={`mastery-${level}`}
              style={{ flexGrow: counts[level] }}
              title={`${MASTERY_LABELS[level]} : ${counts[level]} sur ${counts.total}`}
            />
          ) : null,
        )}
      </div>
      <span class="mastery-row__value">{strong} %</span>
    </div>
  );
}
