// Rapport de relecture en Markdown : la liste complète des entités et les points à vérifier.
import type { CountryEntity, ContinentId, EntityStatus } from '../../src/data/types.ts';
import { CONTINENT_LABELS, STATUS_LABELS, SUBREGION_LABELS } from '../../src/data/labels.ts';

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
