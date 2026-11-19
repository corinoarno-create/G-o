import { describe, expect, it } from 'vitest';
import type { MultiPolygon } from 'geojson';
import { chunkLines, chunkPolygons } from './chunks.ts';

describe('chunkLines', () => {
  it('coupe une longue ligne par case, sans perdre de point ni laisser de trou', () => {
    const line = Array.from({ length: 41 }, (_, i) => [-20 + i, 5]);
    const chunks = chunkLines({ type: 'MultiLineString', coordinates: [line] });
    // De -20 à 20° de longitude : 4 cases de 10°.
    expect(chunks).toHaveLength(4);
    const pieces = chunks.flatMap((chunk) => chunk.coordinates);
    // Chaque morceau commence là où le précédent finit.
    const ordered = [...pieces].sort((a, b) => a[0]![0]! - b[0]![0]!);
    for (let i = 1; i < ordered.length; i += 1) expect(ordered[i]![0]).toEqual(ordered[i - 1]!.at(-1));
    expect(ordered[0]![0]).toEqual([-20, 5]);
    expect(ordered.at(-1)!.at(-1)).toEqual([20, 5]);
  });

  it('limite le nombre de points par morceau', () => {
    const line = Array.from({ length: 500 }, (_, i) => [1 + i / 1000, 1]);
    const pieces = chunkLines({ type: 'MultiLineString', coordinates: [line] }, 10, 100)[0]!.coordinates;
    expect(pieces.length).toBeGreaterThan(4);
    expect(Math.max(...pieces.map((piece) => piece.length))).toBeLessThanOrEqual(101);
  });
});

describe('chunkPolygons', () => {
  it('sépare les îles lointaines et garde ensemble les voisines', () => {
    const square = (lon: number, lat: number) => [
      [
        [lon, lat],
        [lon + 1, lat],
        [lon + 1, lat + 1],
        [lon, lat + 1],
        [lon, lat],
      ],
    ];
    const geometry: MultiPolygon = { type: 'MultiPolygon', coordinates: [square(-100, 30), square(-98, 32), square(-157, 20)] };
    const chunks = chunkPolygons(geometry);
    expect(chunks).toHaveLength(2);
    expect(chunks.map((chunk) => chunk.type).sort()).toEqual(['MultiPolygon', 'Polygon']);
  });
});
