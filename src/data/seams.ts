// Nettoyage des lignes de découpe des données (antiméridien, pôle Sud).
import type { MultiLineString, Position } from 'geojson';

const SEAM_EPSILON = 1e-3;

/**
 * Retire des lignes les segments de découpe des données : le long de l'antiméridien (±180°)
 * et du pôle Sud (-90°). Ce ne sont pas de vraies frontières, mais en vue polaire ou centrée
 * sur le Pacifique, ils apparaîtraient comme des traits au milieu de l'Antarctique ou des Fidji.
 */
export function removeSeams(lines: MultiLineString): MultiLineString {
  const onSeam = (a: Position, b: Position) =>
    (Math.abs(a[0]!) >= 180 - SEAM_EPSILON && Math.abs(b[0]!) >= 180 - SEAM_EPSILON) ||
    (a[1]! <= -90 + SEAM_EPSILON && b[1]! <= -90 + SEAM_EPSILON);
  const result: Position[][] = [];
  for (const line of lines.coordinates) {
    let current: Position[] = [];
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]!;
      const b = line[i]!;
      if (onSeam(a, b)) {
        if (current.length > 1) result.push(current);
        current = [];
      } else {
        if (current.length === 0) current.push(a);
        current.push(b);
      }
    }
    if (current.length > 1) result.push(current);
  }
  return { type: 'MultiLineString', coordinates: result };
}
