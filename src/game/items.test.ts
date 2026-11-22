import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWorldData, countries } from '../data/world.ts';
import { cityAnchors } from './anchors.ts';
import { answerLabel, isEligible, itemCountry, itemIds } from './items.ts';
import { evaluateAnswer, isExactTypedAnswer } from './session.ts';

const topology = JSON.parse(readFileSync(join(import.meta.dirname, '../../data/world/world.topo.json'), 'utf8'));
const world = buildWorldData(topology, countries);
const cityNamed = (name: string, country: string) => world.cities.find((c) => c.name === name && c.country === country)!;
const fr = world.byId.get('fr')!;
const lyon = cityNamed('Lyon', 'fr');

describe('éléments : pays et villes', () => {
  it('donne les villes des pays d’une zone pour un exercice de villes', () => {
    const ids = itemIds(world, 'locate-city', ['fr', 'be']);
    expect(ids).toContain(lyon.id);
    expect(ids).toHaveLength(15); // 10 villes françaises + 5 belges
    expect(itemIds(world, 'locate-country', ['fr', 'be'])).toEqual(['fr', 'be']);
  });

  it('reconnaît une ville, son pays et son libellé', () => {
    expect(isEligible(world, 'name-city', lyon.id)).toBe(true);
    expect(isEligible(world, 'name-city', 'fr')).toBe(false);
    expect(itemCountry(world, lyon.id)?.id).toBe('fr');
    expect(answerLabel(world, 'locate-city', lyon.id)).toBe('Lyon (France)');
  });
});

describe('réponses sur les villes', () => {
  it('juge la ville placée à la distance', () => {
    const near = evaluateAnswer('locate-city', fr, { kind: 'pin', entityId: 'fr', lonLat: [lyon.lon + 0.2, lyon.lat] }, world, () => 0, lyon);
    expect(near.correct).toBe(true);
    expect(near.answerLabel).toBe('Lyon (France)');
    const far = evaluateAnswer('locate-city', fr, { kind: 'pin', entityId: 'fr', lonLat: [2.35, 48.85] }, world, () => 0, lyon);
    expect(far.correct).toBe(false);
    expect(far.distanceKm).toBeGreaterThan(350);
  });

  it('accepte le nom de la ville, ses autres noms, et repère une confusion avec une autre ville du pays', () => {
    expect(isExactTypedAnswer('name-city', fr, 'lyon', world, lyon)).toBe(true);
    const bombay = cityNamed('Bombay', 'in');
    expect(isExactTypedAnswer('name-city', world.byId.get('in')!, 'Mumbai', world, bombay)).toBe(true);
    const confused = evaluateAnswer('name-city', fr, { kind: 'type', text: 'Marseille' }, world, () => 0, lyon);
    expect(confused.correct).toBe(false);
    expect(confused.message).toContain('une autre ville');
  });
});

describe('points d’ancrage des villes', () => {
  it('montrent la capitale et des villes connues, puis s’effacent', () => {
    const marseille = cityNamed('Marseille', 'fr');
    const known = new Set([marseille.id]);
    expect(cityAnchors(world, lyon, 'new', known).map((a) => a.name)).toEqual(['Paris', 'Marseille']);
    expect(cityAnchors(world, lyon, 'acquired', known).map((a) => a.name)).toEqual(['Paris']);
    expect(cityAnchors(world, lyon, 'mastered', known)).toEqual([]);
  });

  it('ne montrent pas une ville encore à venir dans la manche', () => {
    const marseille = cityNamed('Marseille', 'fr');
    expect(cityAnchors(world, lyon, 'new', new Set([marseille.id]), new Set([marseille.id])).map((a) => a.name)).toEqual(['Paris']);
  });
});
