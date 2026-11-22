import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWorldData, countries } from '../data/world.ts';
import { buildChoices, cityAsEntity, choiceLabel, discoveryFamily, nextQueue, recognizeQuestion } from './discovery.ts';

const topology = JSON.parse(readFileSync(join(import.meta.dirname, '../../data/world/world.topo.json'), 'utf8'));
const world = buildWorldData(topology, countries);
const entity = (id: string) => world.byId.get(id)!;
const seeded = () => {
  let seed = 7;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
};

describe('discoveryFamily', () => {
  it('range chaque exercice dans ce qu’on apprend', () => {
    expect(discoveryFamily('locate-country')).toBe('country');
    expect(discoveryFamily('capital-to-country')).toBe('capital');
    expect(discoveryFamily('country-to-flag')).toBe('flag');
    expect(discoveryFamily('name-city')).toBe('city');
  });
});

describe('découverte des villes', () => {
  it('présente une ville comme un point à reconnaître, sans dévoiler son pays', () => {
    const lyon = world.cities.find((city) => city.name === 'Lyon')!;
    const asEntity = cityAsEntity(world, lyon)!;
    expect(asEntity).toMatchObject({ id: lyon.id, name: 'France', capital: { name: 'Lyon' } });
    expect(recognizeQuestion('locate-city', asEntity)).toMatchObject({ ask: 'Quelle est cette ville ?', pin: [lyon.lon, lyon.lat], choiceKind: 'capital' });
    expect(choiceLabel(world, lyon.id, 'capital')).toBe('Lyon');
  });
});

describe('recognizeQuestion', () => {
  it('montre l’élément sous la forme où il sera demandé ensuite', () => {
    expect(recognizeQuestion('locate-country', entity('pe'))).toMatchObject({
      highlight: 'pe',
      choiceKind: 'country',
      subject: null,
    });
    expect(recognizeQuestion('name-capital', entity('pe'))).toMatchObject({
      subject: 'Pérou',
      choiceKind: 'capital',
    });
    expect(recognizeQuestion('capital-to-country', entity('pe'))).toMatchObject({ subject: 'Lima', choiceKind: 'country' });
    expect(recognizeQuestion('flag-to-country', entity('pe'))).toMatchObject({
      showFlag: true,
      choiceKind: 'country',
    });
  });
});

describe('buildChoices', () => {
  it('propose le bon élément et d’abord les autres éléments du groupe', () => {
    const group = ['pe', 'cl', 'bo', 'ec', 'co'].map(entity);
    const choices = buildChoices(entity('pe'), group, world.countries, seeded());
    expect(choices).toHaveLength(4);
    expect(choices).toContain('pe');
    expect(new Set(choices).size).toBe(4);
    for (const id of choices) expect(['pe', 'cl', 'bo', 'ec', 'co']).toContain(id);
  });

  it('complète avec des voisins quand le groupe est trop petit', () => {
    const choices = buildChoices(entity('pe'), [entity('pe'), entity('cl')], world.countries, seeded());
    expect(choices).toHaveLength(4);
    expect(choices).toContain('cl');
    for (const id of choices) expect(entity(id).continent).toBe('americas');
  });
});

describe('nextQueue', () => {
  it('retire un élément réussi et fait revenir un raté un peu plus tard', () => {
    expect(nextQueue(['a', 'b', 'c', 'd'], true)).toEqual(['b', 'c', 'd']);
    expect(nextQueue(['a', 'b', 'c', 'd'], false)).toEqual(['b', 'c', 'a', 'd']);
    expect(nextQueue(['a', 'b'], false)).toEqual(['b', 'a']);
    expect(nextQueue(['a'], false)).toEqual(['a']);
  });
});
