import { describe, expect, it } from 'vitest';
import type { GeoCity } from './geonames.ts';
import { cityQuota } from './quotas.ts';
import { selectCities } from './select.ts';

const city = (geonameId: string, country: string, name: string, population: number, alternateNames: string[] = []): GeoCity => ({
  geonameId,
  name,
  asciiName: name.normalize('NFD').replace(/\p{M}/gu, ''),
  alternateNames,
  lat: 0,
  lon: 0,
  featureCode: 'PPL',
  country,
  population,
});

const geo = [
  city('1', 'it', 'Torino', 870_000, ['Turin', 'Torino']),
  city('2', 'it', 'Firenze', 360_000, ['Florence']),
  city('3', 'ca', 'Victoria', 290_000),
  city('4', 'ca', 'Victoriaville', 40_000),
  city('5', 'au', 'Victoria Point', 5_000),
  city('6', 'ca', 'Victoria', 1_000),
  city('7', 'in', 'Mumbai', 12_000_000, ['Bombay']),
];

describe('choix des villes', () => {
  it('retrouve une ville par son nom français, parmi les autres graphies', () => {
    const { cities, errors } = selectCities({ it: ['Turin', 'Florence'] }, geo);
    expect(errors).toEqual([]);
    expect(cities.map((c) => [c.id, c.name])).toEqual([
      ['c1', 'Turin'],
      ['c2', 'Florence'],
    ]);
    // Le nom usuel de GeoNames est accepté en saisie.
    expect(cities[0]!.aliases).toEqual(['Torino']);
  });

  it('prend la plus peuplée quand plusieurs lieux portent ce nom dans le pays', () => {
    expect(selectCities({ ca: ['Victoria'] }, geo).cities[0]!.id).toBe('c3');
  });

  it('cherche un autre nom si on le précise, et ajoute les réponses données à la main', () => {
    const { cities } = selectCities({ in: [{ nom: 'Bombay', cherche: 'Mumbai', aussi: ['Mumbai'] }] }, geo);
    expect(cities[0]).toMatchObject({ id: 'c7', name: 'Bombay', aliases: ['Mumbai'] });
  });

  it('signale une ville introuvable ou en double', () => {
    const { errors } = selectCities({ it: ['Turin', 'Torino', 'Venise'] }, geo);
    expect(errors).toEqual(['it : « Torino » est en double', 'it : « Venise » introuvable dans GeoNames']);
  });

  it('donne un quota selon la taille du pays', () => {
    expect(cityQuota({ id: 'fr', population: 68e6, areaKm2: 550_000 })).toBe(10);
    expect(cityQuota({ id: 'be', population: 11.8e6, areaKm2: 30_000 })).toBe(5);
    expect(cityQuota({ id: 'ch', population: 9e6, areaKm2: 41_000 })).toBe(3);
    expect(cityQuota({ id: 'lu', population: 670_000, areaKm2: 2_600 })).toBe(1);
    expect(cityQuota({ id: 'va', population: 800, areaKm2: 0.5 })).toBe(0);
  });
});
