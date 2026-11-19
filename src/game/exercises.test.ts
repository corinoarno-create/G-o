import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWorldData, countries } from '../data/world.ts';
import { distanceKm } from '../engine/geo.ts';
import { SHOW_FRAME, showFrame } from './exercises.ts';

const topology = JSON.parse(readFileSync(join(import.meta.dirname, '../../data/world/world.topo.json'), 'utf8'));
const world = buildWorldData(topology, countries);
const entity = (id: string) => world.byId.get(id)!;

describe('showFrame', () => {
  it('garde au moins 1 500 km autour d’une petite île', () => {
    const frame = showFrame(world, entity('dm'));
    expect(frame.ids).toEqual(['dm']);
    expect(frame.minKm).toBe(SHOW_FRAME.minKm);
    expect(frame.points).toHaveLength(2);
  });

  it('ajoute des voisins pour situer un territoire isolé, sans aller trop loin', () => {
    const io = entity('io');
    const frame = showFrame(world, io);
    expect(frame.points.length).toBeGreaterThan(0);
    for (const point of frame.points) expect(distanceKm(io.anchor, point)).toBeLessThanOrEqual(SHOW_FRAME.maxNeighbourKm);
  });
});
