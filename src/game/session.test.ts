import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { State } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { buildWorldData, countries } from '../data/world.ts';
import type { CardRecord } from '../storage/schema.ts';
import { capitalAnswers, EXERCISES, hasOwnFlag, hintFor, rivalAnswers } from './exercises.ts';
import { buildFlagChoices, evaluateAnswer, pickItems, shuffle, summarize, type SessionLogEntry } from './session.ts';

const topology = JSON.parse(readFileSync(join(import.meta.dirname, '../../data/world/world.topo.json'), 'utf8'));
const world = buildWorldData(topology, countries);
const entity = (id: string) => world.byId.get(id)!;
/** Générateur pseudo-aléatoire reproductible. */
const seeded = (seed = 42) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const first = () => 0; // « Bravo ! » à coup sûr

describe('exercices', () => {
  it('ne demandent un drapeau que s’il est propre à l’entité', () => {
    expect(hasOwnFlag(entity('fr'))).toBe(true);
    expect(hasOwnFlag(entity('gp'))).toBe(false); // drapeau français
    expect(hasOwnFlag(entity('aq'))).toBe(false); // drapeau non officiel
  });

  it('ne demandent une capitale que s’il y en a une', () => {
    expect(EXERCISES['name-capital'].eligible(entity('fr'))).toBe(true);
    expect(EXERCISES['name-capital'].eligible(entity('aq'))).toBe(false);
  });

  it('acceptent toutes les capitales officielles', () => {
    expect(capitalAnswers(entity('bo'))).toEqual(['Sucre', 'La Paz']);
  });

  it('listent les autres réponses possibles, sans celles de l’entité', () => {
    const rivals = rivalAnswers(world, 'countries', 'ng');
    expect(rivals).toContain('Niger');
    expect(rivals).not.toContain('Nigeria');
  });

  it('donnent des indices qui aident sans donner la réponse', () => {
    expect(hintFor('name-country', entity('pe')).text).toBe('Commence par « P » (5 lettres).');
    expect(hintFor('locate-country', entity('pe')).text).toBe('Région : Amérique du Sud.');
    const hint = hintFor('country-to-flag', entity('fr'), ['de', 'fr', 'it', 'be']);
    expect(hint.eliminate).toHaveLength(2);
    expect(hint.eliminate).not.toContain('fr');
  });
});

