// Fiche d'une région du carnet : ma progression dans la zone, puis Jouer (le constructeur de manche,
// ciblé sur la zone) ou Découvrir (découverte en 3 temps des éléments jamais vus).
// Les derniers choix de chaque région sont retenus.
import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  CATEGORIES,
  categoryOf,
  CONTENT_TYPES,
  COUNTS,
  modeOf,
  sanitizeChoice,
  type BuilderChoice,
  type CategoryId,
} from '../builder/options.ts';
import type { WorldData } from '../data/world.ts';
import { EXERCISES } from '../game/exercises.ts';
import type { GameRequest } from '../game/plans.ts';
import { availableFor, contentCounts, type ContentType } from '../game/selection.ts';
import { eligibleIds } from '../game/start.ts';
import type { MapFill } from '../map/world-map.ts';
import { WorldMapView } from '../map/WorldMapView.tsx';
import type { Zone } from '../map/zones.ts';
import { getSetting, putSetting } from '../storage/db.ts';
import { progressDb } from '../storage/progress-db.ts';
import type { CardRecord } from '../storage/schema.ts';
import { ArrowIcon, BackIcon, CloseIcon } from '../ui/icons.tsx';
import { percent, zoneProgress } from './zone-stats.ts';
import './zone.css';

/** Réglage enregistré : les derniers choix de chaque région (case du carnet). */
const ZONE_CHOICES_KEY = 'zoneChoices';

type Tab = 'play' | 'discover';

interface StoredChoice extends BuilderChoice {
  tab: Tab;
}

const NOUNS: Record<CategoryId, string> = { countries: 'pays', capitals: 'capitales', flags: 'drapeaux' };

/** Message quand un type de contenu ne propose rien, toujours sur un ton positif. */
const EMPTY_MESSAGES: Record<ContentType, string> = {
  due: 'Rien à réviser ici pour l’instant, tout est à jour !',
  new: 'Tu as déjà tout découvert ici, bravo !',
  weak: 'Pas encore de points faibles : joue d’abord quelques manches.',
  mix: 'Rien à demander ici pour cet exercice.',
};

interface Props {
  world: WorldData;
  zones: Zone[];
  /** Case du carnet : « world » ou un continent. */
  tileId: string;
  cards: Map<string, CardRecord>;
  /** Couleurs de la carte de conquête (maîtrise de chaque pays). */
  fills: Map<string, MapFill>;
  /** page : écran entier (téléphone) ; panel : à côté du carnet (PC). */
  layout: 'page' | 'panel';
  onPlay: (request: GameRequest) => void;
  onClose: () => void;
}

function defaultChoice(tileId: string): StoredChoice {
  return { zoneId: tileId, category: 'countries', mode: 'pin', count: 10, content: 'mix', tab: 'play' };
}

