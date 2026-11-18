import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWorldData, countries } from '../data/world.ts';
import { boxCenter, boxSamplePoints, boxWidth, buildZones } from './zones.ts';

const topology = JSON.parse(readFileSync(join(import.meta.dirname, '../../data/world/world.topo.json'), 'utf8'));
const world = buildWorldData(topology, countries);
const zones = buildZones(world);
const zone = (id: string) => zones.find((z) => z.id === id)!;

describe('boîtes géographiques', () => {
  const pacific = { west: 150, south: -30, east: -150, north: 0 };

  it('mesurent la largeur à travers l’antiméridien', () => {
    expect(boxWidth(pacific)).toBe(60);
    expect(boxCenter(pacific)).toEqual([180, -15]);
  });

  it('échantillonnent des longitudes valides', () => {
    for (const [lon] of boxSamplePoints(pacific)) {
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
    }
  });
});

describe('zones', () => {
  it('commencent par le Monde, avec toutes les entités', () => {
    expect(zones[0]).toMatchObject({ id: 'world', kind: 'world' });
    expect(zones[0]!.entityIds).toHaveLength(countries.length);
  });

  it('couvrent chaque entité exactement une fois par niveau (continents, sous-régions)', () => {
    const count = (kind: string) => zones.filter((z) => z.kind === kind).flatMap((z) => z.entityIds);
    const continentIds = count('continent');
    expect(new Set(continentIds).size).toBe(continentIds.length);
    expect(continentIds).toHaveLength(countries.length);
    // Seul l'Antarctique n'a pas de sous-région distincte de son continent.
    const subregionIds = count('subregion');
    expect(new Set(subregionIds).size).toBe(subregionIds.length);
    expect(subregionIds).toHaveLength(countries.filter((c) => c.continent !== 'antarctica').length);
  });

  it('cadrent l’Océanie à travers l’antiméridien', () => {
    const box = zone('oceania').view.box!;
    expect(box.east).toBeLessThan(box.west);
    expect(boxCenter(box)[0]).toBeGreaterThan(150);
  });

  it('ne laissent pas les îles lointaines élargir le cadre', () => {
    // Amérique du Nord : les îles mineures éloignées (Pacifique) sont ignorées pour le cadrage.
    const box = zone('northern-america').view.box!;
    expect(box.west).toBeGreaterThan(-180);
    expect(box.west).toBeLessThan(-150);
    // France métropolitaine seule : la Guyane et La Réunion sont des entités à part.
    const france = world.mainShapes.get('fr')!;
    expect(france.geometry.type).toBe('Polygon');
  });

  it('montrent l’Europe sans toute la Sibérie', () => {
    expect(zone('europe').view.box!.east).toBeLessThanOrEqual(50);
  });
});