describe('pickItems', () => {
  const now = new Date('2026-11-18T09:00:00Z');
  const card = (id: string, dueAt: string, reps = 1): [string, CardRecord] => [
    `${id}:flag`,
    {
      key: `${id}:flag`,
      entityId: id,
      skill: 'flag',
      card: { state: State.Review, reps, dueAt: new Date(dueAt), stability: 5 } as CardRecord['card'],
    },
  ];
  const cards = new Map([
    card('a', '2026-11-10T00:00:00Z'), // due depuis 8 jours
    card('b', '2026-11-17T00:00:00Z'), // due depuis 1 jour
    card('c', '2026-12-30T00:00:00Z'), // pas due
  ]);

  it('prend d’abord les révisions dues, puis les nouveautés, puis le reste', () => {
    const picked = pickItems(['a', 'b', 'c', 'd', 'e'], 'flag', cards, 3, now, seeded());
    expect(new Set(picked)).toEqual(new Set(['a', 'b', picked.find((id) => id === 'd' || id === 'e')!]));
    expect(picked).not.toContain('c');
  });

  it('prend tout si on le demande', () => {
    expect(pickItems(['a', 'b', 'c', 'd'], 'flag', cards, 'all', now, seeded()).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('buildFlagChoices', () => {
  it('propose quatre drapeaux dont le bon, de préférence voisins', () => {
    const pool = world.countries.filter(hasOwnFlag);
    const choices = buildFlagChoices(entity('fr'), pool, seeded());
    expect(choices).toHaveLength(4);
    expect(choices).toContain('fr');
    expect(new Set(choices).size).toBe(4);
    for (const id of choices) expect(entity(id).subregion).toBe('western-europe');
  });
});

describe('evaluateAnswer', () => {
  it('Placer les pays : juste si on clique le bon pays', () => {
    expect(evaluateAnswer('locate-country', entity('fr'), { kind: 'pin', entityId: 'fr', lonLat: [2, 47] }, world, first)).toMatchObject({
      correct: true,
      message: 'Bravo !',
    });
    const wrong = evaluateAnswer('locate-country', entity('fr'), { kind: 'pin', entityId: 'be', lonLat: [4.5, 50.5] }, world);
    expect(wrong).toMatchObject({ correct: false, chosenEntityId: 'be' });
    expect(wrong.message).toContain('Belgique');
  });

  it('Placer les capitales : juste dans la tolérance, avec la distance', () => {
    const paris = entity('fr').capital!;
    const near = evaluateAnswer('locate-capital', entity('fr'), { kind: 'pin', entityId: 'fr', lonLat: [paris.lon + 0.3, paris.lat] }, world, first);
    expect(near.correct).toBe(true);
    expect(near.message).toMatch(/^Bravo ! À \d+ km près\.$/);
    const far = evaluateAnswer('locate-capital', entity('fr'), { kind: 'pin', entityId: 'fr', lonLat: [4.84, 45.76] }, world);
    expect(far).toMatchObject({ correct: false, closeness: 'far' });
    expect(far.distanceKm).toBeGreaterThan(380);
  });

  it('Saisir : tolère les petites fautes et signale les confusions', () => {
    expect(evaluateAnswer('name-capital', entity('bf'), { kind: 'type', text: 'ouagadougo' }, world, first)).toMatchObject({
      correct: true,
      message: 'Bravo ! On écrit « Ouagadougou ».',
      answerLength: 11,
    });
    expect(evaluateAnswer('name-capital', entity('bo'), { kind: 'type', text: 'la paz' }, world).correct).toBe(true);
    const confused = evaluateAnswer('name-country', entity('ng'), { kind: 'type', text: 'Niger' }, world);
    expect(confused.correct).toBe(false);
    expect(confused.message).toBe('« Niger », c\'est un autre pays : la réponse était « Nigeria ».');
  });

  it('Drapeaux : choix ou clic sur la carte', () => {
    expect(evaluateAnswer('country-to-flag', entity('fr'), { kind: 'choice', entityId: 'fr' }, world).correct).toBe(true);
    expect(evaluateAnswer('country-to-flag', entity('fr'), { kind: 'choice', entityId: 'it' }, world).message).toContain('Italie');
    expect(evaluateAnswer('flag-to-country', entity('jp'), { kind: 'pin', entityId: 'jp', lonLat: [139, 36] }, world).correct).toBe(true);
  });

  it('« Je ne sais pas » montre simplement la réponse', () => {
    expect(evaluateAnswer('name-country', entity('pe'), { kind: 'type', text: '' }, world).message).toBe('La réponse était « Pérou ».');
    expect(evaluateAnswer('locate-capital', entity('pe'), { kind: 'pin', entityId: null, lonLat: null }, world).message).toBe('Voici Lima.');
  });
});

describe('summarize', () => {
  it('compte les réussites du premier coup, les erreurs et les nouveaux acquis', () => {
    const log: SessionLogEntry[] = [
      { entityId: 'fr', correct: true, firstAttempt: true, responseMs: 2000, distanceKm: 10, masteryBefore: 'learning', masteryAfter: 'acquired' },
      { entityId: 'pe', correct: false, firstAttempt: true, responseMs: 4000, distanceKm: 300, masteryBefore: 'new', masteryAfter: 'learning' },
      { entityId: 'pe', correct: true, firstAttempt: false, responseMs: 1500, distanceKm: 5 },
    ];
    expect(summarize('locate-capital', log, 60_000)).toEqual({
      total: 2,
      firstTryCorrect: 1,
      accuracy: 0.5,
      durationMs: 60_000,
      averageDistanceKm: 155,
      missed: ['pe'],
      promoted: [{ entityId: 'fr', level: 'acquired' }],
    });
  });
});

describe('shuffle', () => {
  it('garde tous les éléments sans modifier l’original', () => {
    const items = [1, 2, 3, 4, 5];
    const mixed = shuffle(items, seeded());
    expect(mixed.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });
});
