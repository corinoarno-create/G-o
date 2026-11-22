import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { buildWorldData, countries } from '../data/world.ts';
import type { Skill } from '../engine/srs.ts';
import { buildZones } from '../map/zones.ts';
import type { CardRecord } from '../storage/schema.ts';
import { percent, zoneProgress } from './zone-stats.ts';

const topology = JSON.parse(readFileSync(join(import.meta.dirname, '../../data/world/world.topo.json'), 'utf8'));
const world = buildWorldData(topology, countries);
const zones = buildZones(world);
const europe = zones.find((zone) => zone.id === 'europe')!;
const now = new Date('2026-11-18T09:00:00Z');

function card(entityId: string, skill: Skill, dueAt: string, stability: number): [string, CardRecord] {
  const key = `${entityId}:${skill}`;
  return [
    key,
    {
      key,
      entityId,
      skill,
      card: {
        state: State.Review,
        reps: 3,
        lapses: 0,
        difficulty: 5,
        stability,
        dueAt: new Date(dueAt),
        lastReviewAt: new Date('2026-11-01T00:00:00Z'),
      } as CardRecord['card'],
    },
  ];
}

describe('zoneProgress', () => {
  it('compte acquis, dus et jamais vus par compétence', () => {
    const cards = new Map([
      card('fr', 'locate-country', '2026-12-20T00:00:00Z', 12), // acquis
      card('de', 'locate-country', '2026-11-17T00:00:00Z', 2), // en cours, dû
      card('jp', 'locate-country', '2026-11-17T00:00:00Z', 2), // hors de la zone
    ]);
    const progress = zoneProgress(world, europe, cards, now);
    const locate = progress.categories[0]!.rows[0]!;
    expect(locate.skill).toBe('locate-country');
    expect(locate.total).toBe(europe.entityIds.length);
    expect(locate).toMatchObject({ strong: 1, due: 1, fresh: europe.entityIds.length - 2 });
    expect(progress.due).toBe(1);
    expect(progress.share).toBeGreaterThan(0);
    expect(progress.categories.map((c) => c.category)).toEqual(['countries', 'capitals', 'flags', 'expert']);
  });

  it('met l’expert à part : il ne compte pas dans la part du carnet, et compte les sceaux', () => {
    const cards = new Map([card('fr', 'locate-capital', '2026-12-20T00:00:00Z', 12), card('de', 'locate-capital', '2026-11-17T00:00:00Z', 2)]);
    const progress = zoneProgress(world, europe, cards, now);
    expect(progress.share).toBe(0);
    expect(progress.due).toBe(0); // la révision expert due n'est pas une révision du carnet
    const expert = progress.categories.find((c) => c.category === 'expert')!;
    expect(expert.expert).toBe(true);
    expect(expert.rows[0]).toMatchObject({ skill: 'locate-capital', strong: 1, due: 1 });
    expect(progress.expert.seals).toBe(1);
    expect(progress.expert.sealable).toBeGreaterThan(40);
    expect(progress.expert.share).toBeGreaterThan(0);
  });
});

describe('percent', () => {
  it('arrondit, sans afficher 0 % pour un début de progrès', () => {
    expect(percent(0)).toBe('0 %');
    expect(percent(0.001)).toBe('1 %');
    expect(percent(0.104)).toBe('10 %');
  });
});
