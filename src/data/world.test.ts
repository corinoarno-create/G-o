// Tests d'intégrité des données du Monde générées (data/world/, data/flags/).
// Ils protègent contre une régression lors d'une régénération (npm run data:world).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { geoContains } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { describe, expect, it } from 'vitest';
import { distanceToShapeKm } from '../engine/geo.ts';
import { normalize as normalizeName } from '../engine/text-match.ts';
import type { CountryEntity } from './types.ts';

const root = join(import.meta.dirname, '..', '..');
const countries = JSON.parse(readFileSync(join(root, 'data/world/countries.json'), 'utf8')) as CountryEntity[];
const topology = JSON.parse(readFileSync(join(root, 'data/world/world.topo.json'), 'utf8')) as Topology<{
  entities: GeometryCollection<{ eid: string }>;
}>;
const shapes = feature(topology, topology.objects.entities) as FeatureCollection<Geometry, { eid: string }>;
const byId = new Map(countries.map((c) => [c.id, c]));
const shapeOf = (id: string) => shapes.features.find((f) => f.properties.eid === id)!;
/** Identifiant de l'entité dont la géométrie contient le point. */
const entityAt = (lon: number, lat: number) =>
  shapes.features.filter((f) => geoContains(f, [lon, lat])).map((f) => f.properties.eid);

describe('liste des entités', () => {
  it('contient les ~250 pays et territoires, une seule fois chacun', () => {
    expect(countries.length).toBe(252);
    expect(new Set(countries.map((c) => c.id)).size).toBe(countries.length);
    expect(countries.filter((c) => c.status === 'un-member')).toHaveLength(193);
  });

  it('a une géométrie pour chaque entité, et seulement pour elles', () => {
    expect(new Set(shapes.features.map((f) => f.properties.eid))).toEqual(new Set(countries.map((c) => c.id)));
  });

  it('n’a aucun nom ambigu', () => {
    const labels = countries.flatMap((c) => [c.name, ...c.aliases].map((label) => `${normalizeName(label)}|${c.id}`));
    const owners = new Map<string, Set<string>>();
    for (const entry of labels) {
      const [label, id] = entry.split('|') as [string, string];
      owners.set(label, (owners.get(label) ?? new Set()).add(id));
    }
    expect([...owners].filter(([, ids]) => ids.size > 1)).toEqual([]);
  });
});

describe('cas particuliers du cahier des charges', () => {
  it('fait de Taïwan une entité à part entière', () => {
    expect(byId.get('tw')).toMatchObject({ name: 'Taïwan', status: 'limited-recognition', sovereign: null });
    expect(entityAt(121.5, 25.03)).toEqual(['tw']); // Taipei
  });

  it('garde les DROM à part, rattachés à la France', () => {
    for (const id of ['gp', 'mq', 'gf', 're', 'yt']) {
      expect(byId.get(id)).toMatchObject({ status: 'overseas-region', sovereign: 'fr' });
    }
  });

  it('inclut les territoires contestés ou à reconnaissance limitée', () => {
    for (const id of ['xk', 'ps', 'eh', 'cyn', 'sol']) expect(byId.has(id)).toBe(true);
  });

  it('suit les frontières reconnues par l’ONU pour la Crimée et le Sahara occidental', () => {
    expect(entityAt(34.1, 44.95)).toEqual(['ua']); // Simferopol
    expect(entityAt(-13.2, 27.15)).toEqual(['eh']); // Laâyoune
    expect(entityAt(-6.84, 34.02)).toEqual(['ma']); // Rabat
  });
});

describe('capitales', () => {
  it('se trouvent dans leur entité (à 25 km près, pour les côtes et les îles)', () => {
    const far = countries.flatMap((c) =>
      [c.capital, ...c.otherCapitals]
        .filter((capital) => capital !== null)
        .filter((capital) => distanceToShapeKm(shapeOf(c.id), capital.lon, capital.lat) > 25)
        .map((capital) => `${c.id} ${capital.name}`),
    );
    expect(far).toEqual([]);
  });

  it('sont présentes pour tous les États membres de l’ONU', () => {
    expect(countries.filter((c) => c.status === 'un-member' && !c.capital).map((c) => c.id)).toEqual([]);
  });
});

describe('drapeaux', () => {
  it('existent pour chaque entité', () => {
    const missing = countries.filter((c) => !c.flag || !existsSync(join(root, 'data/flags', c.flag)));
    expect(missing.map((c) => c.id)).toEqual([]);
  });

  it('signalent les drapeaux repris de l’État de rattachement', () => {
    expect(byId.get('gp')?.flagSameAs).toBe('fr');
    expect(byId.get('fr')?.flagSameAs).toBeNull();
    expect(byId.get('nc')?.flagSameAs).toBeNull();
  });
});
