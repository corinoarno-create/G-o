import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWorldData, countries } from '../data/world.ts';
import { ANCHOR_SETTINGS, capitalAnchors, pendingCapitalEntities } from './anchors.ts';

const topology = JSON.parse(readFileSync(join(import.meta.dirname, '../../data/world/world.topo.json'), 'utf8'));
const world = buildWorldData(topology, countries);
const entity = (id: string) => world.byId.get(id)!;

describe('points d’ancrage (repères qui s’effacent)', () => {
  it('s’effacent à mesure que la capitale est retenue', () => {
    expect(capitalAnchors(world, entity('be'), 'new')).toHaveLength(ANCHOR_SETTINGS.count.new);
    expect(capitalAnchors(world, entity('be'), 'learning')).toHaveLength(ANCHOR_SETTINGS.count.learning);
    expect(capitalAnchors(world, entity('be'), 'acquired')).toHaveLength(1);
    expect(capitalAnchors(world, entity('be'), 'mastered')).toEqual([]);
  });

  it('montrent les capitales voisines les plus proches, jamais celle demandée', () => {
    const anchors = capitalAnchors(world, entity('be'), 'new');
    expect(anchors.map((a) => a.entityId)).not.toContain('be');
    // Bruxelles : Luxembourg (≈ 190 km) et Amsterdam (≈ 175 km) sont les plus proches.
    expect(anchors.map((a) => a.entityId).sort()).toEqual(['lu', 'nl']);
  });

  it('écartent une capitale trop proche, qui donnerait la réponse', () => {
    expect(capitalAnchors(world, entity('va'), 'new').map((a) => a.entityId)).not.toContain('it');
    expect(capitalAnchors(world, entity('sk'), 'new').map((a) => a.entityId)).not.toContain('at');
  });

  it('ne superposent pas deux repères (Rome et le Vatican)', () => {
    const anchors = capitalAnchors(world, entity('sm'), 'new');
    expect(anchors).toHaveLength(2);
    expect(anchors.map((a) => a.entityId).filter((id) => id === 'it' || id === 'va')).toHaveLength(1);
  });

  it('écartent les capitales encore à venir dans la manche', () => {
    const anchors = capitalAnchors(world, entity('be'), 'new', new Set(['nl']));
    expect(anchors.map((a) => a.entityId)).not.toContain('nl');
    expect(anchors).toHaveLength(2);
  });

  it('ne montrent rien pour une île isolée (aucune capitale assez proche)', () => {
    expect(capitalAnchors(world, entity('pn'), 'new')).toEqual([]);
  });

  it('repèrent les questions de capitale encore à venir', () => {
    const pending = pendingCapitalEntities(['locate-capital|fr', 'name-country|de', 'name-capital|es', 'capital-to-country|it']);
    expect([...pending].sort()).toEqual(['es', 'fr', 'it']);
  });
});
