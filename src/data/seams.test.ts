import { describe, expect, it } from 'vitest';
import { removeSeams } from './seams.ts';

describe('removeSeams', () => {
  it('coupe une ligne là où elle longe l’antiméridien', () => {
    const result = removeSeams({
      type: 'MultiLineString',
      coordinates: [
        [
          [170, -10],
          [180, -10],
          [180, -20],
          [170, -20],
        ],
      ],
    });
    expect(result.coordinates).toEqual([
      [
        [170, -10],
        [180, -10],
      ],
      [
        [180, -20],
        [170, -20],
      ],
    ]);
  });

  it('retire le bord du pôle Sud et garde les vraies côtes', () => {
    const result = removeSeams({
      type: 'MultiLineString',
      coordinates: [
        [
          [-180, -90],
          [0, -90],
          [180, -90],
        ],
        [
          [10, -70],
          [20, -71],
        ],
      ],
    });
    expect(result.coordinates).toEqual([
      [
        [10, -70],
        [20, -71],
      ],
    ]);
  });
});
