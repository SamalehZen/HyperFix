import type { SectorTaxonomy, CandidateNode, TaxonomyNode } from '@/lib/cyrus/types';

function buildCompactTree(sector: SectorTaxonomy): string {
  const lines: string[] = [];
  const nodeById = new Map<string, TaxonomyNode>();

  for (const node of sector.nodes) {
    nodeById.set(node.id, node);
  }

  const rayons = sector.nodes.filter((n) => n.level === 'rayon');

  lines.push(`SECTEUR ${sector.sectorCode} - ${sector.sectorName}`);

  for (const rayon of rayons) {
    lines.push(`  ${rayon.code} ${rayon.name}`);

    const familles = sector.nodes.filter(
      (n) => n.level === 'famille' && n.parentId === rayon.id,
    );

    for (const famille of familles) {
      const sousFamilles = sector.nodes.filter(
        (n) => n.level === 'sous-famille' && n.parentId === famille.id,
      );

      const sfList = sousFamilles
        .map((sf) => `${sf.code} ${sf.name}`)
        .join(', ');

      lines.push(`    ${famille.code} ${famille.name}: ${sfList}`);
    }
  }

  return lines.join('\n');
}

function formatCandidateShortlist(candidates: CandidateNode[]): string {
  if (candidates.length === 0) return '';

  const lines = candidates
    .slice(0, 5)
    .map((c) => `  - ${c.path.join(' > ')} (score: ${c.score.toFixed(2)})`);

  return `Candidats probables :\n${lines.join('\n')}`;
}

export function buildExpertPrompt(
  sectorTaxonomy: SectorTaxonomy,
  candidateShortlist: CandidateNode[],
  labels: string[],
): string {
  const tree = buildCompactTree(sectorTaxonomy);
  const candidateHint = formatCandidateShortlist(candidateShortlist);
  const labelLines = labels.map((l, i) => `${i + 1}. ${l}`).join('\n');

  return `Tu es un expert en classification d'articles pour le secteur ${sectorTaxonomy.sectorCode} - ${sectorTaxonomy.sectorName} d'un hypermarché.

Pour chaque article, trouve le chemin exact dans la hiérarchie ci-dessous : secteur → rayon → famille → sous-famille.

${tree}

RÈGLES STRICTES :
- Utilise UNIQUEMENT les codes et noms présents dans la hiérarchie ci-dessus
- N'invente AUCUN code ou nom qui n'existe pas dans le sous-arbre
- Chaque article doit être classé au niveau sous-famille
- sectorCode = "${sectorTaxonomy.sectorCode}", sectorName = "${sectorTaxonomy.sectorName}"
- confidence entre 0 et 1 (1 = certain, 0.5 = incertain)
- Retourne UNIQUEMENT du JSON valide, aucune explication narrative
- Renvoie exactement un résultat par article dans le même ordre

${candidateHint ? `\nIndices de pré-filtrage :\n${candidateHint}\n` : ''}
Articles à classifier :
${labelLines}`;
}
