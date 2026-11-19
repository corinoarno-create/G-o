// Constructeur de session (§ 6) : je choisis ce que je travaille — zone, catégorie, mode,
// type de contenu, nombre — et l'app prépare la manche. Les sessions favorites se lancent en un geste.
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { WorldData } from '../data/world.ts';
import { EXERCISES } from '../game/exercises.ts';
import { availableFor, contentCounts, type ContentType } from '../game/selection.ts';
import { eligibleIds, loadCards, type GameRequest } from '../game/start.ts';
import type { Zone } from '../map/zones.ts';
import { deleteFavorite, getFavorites, getSetting, putFavorite, putSetting } from '../storage/db.ts';
import { progressDb } from '../storage/progress-db.ts';
import type { CardRecord, FavoriteRecord } from '../storage/schema.ts';
import {
  CATEGORIES,
  categoryOf,
  CONTENT_TYPES,
  COUNTS,
  defaultFavoriteName,
  modeOf,
  sanitizeChoice,
  type BuilderChoice,
} from './options.ts';
import './builder.css';

const LAST_CHOICE_KEY = 'lastBuilderChoice';

interface Props {
  world: WorldData;
  zones: Zone[];
  zoneId: string;
  onZoneChange: (zoneId: string) => void;
  onStart: (request: GameRequest) => void;
  onClose: () => void;
}

/** Message quand un type de contenu ne propose rien, toujours sur un ton positif. */
const EMPTY_MESSAGES: Record<ContentType, string> = {
  due: 'Rien à réviser ici pour l’instant, tout est à jour !',
  new: 'Tu as déjà tout découvert ici.',
  weak: 'Pas encore de points faibles : joue d’abord quelques manches.',
  mix: 'Rien à demander ici pour cet exercice.',
};

