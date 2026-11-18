import { describe, expect, it } from 'vitest';
import { assetUrl } from './assets';

describe('assetUrl', () => {
  it('garde le chemin tel quel quand l’app est servie à la racine', () => {
    expect(assetUrl('data/countries.json', '/')).toBe('/data/countries.json');
  });

  it('préfixe par le nom du dépôt sur GitHub Pages', () => {
    expect(assetUrl('data/countries.json', '/geo/')).toBe('/geo/data/countries.json');
  });

  it('ne double pas les barres obliques', () => {
    expect(assetUrl('/data/countries.json', '/geo')).toBe('/geo/data/countries.json');
  });
});
