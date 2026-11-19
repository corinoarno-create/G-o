import { describe, expect, it } from 'vitest';
import { FRAME_ZOOM_SETTINGS, frameRect, nextDivisor } from './frame-zoom.ts';

describe('frameRect', () => {
  it('centre sur la souris un rectangle aux proportions de l’espace libre', () => {
    const rect = frameRect([500, 300], { left: 0, top: 100, width: 1000, height: 600 }, 10);
    expect(rect).toEqual({ x: 450, y: 270, width: 100, height: 60 });
  });
});

describe('nextDivisor', () => {
  it('molette vers le haut : rectangle plus petit (zoom plus fort), dans les limites', () => {
    expect(nextDivisor(10, -100)).toBeCloseTo(11.5);
    expect(nextDivisor(10, 100)).toBeCloseTo(10 / 1.15);
    expect(nextDivisor(FRAME_ZOOM_SETTINGS.maxDivisor, -100)).toBe(FRAME_ZOOM_SETTINGS.maxDivisor);
    expect(nextDivisor(FRAME_ZOOM_SETTINGS.minDivisor, 100)).toBe(FRAME_ZOOM_SETTINGS.minDivisor);
  });
});