export function SessionBuilder({ world, zones, zoneId, onZoneChange, onStart, onClose }: Props) {
  const [choice, setChoice] = useState<BuilderChoice>({ ...sanitizeChoice(null), zoneId });
  const [cards, setCards] = useState<Map<string, CardRecord> | null>(null);
  const [favorites, setFavorites] = useState<FavoriteRecord[]>([]);
  const [favoriteName, setFavoriteName] = useState<string | null>(null);

  // Chargement : cartes (pour les compteurs), favoris et dernière session (sauf la zone, déjà choisie sur la carte).
  useEffect(() => {
    void (async () => {
      const db = await progressDb();
      const [loadedCards, loadedFavorites, last] = await Promise.all([
        loadCards(),
        getFavorites(db),
        getSetting<unknown>(db, LAST_CHOICE_KEY, null),
      ]);
      setCards(loadedCards);
      setFavorites(loadedFavorites.sort((a, b) => a.name.localeCompare(b.name, 'fr')));
      if (last) setChoice((current) => ({ ...sanitizeChoice(last), zoneId: current.zoneId }));
    })();
  }, []);

  // La zone suit la carte (et inversement).
  useEffect(() => setChoice((current) => ({ ...current, zoneId })), [zoneId]);

  // Mise à jour à partir de l'état le plus récent (deux clics rapides ne s'écrasent pas).
  const update = (patch: Partial<BuilderChoice>) => {
    setChoice((current) => sanitizeChoice({ ...current, ...patch }));
    if (patch.zoneId) onZoneChange(patch.zoneId);
  };

  const zone = zones.find((z) => z.id === choice.zoneId) ?? zones[0]!;
  const mode = modeOf(choice);
  const exercise = EXERCISES[mode.exercise];
  const counts = useMemo(
    () => (cards ? contentCounts(eligibleIds(world, exercise.id, zone), exercise.skill, cards, new Date()) : null),
    [cards, world, exercise, zone],
  );
  const available = counts ? availableFor(choice.content, counts) : 0;
  const questions = choice.count === 'all' ? available : Math.min(choice.count, available);

  const configFor = (selected: BuilderChoice): GameRequest => ({
    kind: 'builder',
    exercise: modeOf(selected).exercise,
    zone: zones.find((z) => z.id === selected.zoneId) ?? zones[0]!,
    count: selected.count,
    content: selected.content,
  });

  const start = (selected: BuilderChoice) => {
    void progressDb().then((db) => putSetting(db, LAST_CHOICE_KEY, selected));
    onStart(configFor(selected));
  };

  const saveFavorite = async () => {
    const name = favoriteName?.trim();
    if (!name) return;
    const favorite: FavoriteRecord = {
      id: `fav-${Date.now().toString(36)}`,
      name,
      config: choice,
      updatedAt: new Date(),
    };
    await putFavorite(await progressDb(), favorite);
    setFavorites((list) => [...list, favorite].sort((a, b) => a.name.localeCompare(b.name, 'fr')));
    setFavoriteName(null);
  };

  const removeFavorite = async (id: string) => {
    await deleteFavorite(await progressDb(), id);
    setFavorites((list) => list.filter((favorite) => favorite.id !== id));
  };

  const continents = zones.filter((z) => z.kind === 'continent');

  return (
    <form
      class="builder"
      onSubmit={(event) => {
        event.preventDefault();
        if (questions > 0) start(choice);
      }}
    >
      <div class="builder__head">
        <h2>Composer une manche</h2>
        <button type="button" class="builder__close" onClick={onClose} aria-label="Fermer">
          ×
        </button>
      </div>

      {favorites.length > 0 && (
        <section class="builder__section">
          <h3>Mes favoris</h3>
          <ul class="builder__favorites">
            {favorites.map((favorite) => (
              <li key={favorite.id}>
                <button type="button" class="builder__favorite" onClick={() => start(sanitizeChoice(favorite.config))}>
                  ▶ {favorite.name}
                </button>
                <button
                  type="button"
                  class="builder__remove"
                  onClick={() => void removeFavorite(favorite.id)}
                  aria-label={`Supprimer le favori ${favorite.name}`}
                  title="Supprimer"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section class="builder__section">
        <h3>
          <label for="builder-zone">Zone</label>
        </h3>
        <select id="builder-zone" class="builder__select" value={choice.zoneId} onChange={(e) => update({ zoneId: e.currentTarget.value })}>
          <option value="world">Monde</option>
          {continents.map((continent) => (
            <optgroup key={continent.id} label={continent.label}>
              <option value={continent.id}>{continent.label} (tout)</option>
              {zones
                .filter((z) => z.parent === continent.id)
                .map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </section>

      <section class="builder__section">
        <h3>Catégorie</h3>
        <div class="builder__segments" role="radiogroup" aria-label="Catégorie">
          {CATEGORIES.map((category) => (
            <button
              type="button"
              key={category.id}
              role="radio"
              aria-checked={choice.category === category.id}
              class={choice.category === category.id ? 'is-active' : ''}
              onClick={() => update({ category: category.id })}
            >
              {category.label}
            </button>
          ))}
        </div>
      </section>

      <section class="builder__section">
        <h3>Mode</h3>
        <div class="builder__segments" role="radiogroup" aria-label="Mode">
          {categoryOf(choice.category).modes.map((option) => (
            <button
              type="button"
              key={option.id}
              role="radio"
              aria-checked={mode.id === option.id}
              class={mode.id === option.id ? 'is-active' : ''}
              onClick={() => update({ mode: option.id })}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p class="builder__help">{exercise.description}</p>
      </section>

      <section class="builder__section">
        <h3>Contenu</h3>
        <div class="builder__contents" role="radiogroup" aria-label="Contenu">
          {CONTENT_TYPES.map((content) => {
            const count = counts ? availableFor(content.id, counts) : null;
            return (
              <button
                type="button"
                key={content.id}
                role="radio"
                aria-checked={choice.content === content.id}
                class={`builder__content ${choice.content === content.id ? 'is-active' : ''}`}
                onClick={() => update({ content: content.id })}
              >
                <strong>
                  {content.label}
                  {count !== null && <span class="builder__badge">{count}</span>}
                </strong>
                <small>{content.description}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section class="builder__section">
        <h3>Nombre</h3>
        <div class="builder__segments" role="radiogroup" aria-label="Nombre de questions">
          {COUNTS.map((count) => (
            <button
              type="button"
              key={String(count)}
              role="radio"
              aria-checked={choice.count === count}
              class={choice.count === count ? 'is-active' : ''}
              onClick={() => update({ count })}
            >
              {count === 'all' ? 'Tout' : count}
            </button>
          ))}
        </div>
      </section>

      {favoriteName !== null && (
        <div class="builder__save">
          <input
            class="builder__select"
            value={favoriteName}
            onInput={(e) => setFavoriteName(e.currentTarget.value)}
            aria-label="Nom du favori"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void saveFavorite();
              }
            }}
          />
          <button type="button" class="btn builder__secondary" onClick={() => void saveFavorite()} disabled={!favoriteName.trim()}>
            Enregistrer
          </button>
        </div>
      )}

      <div class="builder__footer">
        <p class="builder__summary" aria-live="polite">
          {cards === null
            ? 'Chargement…'
            : questions > 0
              ? `${questions} question${questions > 1 ? 's' : ''} · ${zone.label}`
              : EMPTY_MESSAGES[choice.content]}
        </p>
        <div class="builder__buttons">
          {favoriteName === null && (
            <button
              type="button"
              class="btn builder__secondary"
              onClick={() => setFavoriteName(defaultFavoriteName(choice, zone.label))}
              title="Enregistrer ces réglages en favori"
            >
              ☆ Favori
            </button>
          )}
          <button type="submit" class="btn btn--terracotta builder__start" disabled={questions === 0}>
            C’est parti !
          </button>
        </div>
      </div>
    </form>
  );
}
