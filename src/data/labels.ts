// Libellés français des continents, sous-régions et statuts (partagés par l'app et les scripts).
import type { ContinentId, EntityStatus, SubregionId } from './types.ts';

export const CONTINENT_LABELS: Record<ContinentId, string> = {
  africa: 'Afrique',
  americas: 'Amérique',
  antarctica: 'Antarctique',
  asia: 'Asie',
  europe: 'Europe',
  oceania: 'Océanie',
};

export const SUBREGION_LABELS: Record<SubregionId, string> = {
  'northern-africa': 'Afrique du Nord',
  'western-africa': "Afrique de l'Ouest",
  'middle-africa': 'Afrique centrale',
  'eastern-africa': "Afrique de l'Est",
  'southern-africa': 'Afrique australe',
  'northern-america': 'Amérique du Nord',
  'central-america': 'Amérique centrale',
  caribbean: 'Caraïbes',
  'south-america': 'Amérique du Sud',
  'central-asia': 'Asie centrale',
  'eastern-asia': "Asie de l'Est",
  'south-eastern-asia': 'Asie du Sud-Est',
  'southern-asia': 'Asie du Sud',
  'western-asia': "Asie de l'Ouest",
  'northern-europe': 'Europe du Nord',
  'western-europe': "Europe de l'Ouest",
  'central-europe': 'Europe centrale',
  'southern-europe': 'Europe du Sud',
  'southeast-europe': 'Europe du Sud-Est',
  'eastern-europe': "Europe de l'Est",
  'australia-new-zealand': 'Australie et Nouvelle-Zélande',
  melanesia: 'Mélanésie',
  micronesia: 'Micronésie',
  polynesia: 'Polynésie',
  antarctica: 'Antarctique',
};

export const STATUS_LABELS: Record<EntityStatus, string> = {
  'un-member': "État membre de l'ONU",
  'un-observer': "État observateur à l'ONU",
  'limited-recognition': 'État à reconnaissance limitée',
  'disputed-territory': 'Territoire au statut disputé',
  dependency: 'Territoire rattaché',
  'overseas-region': "Région d'outre-mer",
  other: 'Autre',
};
