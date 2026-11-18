// Distances et tolérance du mode Épingler.
import { geoContains, geoDistance } from 'd3-geo';
import type { Feature, Geometry, Position } from 'geojson';
import { ENGINE_SETTINGS } from './settings.ts';

/** Rayon moyen de la Terre (km). */
export const EARTH_RADIUS_KM = 6371.0088;

/** Distance à vol d'oiseau (km) entre deux points [longitude, latitude]. */
export function distanceKm(a: [number, number], b: [number, number]): number {
  return geoDistance(a, b) * EARTH_RADIUS_KM;
}

function* rings(geometry: Geometry): Generator<Position[]> {
  switch (geometry.type) {
    case 'Polygon':
      yield* geometry.coordinates;
      break;
    case 'MultiPolygon':
      for (const polygon of geometry.coordinates) yield* polygon;
      break;
    default:
      break;
  }
}

/**
 * Point du segment [a, b] le plus proche de p, calculé dans une projection plane locale centrée sur p
 * (longitudes resserrées selon la latitude). Assez précis pour les distances qui nous intéressent.
 */
function closestOnSegment(p: [number, number], a: Position, b: Position): [number, number] {
  const scale = Math.cos((p[1] * Math.PI) / 180);
  // Longitudes ramenées près de p, pour les segments qui traversent l'antiméridien.
  const unwrap = (lon: number) => lon + 360 * Math.round((p[0] - lon) / 360);
  const ax = (unwrap(a[0]!) - p[0]) * scale;
  const ay = a[1]! - p[1];
  const bx = (unwrap(b[0]!) - p[0]) * scale;
  const by = b[1]! - p[1];
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(Math.max(-(ax * dx + ay * dy) / lengthSquared, 0), 1);
  return [p[0] + (ax + t * dx) / (scale || 1), p[1] + ay + t * dy];
}

/** Distance (km) d'un point à une zone : 0 s'il est dedans, sinon distance au bord le plus proche. */
export function distanceToShapeKm(shape: Feature<Geometry>, lon: number, lat: number): number {
  const point: [number, number] = [lon, lat];
  if (geoContains(shape, point)) return 0;
  let best = Infinity;
  for (const ring of rings(shape.geometry)) {
    for (let i = 1; i < ring.length; i++) {
      best = Math.min(best, geoDistance(point, closestOnSegment(point, ring[i - 1]!, ring[i]!)));
    }
  }
  return best * EARTH_RADIUS_KM;
}

/**
 * Rayon accepté (km) autour d'un point à placer, selon la taille du pays :
 * on tolère plus d'écart en Russie qu'à Monaco, à l'échelle de la carte qu'on regarde.
 */
export function pinToleranceKm(countryAreaKm2: number): number {
  const { toleranceFactor, minToleranceKm, maxToleranceKm } = ENGINE_SETTINGS.pin;
  const radius = toleranceFactor * Math.sqrt(Math.max(countryAreaKm2, 0));
  return Math.min(Math.max(radius, minToleranceKm), maxToleranceKm);
}

export type PinCloseness = 'hit' | 'near' | 'far';

export interface PinResult {
  correct: boolean;
  /** hit : dans la tolérance ; near : raté de peu (message encourageant) ; far : loin. */
  closeness: PinCloseness;
  distanceKm: number;
  toleranceKm: number;
}

/** Évalue un clic pour un point à placer (ex. une capitale). */
export function judgePointPin(click: [number, number], target: [number, number], countryAreaKm2: number): PinResult {
  const distance = distanceKm(click, target);
  const tolerance = pinToleranceKm(countryAreaKm2);
  const closeness: PinCloseness =
    distance <= tolerance ? 'hit' : distance <= tolerance * ENGINE_SETTINGS.pin.nearFactor ? 'near' : 'far';
  return { correct: closeness === 'hit', closeness, distanceKm: distance, toleranceKm: tolerance };
}

/**
 * Évalue un clic pour une zone à trouver (ex. un pays) : juste si on a cliqué la bonne entité
 * (sa forme ou son cercle de repère). La distance à la zone sert au message (« à 120 km près »).
 */
export function judgeAreaPin(
  clickedId: string | null,
  targetId: string,
  click: [number, number] | null,
  targetShape: Feature<Geometry> | undefined,
): PinResult {
  if (clickedId === targetId) return { correct: true, closeness: 'hit', distanceKm: 0, toleranceKm: 0 };
  const distance = click && targetShape ? distanceToShapeKm(targetShape, click[0], click[1]) : Infinity;
  // Pour une zone, « presque » = juste à côté (pays voisin, petite île manquée).
  const closeness: PinCloseness = distance <= ENGINE_SETTINGS.pin.minToleranceKm * ENGINE_SETTINGS.pin.nearFactor ? 'near' : 'far';
  return { correct: false, closeness, distanceKm: distance, toleranceKm: 0 };
}
