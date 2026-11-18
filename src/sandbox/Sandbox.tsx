// Bac à sable de la carte (étape 2) : choisir une zone, cliquer sur un pays et voir sa fiche,
// ou lancer une manche (étape 5). L'accueil le remplacera à l'étape 7.
import { useMemo, useState } from 'preact/hooks';
import { flagUrl } from '../data/flags.ts';
import { CONTINENT_LABELS, STATUS_LABELS, SUBREGION_LABELS } from '../data/labels.ts';
import type { WorldData } from '../data/world.ts';
import type { HighlightKind, MapPick } from '../map/world-map.ts';
import { WorldMapView } from '../map/WorldMapView.tsx';
import { buildZones } from '../map/zones.ts';
import type { GameConfig } from '../game/start.ts';
import { BackupButtons } from './BackupButtons.tsx';
import { Launcher } from './Launcher.tsx';
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
  onPlay: (config: GameConfig) => void;
}

export function Sandbox({ world, zoneId, onZoneChange, onPlay }: Props) {
  const zones = useMemo(() => buildZones(world), [world]);
  const [pick, setPick] = useState<MapPick | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [focusIds, setFocusIds] = useState<string[] | null>(null);
  const zone = zones.find((z) => z.id === zoneId) ?? zones[0]!;

  const entity = pick?.entityId ? world.byId.get(pick.entityId) : undefined;
  const highlights = useMemo(
    () => new Map<string, HighlightKind>(entity ? [[entity.id, 'selected']] : []),
    [entity],
  );
  const sovereign = entity?.sovereign ? world.byId.get(entity.sovereign) : undefined;
  const flag = flagUrl(entity?.flag ?? null);

  return (
    <div class="sandbox">
      <header class="sandbox__bar">
        <h1 class="sandbox__title">Géo</h1>
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
        <button type="button" class="sandbox__play" onClick={() => setLauncherOpen(true)}>
          Jouer
        </button>
        <BackupButtons />
      </header>

      <main class="sandbox__map">
        <WorldMapView world={world} zone={zone} highlights={highlights} onPick={setPick} focusIds={focusIds} />
      </main>

      {launcherOpen && (
        <aside class="sandbox__card sandbox__card--launcher">
          <Launcher zone={zone} onStart={onPlay} onClose={() => setLauncherOpen(false)} />
        </aside>
      )}

      <aside class="sandbox__card" aria-live="polite" hidden={launcherOpen}>
        {!pick && <p class="sandbox__hint">Clique ou touche un pays pour voir sa fiche.</p>}
        {pick && !entity && (
          <p class="sandbox__hint">
            Mer ou zone neutre{pick.lonLat ? ` — ${formatLonLat(pick.lonLat)}` : ''}
          </p>
        )}
        {entity && (
          <>
            <div class="sandbox__head">
              {flag && <img class="sandbox__flag" src={flag} alt="" width={48} height={36} />}
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
            <button type="button" class="sandbox__action" onClick={() => setFocusIds([entity.id])}>
              Zoomer dessus
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
