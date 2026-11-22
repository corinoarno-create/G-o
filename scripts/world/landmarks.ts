// Choix des limites intérieures à dessiner (Natural Earth admin 1, lignes).
import type { Feature, Geometry } from 'geojson';

export interface Admin1LineProperties {
  FEATURECLA: string;
  ADM0_A3: string;
  MIN_ZOOM: number;
}

/**
 * Pays dont le premier niveau Natural Earth est un émiettement de communes ou de comtés (des centaines de
 * lignes) : il brouillerait la carte au lieu d'aider à se repérer.
 */
export const NOISY_ADMIN1 = new Set([
  'GBR', // 474 lignes de comtés et de districts, pas les quatre nations
  'SVN', // communes
  'MDA', // districts
  'LVA', // municipalités
  'MKD', // municipalités
  'MLT',
  'DOM',
]);

/** En dessous de cette superficie, un pays est trop petit pour que ses limites intérieures aident. */
export const MIN_ADMIN1_AREA_KM2 = 20_000;

/**
 * Pour chaque pays, on ne garde que son niveau le plus grossier (le plus petit MIN_ZOOM de Natural Earth) :
 * les régions pour la France, l'Italie ou l'Espagne (et non les départements ou les provinces), les États pour
 * les États-Unis. Les lignes « meta » et « indicator » ne sont pas de vraies limites. Les petits pays
 * (superficie connue par code ISO alpha-3) et les pays trop émiettés sont laissés de côté.
 */
export function selectAdmin1Lines<T extends Feature<Geometry, Admin1LineProperties>>(features: T[], areaByIso3: Map<string, number> = new Map()): T[] {
  const real = features.filter((f) => {
    const country = f.properties.ADM0_A3;
    const area = areaByIso3.get(country);
    return !/meta|indicator/i.test(f.properties.FEATURECLA) && !NOISY_ADMIN1.has(country) && (area === undefined || area >= MIN_ADMIN1_AREA_KM2);
  });
  const coarsest = new Map<string, number>();
  for (const f of real) {
    const country = f.properties.ADM0_A3;
    coarsest.set(country, Math.min(coarsest.get(country) ?? Infinity, f.properties.MIN_ZOOM));
  }
  return real.filter((f) => f.properties.MIN_ZOOM === coarsest.get(f.properties.ADM0_A3));
}
