// Découpage des tracés en morceaux géographiquement compacts.
//
// Pourquoi : quand la carte est très zoomée (Caraïbes, Pacifique), le navigateur ne dessine que les tuiles
// visibles, et saute tout tracé dont l'emprise ne touche pas la tuile. Mais un tracé d'un seul tenant qui fait
// le tour du monde (toutes les côtes, toutes les frontières, le quadrillage, ou les États-Unis avec Hawaï et les
// Aléoutiennes) touche toutes les tuiles : il est retraité en entier pour chacune. Découpé par cases de
// quelques degrés, seul ce qui est près de l'écran est dessiné.
import type { MultiLineString, MultiPolygon, Polygon, Position } from 'geojson';

/** Taille des cases (degrés). */
export const CHUNK_DEGREES = 10;
/** Nombre maximal de points d'un morceau de ligne. */
const MAX_LINE_POINTS = 200;

function cellOf([lon, lat]: Position, size: number): string {
  return `${Math.floor(lon! / size)}:${Math.floor(lat! / size)}`;
}

/**
 * Coupe des lignes en morceaux qui restent dans une case (à un segment près, pour ne laisser aucun trou),
 * puis regroupe les morceaux par case.
 */
export function chunkLines(geometry: MultiLineString, size = CHUNK_DEGREES, maxPoints = MAX_LINE_POINTS): MultiLineString[] {
  const groups = new Map<string, Position[][]>();
  const add = (piece: Position[]) => {
    if (piece.length < 2) return;
    const key = cellOf(piece[0]!, size);
    let group = groups.get(key);
    if (!group) groups.set(key, (group = []));
    group.push(piece);
  };
  for (const line of geometry.coordinates) {
    let piece: Position[] = [];
    let cell = '';
    for (const point of line) {
      const pointCell = cellOf(point, size);
      if (piece.length === 0) {
        cell = pointCell;
      } else if (pointCell !== cell || piece.length >= maxPoints) {
        // Le point qui sort de la case termine le morceau et commence le suivant : la ligne reste continue.
        piece.push(point);
        add(piece);
        piece = [];
        cell = pointCell;
      }
      piece.push(point);
    }
    add(piece);
  }
  return [...groups.values()].map((coordinates) => ({ type: 'MultiLineString', coordinates }));
}

/**
 * Regroupe les parties d'un territoire (îles) par case, d'après le centre de leur emprise.
 * Une grande terre reste d'un seul tenant ; les îles lointaines forment des tracés à part.
 */
export function chunkPolygons(geometry: Polygon | MultiPolygon, size = CHUNK_DEGREES): Array<Polygon | MultiPolygon> {
  if (geometry.type === 'Polygon') return [geometry];
  const groups = new Map<string, Position[][][]>();
  for (const polygon of geometry.coordinates) {
    let west = Infinity;
    let east = -Infinity;
    let south = Infinity;
    let north = -Infinity;
    for (const [lon, lat] of polygon[0] ?? []) {
      west = Math.min(west, lon!);
      east = Math.max(east, lon!);
      south = Math.min(south, lat!);
      north = Math.max(north, lat!);
    }
    const key = cellOf([(west + east) / 2, (south + north) / 2], size);
    let group = groups.get(key);
    if (!group) groups.set(key, (group = []));
    group.push(polygon);
  }
  return [...groups.values()].map((coordinates) =>
    coordinates.length === 1 ? { type: 'Polygon', coordinates: coordinates[0]! } : { type: 'MultiPolygon', coordinates },
  );
}
