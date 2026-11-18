import { describe, expect, it } from 'vitest';
import { fitTransform, needsMarker, unionBounds } from './view-math.ts';

describe('unionBounds', () => {
  it('englobe plusieurs rectangles', () => {
    expect(
      unionBounds([
        [
          [0, 0],
          [10, 10],
        ],
        [
          [5, -5],
          [20, 8],
        ],
      ]),
    ).toEqual([
      [0, -5],
      [20, 10],
    ]);
  });

  it('ignore les rectangles invalides et renvoie null si rien ne reste', () => {
    expect(unionBounds([])).toBeNull();
    expect(
      unionBounds([
        [
          [NaN, 0],
          [1, 1],
        ],
      ]),
    ).toBeNull();
  });
});

describe('fitTransform', () => {
  const options = { padding: 10, maxScale: 50, minSize: 20 };

  it('centre et agrandit le rectangle dans l’écran', () => {
    const { k, x, y } = fitTransform(
      [
        [100, 100],
        [200, 150],
      ],
      1000,
      500,
      options,
    );
    // Limité par la largeur : (1000 - 20) / 100 = 9,8 ; par la hauteur : (500 - 20) / 50 = 9,6.
    expect(k).toBeCloseTo(9.6);
    // Le centre du rectangle (150, 125) arrive au centre de l'écran.
    expect(150 * k + x).toBeCloseTo(500);
    expect(125 * k + y).toBeCloseTo(250);
  });

  it('ne zoome pas au-delà du maximum, même sur un point', () => {
    const { k } = fitTransform(
      [
        [5, 5],
        [5, 5],
      ],
      1000,
      1000,
      { ...options, minSize: 0.001 },
    );
    expect(k).toBe(50);
  });

  it('ne dézoome jamais sous le cadrage de la zone', () => {
    const { k } = fitTransform(
      [
        [0, 0],
        [5000, 5000],
      ],
      1000,
      1000,
      options,
    );
    expect(k).toBe(1);
  });
});

describe('needsMarker', () => {
  it('donne un cercle aux entités trop petites, puis le retire quand on zoome', () => {
    expect(needsMarker(4, 1, 45)).toBe(true); // ex. Luxembourg en vue Monde
    expect(needsMarker(4, 4, 45)).toBe(false); // 4 × 4² = 64 px² : assez grand pour être cliqué
    expect(needsMarker(5000, 1, 45)).toBe(false);
  });
});
