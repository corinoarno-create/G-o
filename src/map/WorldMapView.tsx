// Composant Preact autour du moteur de carte (WorldMap), avec les boutons de zoom.
import { useEffect, useRef } from 'preact/hooks';
import type { WorldData } from '../data/world.ts';
import { WorldMap, type HighlightKind, type MapPick, type MapPin } from './world-map.ts';
import type { Zone } from './zones.ts';
import './map.css';

interface Props {
  world: WorldData;
  zone: Zone;
  highlights?: Map<string, HighlightKind>;
  pins?: MapPin[];
  onPick?: (pick: MapPick) => void;
  /** Quand cette valeur change, la carte zoome sur ces entités. */
  focusIds?: string[] | null;
  /** Donne accès au moteur de carte pour les commandes ponctuelles (cadrer, recentrer). */
  onReady?: (map: WorldMap | null) => void;
}

export function WorldMapView({ world, zone, highlights, pins, onPick, focusIds, onReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<WorldMap | null>(null);
  // On passe par une référence pour que la carte appelle toujours la dernière version du gestionnaire.
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    const map = new WorldMap(containerRef.current!, world, { onPick: (pick) => onPickRef.current?.(pick) });
    mapRef.current = map;
    onReady?.(map);
    return () => {
      onReady?.(null);
      map.destroy();
      mapRef.current = null;
    };
    // onReady n'est lu qu'à la création de la carte.
  }, [world]);

  useEffect(() => mapRef.current?.setZone(zone), [world, zone]);
  useEffect(() => mapRef.current?.setHighlights(highlights ?? new Map()), [world, zone, highlights]);
  useEffect(() => mapRef.current?.setPins(pins ?? []), [world, zone, pins]);
  useEffect(() => {
    if (focusIds?.length) mapRef.current?.flyTo(focusIds);
  }, [focusIds]);

  return (
    <div class="map-frame">
      <div class="map-canvas" ref={containerRef} />
      <div class="map-controls" role="group" aria-label="Zoom">
        <button type="button" onClick={() => mapRef.current?.zoomBy(2)} aria-label="Zoomer" title="Zoomer">
          +
        </button>
        <button type="button" onClick={() => mapRef.current?.zoomBy(0.5)} aria-label="Dézoomer" title="Dézoomer">
          −
        </button>
        <button type="button" onClick={() => mapRef.current?.resetView()} aria-label="Recentrer" title="Recentrer">
          ⟲
        </button>
      </div>
    </div>
  );
}
