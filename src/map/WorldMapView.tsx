// Composant Preact autour du moteur de carte (WorldMap), avec les boutons de zoom.
import { useEffect, useRef } from 'preact/hooks';
import type { WorldData } from '../data/world.ts';
import {
  WorldMap,
  type HighlightKind,
  type MapFill,
  type MapInsets,
  type MapLabel,
  type MapLine,
  type MapPick,
  type MapPin,
  type MapPlace,
} from './world-map.ts';
import type { Zone } from './zones.ts';
import './map.css';

interface Props {
  world: WorldData;
  zone: Zone;
  highlights?: Map<string, HighlightKind>;
  pins?: MapPin[];
  /** Traits en pointillé (mon clic → la bonne position). */
  lines?: MapLine[];
  /** Étiquettes de noms (découverte). */
  labels?: MapLabel[];
  /** Loupe sur les groupes de petits pays (en jeu). */
  magnify?: boolean;
  /** Couleurs imposées (carte de conquête). */
  fills?: Map<string, MapFill>;
  /** Carte d'illustration : ni zoom, ni clic, ni boutons. */
  interactive?: boolean;
  /** Carte fixe mais cliquable (sans zoom ni boutons). */
  clickOnly?: boolean;
  /** Place prise par les éléments posés sur la carte (voir WorldMap.setInsets). */
  insets?: MapInsets;
  onPick?: (pick: MapPick) => void;
  /** Seuls ces cercles de repère sont affichés (par défaut : tous). */
  markerIds?: string[] | null;
  /** Quand cette valeur change, la carte zoome sur ces entités. */
  focusIds?: string[] | null;
  /** Lieux cliquables (villes, capitales) de la carte libre. */
  places?: MapPlace[];
  /** Donne accès au moteur de carte pour les commandes ponctuelles (cadrer, recentrer). */
  onReady?: (map: WorldMap | null) => void;
}

export function WorldMapView({
  world,
  zone,
  highlights,
  pins,
  lines,
  labels,
  magnify,
  fills,
  interactive = true,
  clickOnly = false,
  insets,
  onPick,
  focusIds,
  markerIds,
  places,
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<WorldMap | null>(null);
  // On passe par une référence pour que la carte appelle toujours la dernière version du gestionnaire.
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    const map = new WorldMap(containerRef.current!, world, {
      onPick: (pick) => onPickRef.current?.(pick),
      magnify,
      interactive,
      clickOnly,
    });
    mapRef.current = map;
    onReady?.(map);
    return () => {
      onReady?.(null);
      map.destroy();
      mapRef.current = null;
    };
    // onReady n'est lu qu'à la création de la carte.
  }, [world]);

  // Les marges d'abord : setZone cadre la zone avec elles.
  useEffect(() => {
    if (insets) mapRef.current?.setInsets(insets);
  }, [world, insets?.top, insets?.bottom, insets?.left, insets?.right]);
  useEffect(() => mapRef.current?.setZone(zone), [world, zone]);
  useEffect(() => mapRef.current?.setHighlights(highlights ?? new Map()), [world, zone, highlights]);
  useEffect(() => mapRef.current?.setPins(pins ?? []), [world, zone, pins]);
  useEffect(() => mapRef.current?.setLines(lines ?? []), [world, zone, lines]);
  useEffect(() => mapRef.current?.setLabels(labels ?? []), [world, zone, labels]);
  useEffect(() => mapRef.current?.setFills(fills ?? new Map()), [world, zone, fills]);
  useEffect(() => mapRef.current?.setMarkerFilter(markerIds ?? null), [world, zone, markerIds?.join(',')]);
  useEffect(() => mapRef.current?.setPlaces(places ?? []), [world, zone, places]);
  useEffect(() => {
    if (focusIds?.length) mapRef.current?.flyTo(focusIds, undefined, [], 800);
  }, [focusIds]);

  return (
    <div class="map-frame">
      <div class="map-canvas" ref={containerRef} />
      {interactive && !clickOnly && (
        <div class="map-controls" role="group" aria-label="Zoom">
          <button
            type="button"
            onClick={() => mapRef.current?.zoomBy(2)}
            aria-label="Zoomer"
            title="Zoomer (sur PC : maintiens Ctrl ou Espace au-dessus de la carte pour choisir la zone)"
          >
            +
          </button>
          <button type="button" onClick={() => mapRef.current?.zoomBy(0.5)} aria-label="Dézoomer" title="Dézoomer">
            −
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.resetView()}
            aria-label="Recentrer"
            title="Recentrer (sur PC : Échap ou clic droit)"
          >
            ⟲
          </button>
        </div>
      )}
    </div>
  );
}