export function ZoneSheet({ world, zones, tileId, cards, fills, layout, onPlay, onClose }: Props) {
  const [choice, setChoice] = useState<StoredChoice>(() => defaultChoice(tileId));
  const tile = zones.find((zone) => zone.id === tileId) ?? zones[0]!;
  // Sous-régions d'un continent ; le Monde couvre tout, sans découpage.
  const subzones = tile.kind === 'continent' ? zones.filter((zone) => zone.parent === tile.id) : [];

  // Derniers choix retenus pour cette région.
  useEffect(() => {
    setChoice(defaultChoice(tileId));
    let cancelled = false;
    void (async () => {
      const stored = await getSetting<Record<string, unknown>>(await progressDb(), ZONE_CHOICES_KEY, {});
      const raw = stored[tileId] as Partial<StoredChoice> | undefined;
      if (cancelled || !raw) return;
      const sane = sanitizeChoice(raw);
      // La sous-région retenue doit appartenir à cette région.
      const zoneId = sane.zoneId === tileId || subzones.some((zone) => zone.id === sane.zoneId) ? sane.zoneId : tileId;
      setChoice({ ...sane, zoneId, tab: raw.tab === 'discover' ? 'discover' : 'play' });
    })();
    return () => {
      cancelled = true;
    };
  }, [tileId]);

  const update = (patch: Partial<StoredChoice>) =>
    setChoice((current) => {
      const next = { ...current, ...patch };
      return { ...sanitizeChoice(next), tab: next.tab };
    });

  const remember = async (selected: StoredChoice) => {
    const db = await progressDb();
    const stored = await getSetting<Record<string, unknown>>(db, ZONE_CHOICES_KEY, {});
    await putSetting(db, ZONE_CHOICES_KEY, { ...stored, [tileId]: selected });
  };

  const zone = zones.find((z) => z.id === choice.zoneId) ?? tile;
  const now = useMemo(() => new Date(), [cards]);
  const progress = useMemo(() => zoneProgress(world, zone, cards, now), [world, zone, cards, now]);
  const mode = modeOf(choice);
  const exercise = EXERCISES[mode.exercise];
  const counts = useMemo(
    () => contentCounts(eligibleIds(world, exercise.id, zone), exercise.skill, cards, now),
    [world, exercise, zone, cards, now],
  );
  const available = availableFor(choice.content, counts);
  const questions = choice.count === 'all' ? available : Math.min(choice.count, available);
  const noun = NOUNS[choice.category];

  // Carte de la zone : seuls ses pays prennent la couleur de leur maîtrise, les autres restent papier.
  const zoneFills = useMemo(() => {
    const ids = new Set(zone.entityIds);
    return new Map([...fills].filter(([id]) => ids.has(id)));
  }, [fills, zone]);

  const play = () => {
    if (questions === 0) return;
    void remember(choice);
    onPlay({ kind: 'builder', exercise: mode.exercise, zone, count: choice.count, content: choice.content });
  };
  const discover = () => {
    if (counts.fresh === 0) return;
    void remember(choice);
    onPlay({ kind: 'discovery', exercise: mode.exercise, zone });
  };

  return (
    <section class={`zone zone--${layout} ${layout === 'panel' ? 'paper-card' : ''}`} aria-label={`Fiche ${tile.label}`}>
      <header class="zone__head">
        {layout === 'page' && (
          <button type="button" class="btn zone__back" onClick={onClose}>
            <BackIcon /> Carnet
          </button>
        )}
        <h2>{tile.label}</h2>
        <span class="zone__share">
          {percent(progress.share)} acquis
          {layout === 'panel' && ` · ${progress.entities} territoires`}
        </span>
        {layout === 'panel' && tile.id !== 'world' && (
          <button type="button" class="zone__close" onClick={onClose} aria-label="Fermer la fiche" title="Fermer">
            <CloseIcon size={18} />
          </button>
        )}
      </header>

      {layout === 'page' && (
        <div class="zone__map">
          <WorldMapView world={world} zone={zone} fills={zoneFills} interactive={false} />
        </div>
      )}

      {subzones.length > 0 && (
        <div class="zone__subs" role="radiogroup" aria-label="Partie de la région">
          {[tile, ...subzones].map((option) => (
            <button
              type="button"
              key={option.id}
              role="radio"
              aria-checked={zone.id === option.id}
              class={`zone__chip ${zone.id === option.id ? 'is-active' : ''}`}
              onClick={() => update({ zoneId: option.id })}
            >
              {option.id === tile.id ? 'Toute la région' : option.label}
            </button>
          ))}
        </div>
      )}

      <div class="zone__block">
        <h3 class={layout === 'page' ? '' : 'zone__visually-hidden'}>Ma progression</h3>
        <table class="zone__table">
          <thead>
            <tr>
              <th scope="col">{zone.id === tile.id ? 'Exercice' : zone.label}</th>
              <th scope="col">Acquis</th>
              <th scope="col" class="zone__num">
                À revoir
              </th>
              <th scope="col" class="zone__num">
                Neufs
              </th>
            </tr>
          </thead>
          {progress.categories.map((category) => (
            <tbody key={category.category}>
              {category.rows.map((row) => {
                const share = row.total ? row.strong / row.total : 0;
                return (
                  <tr key={row.skill}>
                    <th scope="row">{row.label}</th>
                    <td>
                      <span class="zone__bar" aria-hidden="true">
                        <span style={{ width: `${Math.round(share * 100)}%` }} />
                      </span>
                      <span class="zone__pct">{percent(share)}</span>
                    </td>
                    <td class={`zone__num ${row.due ? 'is-due' : ''}`}>{row.due}</td>
                    <td class="zone__num zone__fresh">{row.fresh}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>

      <div class="zone__block zone__choose">
        <h3>Que veux-tu faire ?</h3>
        <p class="zone__label">Catégorie</p>
        <div class="zone__pills" role="radiogroup" aria-label="Catégorie">
          {CATEGORIES.map((category) => (
            <button
              type="button"
              key={category.id}
              role="radio"
              aria-checked={choice.category === category.id}
              class={`zone__pill ${choice.category === category.id ? 'is-active' : ''}`}
              onClick={() => update({ category: category.id })}
            >
              {category.label}
            </button>
          ))}
        </div>
        <p class="zone__label">Exercice</p>
        <div class="zone__pills" role="radiogroup" aria-label="Exercice">
          {categoryOf(choice.category).modes.map((option) => (
            <button
              type="button"
              key={option.id}
              role="radio"
              aria-checked={mode.id === option.id}
              class={`zone__pill ${mode.id === option.id ? 'is-active' : ''}`}
              onClick={() => update({ mode: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p class="zone__help">{exercise.description}</p>

        <div class="zone__tabs" role="tablist" aria-label="Jouer ou découvrir">
          <button
            type="button"
            role="tab"
            aria-selected={choice.tab === 'play'}
            class={choice.tab === 'play' ? 'is-active' : ''}
            onClick={() => update({ tab: 'play' })}
          >
            Jouer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={choice.tab === 'discover'}
            class={choice.tab === 'discover' ? 'is-active' : ''}
            onClick={() => update({ tab: 'discover' })}
          >
            Découvrir
            {counts.fresh > 0 && <span class="zone__badge">{counts.fresh}</span>}
          </button>
        </div>

        {choice.tab === 'play' ? (
          <div role="tabpanel" class="zone__panel">
            <p class="zone__label">Nombre de questions</p>
            <div class="zone__pills" role="radiogroup" aria-label="Nombre de questions">
              {COUNTS.map((count) => (
                <button
                  type="button"
                  key={String(count)}
                  role="radio"
                  aria-checked={choice.count === count}
                  class={`zone__pill ${choice.count === count ? 'is-active' : ''}`}
                  onClick={() => update({ count })}
                >
                  {count === 'all' ? 'Tout' : count}
                </button>
              ))}
            </div>
            <p class="zone__label">Contenu</p>
            <div class="zone__pills" role="radiogroup" aria-label="Contenu">
              {CONTENT_TYPES.map((content) => {
                const count = content.id === 'mix' ? null : availableFor(content.id, counts);
                return (
                  <button
                    type="button"
                    key={content.id}
                    role="radio"
                    aria-checked={choice.content === content.id}
                    title={content.description}
                    class={`zone__pill ${choice.content === content.id ? 'is-active' : ''}`}
                    onClick={() => update({ content: content.id })}
                  >
                    {content.label}
                    {count !== null && ` (${count})`}
                  </button>
                );
              })}
            </div>
            <button type="button" class="btn btn--terracotta btn--big zone__go" disabled={questions === 0} onClick={play}>
              C’est parti ! <ArrowIcon />
            </button>
            <p class="zone__summary" aria-live="polite">
              {questions > 0
                ? `${questions} question${questions > 1 ? 's' : ''} · ${exercise.label} · ${zone.label}`
                : EMPTY_MESSAGES[choice.content]}
            </p>
          </div>
        ) : (
          <div role="tabpanel" class="zone__panel">
            {counts.fresh > 0 ? (
              <>
                <p class="zone__discover">
                  <strong>
                    {counts.fresh} {noun}
                  </strong>{' '}
                  encore jamais {choice.category === 'capitals' ? 'vues' : 'vus'} ici.
                </p>
                <p class="zone__help">
                  Par groupes de 5, en trois temps : observer sur la carte, reconnaître parmi 4 propositions, puis retrouver seul.
                </p>
                <button type="button" class="btn btn--gold btn--big zone__go" onClick={discover}>
                  Découvrir {Math.min(5, counts.fresh)} {noun}
                </button>
              </>
            ) : (
              <p class="zone__discover">Tu as déjà tout découvert ici pour cet exercice, bravo ! Passe à « Jouer » pour l’entretenir.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
