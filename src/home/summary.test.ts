import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { buildWorldData, countries } from '../data/world.ts';
import type { Skill } from '../engine/srs.ts';
import type { CardRecord } from '../storage/schema.ts';
import { buildHomeSummary, formatWhen } from './summary.ts';

const topology = JSON.parse(readFileSync(join(import.meta.dirname, '../../data/world/world.topo.json'), 'utf8'));
const world = buildWorldData(topology, countries);
const now = new Date('2026-11-18T09:00:00Z');

function card(entityId: string, skill: Skill, dueAt: string, stability = 10): [string, CardRecord] {
  const key = `${entityId}:${skill}`;
  return [
    key,
    {
      key,
      entityId,
      skill,
      card: {
        state: State.Review,
        reps: 2,
        lapses: 0,
        difficulty: 5,
        stability,
        dueAt: new Date(dueAt),
        lastReviewAt: new Date('2026-11-01T00:00:00Z'),
      } as CardRecord['card'],
    },
  ];
}

describe('buildHomeSummary', () => {
  it('compte les révisions dues et estime leur durée', () => {
    const cards = new Map([
      card('fr', 'locate-country', '2026-11-17T00:00:00Z'),
      card('de', 'locate-country', '2026-11-16T00:00:00Z'),
      card('it', 'locate-country', '2026-12-20T00:00:00Z'),
    ]);
    // 2 révisions × (4 s + 2,5 s) ≈ 13 s : arrondi à 1 minute au moins.
    const summary = buildHomeSummary(world, cards, new Map(), now);
    expect(summary).toMatchObject({ due: 2, reviewBatch: 2, estimatedMinutes: 1 });
  });

  it('annonce la prochaine révision quand tout est à jour', () => {
    const cards = new Map([card('fr', 'flag', '2026-11-20T08:00:00Z'), card('de', 'flag', '2026-11-25T08:00:00Z')]);
    const summary = buildHomeSummary(world, cards, new Map(), now);
    expect(summary.due).toBe(0);
    expect(summary.nextDueAt).toEqual(new Date('2026-11-20T08:00:00Z'));
  });

  it('résume la progression sur toutes les cartes possibles', () => {
    const cards = new Map([card('fr', 'flag', '2026-12-20T00:00:00Z', 45), card('de', 'flag', '2026-12-20T00:00:00Z', 10)]);
    const { progress } = buildHomeSummary(world, cards, new Map(), now);
    expect(progress.mastered).toBe(1);
    expect(progress.acquired).toBe(1);
    expect(progress.new).toBe(progress.total - 2);
    expect(progress.total).toBeGreaterThan(1000); // ~252 entités × 5 compétences, moins les cas sans capitale ou sans drapeau
  });

  it('colore chaque pays selon sa maîtrise, et résume chaque continent', () => {
    const cards = new Map([card('fr', 'flag', '2026-12-20T00:00:00Z', 45), card('fr', 'locate-country', '2026-12-20T00:00:00Z', 45)]);
    const { entityMastery, continents } = buildHomeSummary(world, cards, new Map(), now);
    // France : 2 compétences maîtrisées sur les 5 du carnet (placer la capitale est dans l'expert) → 2 × 3 / (5 × 3).
    expect(entityMastery.get('fr')).toBeCloseTo(2 / 5);
    expect(entityMastery.get('de')).toBe(0);
    const europe = continents.find((c) => c.id === 'europe')!;
    expect(europe.share).toBeGreaterThan(0);
    expect(continents.find((c) => c.id === 'asia')!.share).toBe(0);
  });

  it('sépare les révisions de l’expert, qui ne comptent pas dans le carnet', () => {
    const cards = new Map([
      card('fr', 'locate-country', '2026-11-17T00:00:00Z'),
      card('de', 'locate-capital', '2026-11-16T00:00:00Z', 2), // en cours
      card('it', 'locate-capital', '2026-11-25T00:00:00Z', 45),
      card('mc', 'locate-capital', '2026-11-25T00:00:00Z', 45),
    ]);
    const summary = buildHomeSummary(world, cards, new Map(), now);
    expect(summary.due).toBe(1);
    expect(summary.dueByExercise.map((d) => d.exercise)).toEqual(['locate-country']);
    expect(summary.expert).toMatchObject({ due: 1, reviewBatch: 1 });
    expect(summary.expert.dueByExercise.map((d) => d.exercise)).toEqual(['locate-capital']);
    // Une capitale maîtrisée ne colore pas le carnet. Monaco, sans autre ville, a son sceau ;
    // l'Italie, dont les villes ne sont pas encore acquises, pas encore.
    expect(summary.entityMastery.get('it')).toBe(0);
    expect([...summary.seals]).toEqual(['mc']);
  });

  it('regroupe les révisions dues par exercice', () => {
    const cards = new Map([
      card('fr', 'locate-country', '2026-11-17T00:00:00Z'),
      card('de', 'locate-country', '2026-11-16T00:00:00Z'),
      card('it', 'name-capital', '2026-11-16T00:00:00Z'),
    ]);
    const { dueByExercise } = buildHomeSummary(world, cards, new Map(), now);
    expect(dueByExercise).toEqual([
      { exercise: 'locate-country', label: 'Placer les pays', count: 2 },
      { exercise: 'name-capital', label: 'Donner les capitales', count: 1 },
    ]);
  });
});

describe('formatWhen', () => {
  const base = new Date(2026, 10, 18, 9);
  it('dit quand aura lieu la prochaine révision', () => {
    expect(formatWhen(new Date(2026, 10, 18, 20), base)).toBe('plus tard aujourd’hui');
    expect(formatWhen(new Date(2026, 10, 19, 8), base)).toBe('demain');
    expect(formatWhen(new Date(2026, 10, 22, 8), base)).toBe('dans 4 jours');
  });
});
