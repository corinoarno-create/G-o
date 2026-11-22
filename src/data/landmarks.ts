// Repères de la carte pour placer capitales et villes : fleuves, grands lacs, limites intérieures.
// Générés par scripts/build-landmarks.ts ; le fichier (~860 Ko) n'est chargé qu'au premier exercice de placement.
import { feature, mesh } from 'topojson-client';
import type { MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import landmarksUrl from '../../data/world/landmarks.topo.json?url';

export interface Landmarks {
  /** Grands fleuves (rang Natural Earth ≤ 4) : visibles dès la vue d'ensemble. */
  riversMajor: MultiLineString;
  /** Autres fleuves, jusqu'au niveau du Rhône et du Pô : visibles une fois zoomé. */
  riversMinor: MultiLineString;
  lakes: Array<Polygon | MultiPolygon>;
  /** Limites intérieures (régions, États, provinces) : visibles une fois zoomé. */
  admin1: MultiLineString;
}

type LandmarksTopology = Topology<{
  riversMajor: GeometryCollection;
  riversMinor: GeometryCollection;
  lakes: GeometryCollection;
  admin1: GeometryCollection;
}>;

/** Construit les repères à partir de la topologie (séparé du chargement pour les tests). */
export function buildLandmarks(topology: LandmarksTopology): Landmarks {
  const lines = (name: 'riversMajor' | 'riversMinor' | 'admin1') => mesh(topology, topology.objects[name]);
  const lakes = feature(topology, topology.objects.lakes).features.map((f) => f.geometry as Polygon | MultiPolygon);
  return { riversMajor: lines('riversMajor'), riversMinor: lines('riversMinor'), lakes, admin1: lines('admin1') };
}

let pending: Promise<Landmarks> | null = null;

/** Charge les repères (une seule fois). En cas d'échec, on pourra réessayer plus tard. */
export function loadLandmarks(): Promise<Landmarks> {
  pending ??= fetch(landmarksUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Repères introuvables (${response.status})`);
      return response.json();
    })
    .then((topology: LandmarksTopology) => buildLandmarks(topology))
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}
