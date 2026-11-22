import { describe, expect, it } from 'vitest';
import type { Feature, LineString } from 'geojson';
import { selectAdmin1Lines, type Admin1LineProperties } from './landmarks.ts';

const line = (ADM0_A3: string, FEATURECLA: string, MIN_ZOOM: number): Feature<LineString, Admin1LineProperties> => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
  properties: { ADM0_A3, FEATURECLA, MIN_ZOOM },
});

describe('limites intérieures', () => {
  it('gardent le niveau le plus grossier de chaque pays (régions plutôt que départements)', () => {
    const kept = selectAdmin1Lines([
      line('FRA', 'Admin-1 region boundary', 6),
      line('FRA', 'Admin-1 boundary', 8),
      line('USA', 'Admin-1 boundary', 2),
    ]);
    expect(kept.map((f) => `${f.properties.ADM0_A3} ${f.properties.MIN_ZOOM}`)).toEqual(['FRA 6', 'USA 2']);
  });

  it('écartent les fausses limites, les pays émiettés et les petits pays', () => {
    const kept = selectAdmin1Lines(
      [line('USA', 'Admin-1 statistical meta bounds', 2), line('GBR', 'Admin-1 boundary', 10), line('LUX', 'Admin-1 boundary', 8), line('DEU', 'Admin-1 boundary', 5)],
      new Map([['LUX', 2586], ['DEU', 357_000]]),
    );
    expect(kept.map((f) => f.properties.ADM0_A3)).toEqual(['DEU']);
  });
});
