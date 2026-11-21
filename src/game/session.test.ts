import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWorldData, countries } from '../data/world.ts';
import { capitalAnswers, EXERCISES, hasOwnFlag, hintFor, rivalAnswers } from './exercises.ts';
import { buildFlagChoices, evaluateAnswer, summarize, type SessionLogEntry } from './session.ts';

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

  it('donnent des indices progressifs qui aident sans donner la réponse', () => {
    expect(hintFor('name-country', entity('pe'), 1).text).toBe('Commence par « P… » (5 lettres).');
    expect(hintFor('name-capital', entity('bf'), 2).text).toBe('Commence par « Ou… » (11 lettres).');
    const hint = hintFor('country-to-flag', entity('fr'), 1, { choices: ['de', 'fr', 'it', 'be'], eliminated: ['de'] });
    expect(hint.eliminate).toEqual(['it']);
  });

  it('cadrent la carte sur la sous-région, puis sur l’élément et ses voisins', () => {
    const wide = hintFor('locate-country', entity('lc'), 1, { world });
    expect(wide.text).toContain('Caraïbes');
    expect(wide.focus).toContain('lc');
    expect(wide.focus!.every((id) => entity(id).subregion === 'caribbean')).toBe(true);
    const narrow = hintFor('locate-country', entity('lc'), 2, { world });
    expect(narrow.focus).toHaveLength(5);
    expect(narrow.focus).toContain('lc');
    expect(narrow.focus).toContain('vc'); // Saint-Vincent, voisine de Sainte-Lucie
    // Pour une capitale, le 2e indice montre son pays.
    expect(hintFor('locate-capital', entity('pe'), 2, { world })).toMatchObject({ focus: ['pe'], outline: 'pe' });
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
    expect(wrong).toMatchObject({ correct: false, chosenEntityId: 'be', answerLabel: 'France' });
    expect(wrong.message).toBe('Presque ! Tu as touché : Belgique (juste à côté).');
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
    expect(confused.message).toBe("« Niger » : c'est un autre pays.");
    expect(confused.answerLabel).toBe('Nigeria');
  });

  it('Drapeaux : choix ou clic sur la carte', () => {
    expect(evaluateAnswer('country-to-flag', entity('fr'), { kind: 'choice', entityId: 'fr' }, world).correct).toBe(true);
    expect(evaluateAnswer('country-to-flag', entity('fr'), { kind: 'choice', entityId: 'it' }, world).message).toBe(
      'Ce drapeau-là : Italie.',
    );
    expect(evaluateAnswer('flag-to-country', entity('jp'), { kind: 'pin', entityId: 'jp', lonLat: [139, 36] }, world).correct).toBe(true);
  });

  it('« Je ne sais pas » montre simplement la réponse', () => {
    expect(evaluateAnswer('name-country', entity('pe'), { kind: 'type', text: '' }, world)).toMatchObject({
      message: 'Voici la bonne réponse.',
      answerLabel: 'Pérou',
    });
    expect(evaluateAnswer('locate-capital', entity('pe'), { kind: 'pin', entityId: null, lonLat: null }, world).answerLabel).toBe(
      'Lima (Pérou)',
    );
  });
});

describe('summarize', () => {
  it('compte les réussites du premier coup, les erreurs et les nouveaux acquis', () => {
    const log: SessionLogEntry[] = [
      { exercise: 'locate-capital', entityId: 'fr', correct: true, firstAttempt: true, responseMs: 2000, distanceKm: 10, masteryBefore: 'learning', masteryAfter: 'acquired' },
      { exercise: 'locate-capital', entityId: 'pe', correct: false, firstAttempt: true, responseMs: 4000, distanceKm: 300, masteryBefore: 'new', masteryAfter: 'learning' },
      { exercise: 'locate-capital', entityId: 'pe', correct: true, firstAttempt: false, responseMs: 1500, distanceKm: 5 },
      { exercise: 'flag-to-country', entityId: 'jp', correct: true, firstAttempt: true, responseMs: 900, distanceKm: 4000 },
    ];
    expect(summarize(log, 60_000)).toEqual({
      total: 3,
      firstTryCorrect: 2,
      accuracy: 2 / 3,
      durationMs: 60_000,
      averageDistanceKm: 155, // seules les capitales placées comptent
      missed: [{ exercise: 'locate-capital', entityId: 'pe' }],
      promoted: [{ exercise: 'locate-capital', entityId: 'fr', level: 'acquired' }],
      firstAnswers: expect.any(Array),
    });
  });
});
