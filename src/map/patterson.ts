// Projection de Patterson (2014) : planisphère rectangulaire, compromis entre Miller et l'équirectangulaire.
// Formules reprises de d3-geo-projection (licence ISC), écrites ici pour éviter une dépendance de plus.
import { geoProjection, type GeoProjection } from 'd3-geo';

const K1 = 1.0148;
const K2 = 0.23185;
const K3 = -0.14499;
const K4 = 0.02406;
const C1 = K1;
const C2 = 5 * K2;
const C3 = 7 * K3;
const C4 = 9 * K4;
/** Ordonnée du pôle (radians projetés). */
const Y_MAX = 1.790857183;

function pattersonY(phi: number): number {
  const phi2 = phi * phi;
  return phi * (K1 + phi2 * phi2 * (K2 + phi2 * (K3 + K4 * phi2)));
}

function pattersonRaw(lambda: number, phi: number): [number, number] {
  return [lambda, pattersonY(phi)];
}

/** Inverse par la méthode de Newton (sert à convertir un clic en longitude/latitude). */
pattersonRaw.invert = (x: number, y: number): [number, number] => {
  const target = Math.max(-Y_MAX, Math.min(Y_MAX, y));
  let phi = target;
  for (let i = 0; i < 25; i += 1) {
    const phi2 = phi * phi;
    const delta = (pattersonY(phi) - target) / (C1 + phi2 * phi2 * (C2 + phi2 * (C3 + C4 * phi2)));
    phi -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return [x, phi];
};

export function geoPatterson(): GeoProjection {
  return geoProjection(pattersonRaw).scale(144.85);
}

/**
 * Cadre du planisphère : on coupe l'Antarctique (on y accède en faisant défiler) pour que
 * les terres habitées occupent plus de place à l'écran.
 */
export const WORLD_CROP = { south: -57, north: 84 };

/** Rapport largeur / hauteur du planisphère recadré. */
export const WORLD_RATIO =
  (2 * Math.PI) / (pattersonY((WORLD_CROP.north * Math.PI) / 180) - pattersonY((WORLD_CROP.south * Math.PI) / 180));

/** Points qui délimitent le cadre du planisphère (pour fitExtent). */
export const WORLD_CROP_POINTS: [number, number][] = [
  [-180, WORLD_CROP.south],
  [180, WORLD_CROP.south],
  [-180, WORLD_CROP.north],
  [180, WORLD_CROP.north],
];
