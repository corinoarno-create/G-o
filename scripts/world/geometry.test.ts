import { describe, expect, it } from 'vitest';
import { entityIdForUnit, NEUTRAL, reassignedEntityForDisputedArea, type NeProperties } from './geometry.ts';

// Fabrique une unité Natural Earth minimale pour les tests.
const unit = (props: Partial<NeProperties>): NeProperties => ({
  ADMIN: 'X',
  GEOUNIT: 'X',
  GU_A3: 'XXX',
  TYPE: 'Sovereign country',
  SOVEREIGNT: 'X',
  ISO_A2_EH: '-99',
  LABEL_X: 0,
  LABEL_Y: 0,
  ...props,
});

describe('entityIdForUnit', () => {
  it('utilise le code ISO en minuscules', () => {
    expect(entityIdForUnit(unit({ ISO_A2_EH: 'FR' }))).toBe('fr');
  });

  it('regroupe les nations du Royaume-Uni sous « gb »', () => {
    expect(entityIdForUnit(unit({ ADMIN: 'United Kingdom', GEOUNIT: 'Scotland', ISO_A2_EH: 'GB' }))).toBe('gb');
  });

  it('garde les DROM comme entités à part', () => {
    expect(entityIdForUnit(unit({ ADMIN: 'France', GEOUNIT: 'French Guiana', ISO_A2_EH: 'GF' }))).toBe('gf');
  });

  it('rattache les îles mineures éloignées et Jan Mayen à leur code ISO', () => {
    expect(entityIdForUnit(unit({ ADMIN: 'United States Minor Outlying Islands', ISO_A2_EH: 'US' }))).toBe('um');
    expect(entityIdForUnit(unit({ GEOUNIT: 'Jan Mayen', ISO_A2_EH: 'NO' }))).toBe('sj');
  });

  it('donne un code maison à Chypre du Nord et au Somaliland', () => {
    expect(entityIdForUnit(unit({ ADMIN: 'Northern Cyprus' }))).toBe('cyn');
    expect(entityIdForUnit(unit({ ADMIN: 'Somaliland' }))).toBe('sol');
  });

  it('laisse neutres les zones sans entité et ignore les calques superposés', () => {
    expect(entityIdForUnit(unit({ GU_A3: 'BRT' }))).toBe(NEUTRAL);
    expect(entityIdForUnit(unit({ TYPE: 'Overlay', ISO_A2_EH: 'XD' }))).toBeNull();
  });

  it('refuse une unité inconnue sans code', () => {
    expect(() => entityIdForUnit(unit({ GEOUNIT: 'Atlantide' }))).toThrow(/Atlantide/);
  });
});

describe('reassignedEntityForDisputedArea', () => {
  it('rattache la Crimée à l’Ukraine et la partie marocaine du Sahara occidental au Sahara occidental', () => {
    expect(reassignedEntityForDisputedArea(unit({ BRK_NAME: 'Crimea', SOVEREIGNT: 'Russia' }))).toBe('ua');
    expect(reassignedEntityForDisputedArea(unit({ BRK_NAME: 'W. Sahara', SOVEREIGNT: 'Morocco' }))).toBe('eh');
  });

  it('ne touche pas aux autres zones disputées', () => {
    expect(reassignedEntityForDisputedArea(unit({ BRK_NAME: 'W. Sahara', SOVEREIGNT: 'Western Sahara' }))).toBeNull();
    expect(reassignedEntityForDisputedArea(unit({ BRK_NAME: 'Kuril Is.', SOVEREIGNT: 'Russia' }))).toBeNull();
  });
});
