import { describe, expect, it } from 'vitest';
import { geoPatterson, WORLD_RATIO } from './patterson.ts';

describe('geoPatterson', () => {
  it('retrouve la longitude et la latitude d’un point projeté (clic)', () => {
    const projection = geoPatterson();
    for (const point of [
      [2.35, 48.85],
      [-77.03, -12.05],
      [151.2, -33.87],
      [-170.7, -14.3],
      [0, 80],
    ] as [number, number][]) {
      const back = projection.invert!(projection(point)!)!;
      expect(back[0]).toBeCloseTo(point[0], 6);
      expect(back[1]).toBeCloseTo(point[1], 6);
    }
  });

  it('donne un planisphère recadré plus large que haut', () => {
    expect(WORLD_RATIO).toBeGreaterThan(1.8);
    expect(WORLD_RATIO).toBeLessThan(2.4);
  });
});
