// Petits calculs de cadrage, sans dépendance au DOM (testables).

/** Rectangle à l'écran : [[x0, y0], [x1, y1]]. */
export type Bounds = [[number, number], [number, number]];

/** Rectangle englobant plusieurs rectangles (null si la liste est vide ou invalide). */
export function unionBounds(list: Bounds[]): Bounds | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [[a, b], [c, d]] of list) {
    if (![a, b, c, d].every(Number.isFinite)) continue;
    x0 = Math.min(x0, a);
    y0 = Math.min(y0, b);
    x1 = Math.max(x1, c);
    y1 = Math.max(y1, d);
  }
  return Number.isFinite(x0) ? [[x0, y0], [x1, y1]] : null;
}

export interface FitOptions {
  /** Marge en pixels autour du rectangle. */
  padding: number;
  /** Zoom maximal autorisé. */
  maxScale: number;
  /** Taille minimale (en pixels, avant zoom) du rectangle : évite de zoomer à l'infini sur un micro-État. */
  minSize: number;
}

/** Transformation de zoom { k, x, y } qui centre et agrandit le rectangle dans un écran width × height. */
export function fitTransform(bounds: Bounds, width: number, height: number, options: FitOptions) {
  const [[x0, y0], [x1, y1]] = bounds;
  const dx = Math.max(x1 - x0, options.minSize);
  const dy = Math.max(y1 - y0, options.minSize);
  const available = (size: number) => Math.max(size - 2 * options.padding, 1);
  const k = Math.min(Math.max(Math.min(available(width) / dx, available(height) / dy), 1), options.maxScale);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return { k, x: width / 2 - k * cx, y: height / 2 - k * cy };
}

/**
 * Une entité reçoit un cercle de repère quand sa surface à l'écran est trop petite pour être cliquée
 * (comme sur Seterra) : surface de base × zoom² sous le seuil.
 */
export function needsMarker(baseAreaPx: number, zoom: number, thresholdPx: number): boolean {
  return baseAreaPx * zoom * zoom < thresholdPx;
}
