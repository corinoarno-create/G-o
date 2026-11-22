// Carte à explorer : choisir une zone, toucher un pays pour voir sa fiche,
// et composer une manche avec le constructeur de session. La case « Villes » montre les villes et les capitales :
// toucher une ville ouvre sa fiche (réglage `exploreCities`, décoché par défaut).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { cardKey, MASTERY_LABELS, masteryOf } from '../engine/srs.ts';
import { loadCards } from '../game/start.ts';
import { getSetting, putSetting } from '../storage/db.ts';
import { progressDb } from '../storage/progress-db.ts';
import type { CardRecord } from '../storage/schema.ts';
import { flagUrl } from '../data/flags.ts';
import { CONTINENT_LABELS, STATUS_LABELS, SUBREGION_LABELS } from '../data/labels.ts';
import type { WorldData } from '../data/world.ts';
import type { HighlightKind, MapInsets, MapPick, MapPin, MapPlace } from '../map/world-map.ts';
import { WorldMapView } from '../map/WorldMapView.tsx';
import { buildZones } from '../map/zones.ts';
import type { GameRequest } from '../game/start.ts';
import { SessionBuilder } from '../builder/SessionBuilder.tsx';
import './sandbox.css';

/** « 48,86° N, 2,35° E » */
function formatLonLat([lon, lat]: [number, number]): string {
  const fmt = (value: number) => Math.abs(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  return `${fmt(lat)}° ${lat >= 0 ? 'N' : 'S'}, ${fmt(lon)}° ${lon >= 0 ? 'E' : 'O'}`;
}

interface Props {
  world: WorldData;
  zoneId: string;
  onZoneChange: (zoneId: string) => void;
  onPlay: (request: GameRequest) => void;
  onHome: () => void;
  /** Ouvrir directement le constructeur de session. */
  initialBuilderOpen?: boolean;
}

export function Sandbox({ world, zoneId, onZoneChange, onPlay, onHome, initialBuilderOpen = false }: Props) {
  const zones = useMemo(() => buildZones(world), [world]);
  const [pick, setPick] = useState<MapPick | null>(null);
  const [builderOpen, setBuilderOpen] = useState(initialBuilderOpen);
  const mapAreaRef = useRef<HTMLElement>(null);
  const builderRef = useRef<HTMLElement>(null);
  const [insets, setInsets] = useState<MapInsets>({ top: 0, bottom: 0 });
  // Villes et capitales sur la carte (réglage retenu), et mes cartes mémoire pour la fiche d'une ville.
  const [showCities, setShowCities] = useState(false);
  const [cards, setCards] = useState<Map<string, CardRecord> | null>(null);
  useEffect(() => {
    void progressDb()
      .then((db) => getSetting(db, 'exploreCities', false))
      .then(setShowCities);
  }, []);
  useEffect(() => {
    if (showCities && !cards) void loadCards().then(setCards);
  }, [showCities]);
  const toggleCities = () => {
    const value = !showCities;
    setShowCities(value);
    if (!value && pick?.placeId) setPick(null);
    void progressDb().then((db) => putSetting(db, 'exploreCities', value));
  };
  const places = useMemo<MapPlace[]>(() => {
    if (!showCities) return [];
    const capitals = world.countries.flatMap((c) =>
      c.capital ? [{ id: `cap:${c.id}`, lonLat: [c.capital.lon, c.capital.lat] as [number, number], name: c.capital.name, kind: 'capital' as const }] : [],
    );
    const cities = world.cities.map((city) => ({ id: city.id, lonLat: [city.lon, city.lat] as [number, number], name: city.name, kind: 'city' as const }));
    return [...cities, ...capitals];
  }, [showCities, world]);
  // Toucher une capitale ouvre la fiche de son pays ; une ville, la sienne.
  const onPick = (next: MapPick) => {
    if (next.placeId?.startsWith('cap:')) setPick({ entityId: next.placeId.slice(4), lonLat: next.lonLat });
    else setPick(next);
  };

  // Quand le constructeur est ouvert, la zone est cadrée dans la partie visible de la carte :
  // au-dessus du panneau sur téléphone, à sa droite sur PC.
  useLayoutEffect(() => {
    const area = mapAreaRef.current;
    const panel = builderRef.current;
    if (!builderOpen || !area || !panel) {
      setInsets({ top: 0, bottom: 0 });
      return undefined;
    }
    const measure = () => {
      const map = area.getBoundingClientRect();
      const box = panel.getBoundingClientRect();
      const fullWidth = box.width > map.width * 0.8;
      setInsets(
        fullWidth
          ? { top: 0, bottom: Math.max(0, map.bottom - box.top) + 8 }
          : { top: 0, bottom: 0, left: Math.max(0, box.right - map.left) + 8 },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    observer.observe(panel); // le panneau grandit quand les favoris arrivent
    return () => observer.disconnect();
  }, [builderOpen]);
  const [focusIds, setFocusIds] = useState<string[] | null>(null);
  const zone = zones.find((z) => z.id === zoneId) ?? zones[0]!;

  const city = pick?.placeId ? world.cityById.get(pick.placeId) : undefined;
  const entity = city ? world.byId.get(city.country) : pick?.entityId ? world.byId.get(pick.entityId) : undefined;
  const highlights = useMemo(
    () => new Map<string, HighlightKind>(entity && !city ? [[entity.id, 'selected']] : []),
    [entity, city],
  );
  const cityPins = useMemo<MapPin[]>(() => (city ? [{ lonLat: [city.lon, city.lat], kind: 'target' }] : []), [city]);
  const levelOf = (id: string, skill: 'locate-city' | 'name-city') => {
    const record = cards?.get(cardKey(id, skill));
    return MASTERY_LABELS[record ? masteryOf(record.card) : 'new'];
  };
  const sovereign = entity?.sovereign ? world.byId.get(entity.sovereign) : undefined;
  const flag = flagUrl(entity?.flag ?? null);

  return (
    <div class="sandbox">
      <header class="sandbox__bar">
        <button type="button" class="sandbox__home" onClick={onHome} aria-label="Retour à l’accueil" title="Accueil">
          ←
        </button>
        <h1 class="sandbox__title hand">Géo</h1>
        <label class="sandbox__zone">
          <span class="visually-hidden">Zone</span>
          <select
            value={zoneId}
            onChange={(event) => {
              onZoneChange(event.currentTarget.value);
              setPick(null);
            }}
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.kind === 'subregion' ? `   ${z.label}` : z.label}
              </option>
            ))}
          </select>
        </label>
        <span class="sandbox__count">{zone.entityIds.length} entités</span>
        <label class="sandbox__toggle" title="Villes et capitales : touche une ville pour ouvrir sa fiche">
          <input type="checkbox" checked={showCities} onChange={toggleCities} /> Villes
        </label>
        <button type="button" class="btn btn--terracotta sandbox__play" onClick={() => setBuilderOpen(true)}>
          Jouer
        </button>
      </header>

      <main class="sandbox__map" ref={mapAreaRef}>
        <WorldMapView
          world={world}
          zone={zone}
          highlights={highlights}
          insets={insets}
          onPick={onPick}
          focusIds={focusIds}
          places={places}
          pins={cityPins}
        />
      </main>

      {builderOpen && (
        <aside class="sandbox__card paper-card sandbox__card--builder" ref={builderRef}>
          <SessionBuilder
            world={world}
            zones={zones}
            zoneId={zone.id}
            onZoneChange={onZoneChange}
            onStart={onPlay}
            onClose={() => setBuilderOpen(false)}
          />
        </aside>
      )}

      <aside class="sandbox__card paper-card tilt-left" aria-live="polite" hidden={builderOpen}>
        <span class="tape tape--right tape--teal" />
        {!pick && (
          <p class="sandbox__hint hand">{showCities ? 'Touche un pays ou une ville pour ouvrir sa fiche.' : 'Touche un pays pour ouvrir sa page du carnet.'}</p>
        )}
        {city && entity && (
          <>
            <div class="sandbox__head">
              {flag && <img class="sandbox__flag" src={flag} alt="" width={64} height={48} />}
              <div>
                <h2 class="sandbox__name">{city.name}</h2>
                <p class="sandbox__meta">
                  Ville · {entity.name}
                </p>
              </div>
              <button type="button" class="sandbox__close" onClick={() => setPick(null)} aria-label="Fermer">
                ×
              </button>
            </div>
            <dl class="sandbox__facts">
              {city.aliases.length > 0 && (
                <>
                  <dt>Aussi</dt>
                  <dd>{city.aliases.join(', ')}</dd>
                </>
              )}
              <dt>Population</dt>
              <dd>{city.population.toLocaleString('fr-FR')}</dd>
              <dt>Placer</dt>
              <dd>{levelOf(city.id, 'locate-city')}</dd>
              <dt>Nommer</dt>
              <dd>{levelOf(city.id, 'name-city')}</dd>
            </dl>
            <div class="sandbox__actions">
              <button type="button" class="btn btn--teal" onClick={() => setFocusIds([entity.id])}>
                Voir {entity.name}
              </button>
            </div>
          </>
        )}
        {pick && !entity && (
          <p class="sandbox__hint">
            Mer ou zone neutre{pick.lonLat ? ` — ${formatLonLat(pick.lonLat)}` : ''}
          </p>
        )}
        {entity && !city && (
          <>
            <div class="sandbox__head">
              {flag && <img class="sandbox__flag" src={flag} alt="" width={64} height={48} />}
              <div>
                <h2 class="sandbox__name">{entity.name}</h2>
                <p class="sandbox__meta">
                  {CONTINENT_LABELS[entity.continent]} · {SUBREGION_LABELS[entity.subregion]}
                </p>
              </div>
              <button type="button" class="sandbox__close" onClick={() => setPick(null)} aria-label="Fermer">
                ×
              </button>
            </div>
            <dl class="sandbox__facts">
              <dt>Capitale</dt>
              <dd>
                {entity.capital?.name ?? '—'}
                {entity.otherCapitals.length > 0 && ` (aussi : ${entity.otherCapitals.map((c) => c.name).join(', ')})`}
              </dd>
              <dt>Statut</dt>
              <dd>
                {STATUS_LABELS[entity.status]}
                {sovereign && ` (${sovereign.name})`}
              </dd>
              <dt>Population</dt>
              <dd>{entity.population === null ? '—' : entity.population.toLocaleString('fr-FR')}</dd>
              {pick?.lonLat && (
                <>
                  <dt>Point touché</dt>
                  <dd>{formatLonLat(pick.lonLat)}</dd>
                </>
              )}
            </dl>
            <div class="sandbox__actions">
              <button type="button" class="btn btn--teal" onClick={() => setFocusIds([entity.id])}>
                Zoomer dessus
              </button>
              {(() => {
                const region = zones.find((z) => z.id === entity.subregion);
                return region ? (
                  <button
                    type="button"
                    class="btn btn--gold"
                    onClick={() => onPlay({ kind: 'builder', exercise: 'locate-country', zone: region, count: 10, content: 'mix' })}
                  >
                    Jouer : {region.label}
                  </button>
                ) : null;
              })()}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
