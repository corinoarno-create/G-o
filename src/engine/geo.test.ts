import type { Feature, Polygon } from 'geojson';
import { describe, expect, it } from 'vitest';
import { distanceKm, judgeAreaPin, judgePointPin, pinToleranceKm } from './geo.ts';

const PARIS: [number, number] = [2.3522, 48.8566];
const LYON: [number, number] = [4.8357, 45.764];
/** Point situé `km` au nord de `point` (1° de latitude ≈ 111,2 km). */
const north = (point: [number, number], km: number): [number, number] => [point[0], point[1] + km / 111.195];

describe('distanceKm', () => {
  it('mesure la distance à vol d’oiseau', () => {
    expect(distanceKm(PARIS, LYON)).toBeGreaterThan(385);
    expect(distanceKm(PARIS, LYON)).toBeLessThan(400);
    expect(distanceKm(PARIS, PARIS)).toBe(0);
  });
});

describe('pinToleranceKm', () => {
  it('dépend de la taille du pays, dans des bornes raisonnables', () => {
    expect(pinToleranceKm(551_695)).toBeCloseTo(89.1, 0); // France métropolitaine
    expect(pinToleranceKm(2)).toBe(60); // Monaco : minimum
    expect(pinToleranceKm(17_000_000)).toBe(300); // Russie : maximum
  });
});

describe('judgePointPin', () => {
  const france = 551_695;

  it('accepte un clic dans la tolérance', () => {
    expect(judgePointPin(north(PARIS, 30), PARIS, france)).toMatchObject({ correct: true, closeness: 'hit' });
  });

  it('signale un clic raté de peu', () => {
    const result = judgePointPin(north(PARIS, 100), PARIS, france);
    expect(result).toMatchObject({ correct: false, closeness: 'near' });
    expect(result.distanceKm).toBeCloseTo(100, 0);
  });

  it('refuse un clic lointain', () => {
    expect(judgePointPin(LYON, PARIS, france)).toMatchObject({ correct: false, closeness: 'far' });
  });
});

describe('judgeAreaPin', () => {
  // Carré de 1° × 1° (anneau dans le sens horaire, comme l'attend d3).
  const square: Feature<Polygon> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [0, 0],
        ],
      ],
    },
  };

  it('est juste quand on clique la bonne entité', () => {
    expect(judgeAreaPin('fr', 'fr', [0.5, 0.5], square)).toMatchObject({ correct: true, closeness: 'hit' });
  });

  it('signale un clic juste à côté', () => {
    const result = judgeAreaPin(null, 'fr', [1.1, 0.5], square);
    expect(result).toMatchObject({ correct: false, closeness: 'near' });
    expect(result.distanceKm).toBeGreaterThan(5);
    expect(result.distanceKm).toBeLessThan(25);
  });

  it('refuse un clic loin de l’entité', () => {
    expect(judgeAreaPin('de', 'fr', [5, 5], square)).toMatchObject({ correct: false, closeness: 'far' });
  });
});
