import { describe, expect, it } from 'vitest';
import { CATEGORIES, defaultFavoriteName, DEFAULT_CHOICE, modeOf, sanitizeChoice } from './options.ts';

describe('catégories et modes', () => {
  it('associent chaque mode à un exercice', () => {
    const exercises = CATEGORIES.flatMap((category) => category.modes.map((mode) => mode.exercise));
    expect(new Set(exercises).size).toBe(6);
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
