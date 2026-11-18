// Rapport de relecture en Markdown : la liste complète des entités et les points à vérifier.
import type { CountryEntity, ContinentId, EntityStatus, SubregionId } from '../../src/data/types.ts';

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

const formatPopulation = (entity: CountryEntity) =>
  entity.population === null
    ? '—'
    : `${entity.population.toLocaleString('fr-FR')} (${entity.populationYear ?? '?'}, ${entity.populationSource})`;

const formatCapital = (entity: CountryEntity) => {
  if (!entity.capital) return '—';
  const others = entity.otherCapitals.map((c) => c.name);
  return others.length ? `${entity.capital.name} (+ ${others.join(', ')})` : entity.capital.name;
};

const cell = (text: string) => text.replace(/\|/g, '\\|');

export function buildReport(entities: CountryEntity[], warnings: string[], decisions: string[]): string {
  const byStatus = new Map<EntityStatus, number>();
  for (const entity of entities) byStatus.set(entity.status, (byStatus.get(entity.status) ?? 0) + 1);

  const lines: string[] = [
    '# Rapport des données Monde',
    '',
    '> Généré par `npm run data:world`. Ne pas modifier à la main : corriger `data/sources/overrides-monde.json` puis relancer.',
    '',
    `**${entities.length} entités** : ` +
      [...byStatus].map(([status, count]) => `${count} × ${STATUS_LABELS[status].toLowerCase()}`).join(', ') +
      '.',
    '',
    '## Choix à valider',
    '',
    ...decisions.map((d) => `- ${d}`),
    '',
    '## Points à vérifier',
    '',
    ...(warnings.length ? warnings.map((w) => `- ${w}`) : ['- Aucun.']),
    '',
  ];

  for (const continent of Object.keys(CONTINENT_LABELS) as ContinentId[]) {
    const group = entities.filter((e) => e.continent === continent);
    if (group.length === 0) continue;
    lines.push(`## ${CONTINENT_LABELS[continent]} (${group.length})`, '');
    lines.push('| Id | Nom | Autres noms | Capitale | Sous-région | Statut | Population | Drapeau |');
    lines.push('|---|---|---|---|---|---|---|---|');
    const sorted = [...group].sort(
      (a, b) =>
        SUBREGION_LABELS[a.subregion].localeCompare(SUBREGION_LABELS[b.subregion], 'fr') ||
        a.name.localeCompare(b.name, 'fr'),
    );
    for (const e of sorted) {
      const status = STATUS_LABELS[e.status] + (e.sovereign ? ` (${e.sovereign})` : '');
      const flag = !e.flag ? '❌' : e.flagSameAs ? `= ${e.flagSameAs}` : '✓';
      lines.push(
        `| ${e.id} | ${cell(e.name)} | ${cell(e.aliases.join(', '))} | ${cell(formatCapital(e))} | ` +
          `${SUBREGION_LABELS[e.subregion]} | ${status} | ${formatPopulation(e)} | ${flag} |`,
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}
