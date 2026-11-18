import { describe, expect, it } from 'vitest';
import { allowedTypos, editDistance, matchAnswer, normalize, suggest, variants } from './text-match.ts';

describe('normalize', () => {
  it('ignore accents, majuscules, tirets et apostrophes', () => {
    expect(normalize('Saint-Pierre-et-Miquelon')).toBe('saint pierre et miquelon');
    expect(normalize('  Côte d’Ivoire ')).toBe('cote d ivoire');
    expect(normalize('ÉTATS-UNIS')).toBe('etats unis');
  });

  it('développe les ligatures et les abréviations courantes', () => {
    expect(normalize('St-Domingue')).toBe('saint domingue');
    expect(normalize('Ste-Lucie')).toBe('sainte lucie');
    expect(normalize('Œuf')).toBe('oeuf');
  });
});

describe('variants', () => {
  it('rend l’article et « Îles » facultatifs', () => {
    expect(variants('Le Caire')).toEqual(['le caire', 'caire']);
    expect(variants('Îles Cook')).toEqual(['iles cook', 'cook']);
  });

  it('ne coupe pas un nom en « de … »', () => {
    expect(variants('Île de Man')).toEqual(['ile de man']);
  });
});

describe('editDistance', () => {
  it('compte insertions, suppressions et substitutions', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('lima', 'lima')).toBe(0);
  });

  it('compte une inversion de deux lettres voisines comme une seule faute', () => {
    expect(editDistance('lima', 'lmia')).toBe(1);
  });
});

describe('allowedTypos', () => {
  it('ne tolère aucune faute sur les noms très courts', () => {
    expect(allowedTypos('iran')).toBe(0);
  });

  it('tolère plus de fautes sur les noms longs', () => {
    expect(allowedTypos('france')).toBe(1);
    expect(allowedTypos('ouagadougou')).toBe(2);
    expect(allowedTypos('saint vincent et les grenadines')).toBe(3);
  });
});

describe('matchAnswer', () => {
  it('accepte les accents et la ponctuation manquants', () => {
    expect(matchAnswer("cote d'ivoire", ["Côte d'Ivoire"]).status).toBe('exact');
    expect(matchAnswer('st domingue', ['Saint-Domingue']).status).toBe('exact');
  });

  it('accepte les variantes et l’article omis', () => {
    expect(matchAnswer('RDC', ['République démocratique du Congo', 'RDC']).status).toBe('exact');
    expect(matchAnswer('Caire', ['Le Caire']).status).toBe('exact');
  });

  it('accepte une petite faute de frappe, en signalant la bonne graphie', () => {
    expect(matchAnswer('Ouagadougo', ['Ouagadougou'])).toEqual({
      status: 'close',
      matched: 'Ouagadougou',
      typos: 1,
      confusedWith: null,
    });
  });

  it('refuse une faute sur un nom très court', () => {
    expect(matchAnswer('Irak', ['Iran']).status).toBe('wrong');
  });

  it('distingue une confusion entre deux pays d’une faute de frappe', () => {
    const others = ['Niger', 'Nigeria', 'Slovaquie', 'Slovénie'];
    expect(matchAnswer('Niger', ['Nigeria'], others)).toMatchObject({ status: 'wrong', confusedWith: 'Niger' });
    expect(matchAnswer('Slovaquie', ['Slovénie'], others)).toMatchObject({ status: 'wrong', confusedWith: 'Slovaquie' });
  });

  it('garde la tolérance quand aucune autre réponse ne ressemble', () => {
    const others = ['Guinée', 'Guinée équatoriale', 'Guinée-Bissau'];
    expect(matchAnswer('guinee', ['Guinée'], others).status).toBe('exact');
    expect(matchAnswer('Guinée Bisau', ['Guinée-Bissau'], others).status).toBe('close');
  });

  it('refuse une saisie vide', () => {
    expect(matchAnswer('  ', ['France']).status).toBe('wrong');
  });
});

describe('suggest', () => {
  const names = ['Maroc', 'Mali', 'Îles Marshall', 'Danemark', 'Guinée-Bissau'];

  it('propose les noms qui commencent par la saisie, même après « Îles »', () => {
    expect(suggest('mar', names)).toEqual(['Îles Marshall', 'Maroc']);
  });

  it('propose aussi les noms dont un mot commence par la saisie', () => {
    expect(suggest('bis', names)).toEqual(['Guinée-Bissau']);
  });

  it('attend au moins deux lettres', () => {
    expect(suggest('m', names)).toEqual([]);
  });
});
