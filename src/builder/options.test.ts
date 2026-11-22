import { describe, expect, it } from 'vitest';
import { CATEGORIES, defaultFavoriteName, DEFAULT_CHOICE, migrateStoredChoice, modeOf, sanitizeChoice } from './options.ts';

describe('catégories et modes', () => {
  it('associent chaque mode à un exercice', () => {
    const exercises = CATEGORIES.flatMap((category) => category.modes.map((mode) => mode.exercise));
    expect(new Set(exercises).size).toBe(7); // tous les exercices, chacun une fois
  });

  it('retombent sur le premier mode de la catégorie si le mode n’y existe pas', () => {
    expect(modeOf({ category: 'flags', mode: 'pin' }).exercise).toBe('flag-to-country');
    expect(modeOf({ category: 'capitals', mode: 'type' }).exercise).toBe('name-capital');
  });
});

describe('defaultFavoriteName', () => {
  it('résume les réglages', () => {
    expect(defaultFavoriteName({ zoneId: 'asia', category: 'capitals', mode: 'type', count: 20, content: 'mix' }, 'Asie')).toBe(
      'Capitales · Asie · Saisir · 20',
    );
    expect(defaultFavoriteName({ zoneId: 'world', category: 'flags', mode: 'country-to-flag', count: 'all', content: 'weak' }, 'Monde')).toBe(
      'Drapeaux · Monde · Pays → drapeau · Points faibles · tout',
    );
  });
});

describe('sanitizeChoice', () => {
  it('complète un choix vide avec les valeurs par défaut', () => {
    expect(sanitizeChoice(null)).toEqual(DEFAULT_CHOICE);
    expect(sanitizeChoice('n’importe quoi')).toEqual(DEFAULT_CHOICE);
  });

  it('corrige les valeurs inconnues et garde les bonnes', () => {
    expect(sanitizeChoice({ zoneId: 'europe', category: 'flags', mode: 'pin', count: 7, content: 'due' })).toEqual({
      zoneId: 'europe',
      category: 'flags',
      mode: 'flag-to-country',
      count: 10,
      content: 'due',
    });
  });
});

describe('migrateStoredChoice', () => {
  it('range l’ancien « Capitales → Placer » dans l’Expert', () => {
    const old = { zoneId: 'europe', category: 'capitals', mode: 'pin', count: 20, content: 'mix' };
    expect(sanitizeChoice(migrateStoredChoice(old))).toMatchObject({ category: 'expert', mode: 'capital-pin', count: 20 });
    expect(modeOf(sanitizeChoice(migrateStoredChoice(old))).exercise).toBe('locate-capital');
  });

  it('ne touche pas aux autres choix', () => {
    const choice = { zoneId: 'world', category: 'capitals', mode: 'type', count: 10, content: 'mix' };
    expect(migrateStoredChoice(choice)).toBe(choice);
  });
});
