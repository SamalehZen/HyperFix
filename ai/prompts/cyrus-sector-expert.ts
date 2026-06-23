import type { SectorTaxonomy, CandidateNode } from '@/lib/cyrus/types';

function buildCompactTree(sector: SectorTaxonomy): string {
  const lines: string[] = [];

  const rayons = sector.nodes.filter((n) => n.level === 'rayon');

  lines.push(`[SECTEUR] ${sector.sectorCode} ${sector.sectorName}`);

  for (const rayon of rayons) {
    lines.push(`  [RAYON] ${rayon.code} ${rayon.name}`);

    const familles = sector.nodes.filter(
      (n) => n.level === 'famille' && n.parentId === rayon.id,
    );

    for (const famille of familles) {
      const sousFamilles = sector.nodes.filter(
        (n) => n.level === 'sous-famille' && n.parentId === famille.id,
      );

      lines.push(`    [FAMILLE] ${famille.code} ${famille.name}`);

      for (const sf of sousFamilles) {
        lines.push(`      [SOUS-FAMILLE] ${sf.code} ${sf.name}`);
      }
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

function getExampleCodes(sector: SectorTaxonomy): { rayon: string; famille: string; sousFamille: string } {
  const rayon = sector.nodes.find((n) => n.level === 'rayon');
  const famille = sector.nodes.find((n) => n.level === 'famille');
  const sousFamille = sector.nodes.find((n) => n.level === 'sous-famille');
  return {
    rayon: rayon?.code ?? '000',
    famille: famille?.code ?? '000',
    sousFamille: sousFamille?.code ?? '000',
  };
}

export function buildExpertPrompt(
  sectorTaxonomy: SectorTaxonomy,
  candidateShortlist: CandidateNode[],
  labels: string[],
): string {
  const tree = buildCompactTree(sectorTaxonomy);
  const candidateHint = formatCandidateShortlist(candidateShortlist);
  const labelLines = labels.map((l, i) => `${i + 1}. ${l}`).join('\n');
  const ex = getExampleCodes(sectorTaxonomy);

  return `Tu es un expert en classification d'articles pour le secteur ${sectorTaxonomy.sectorCode} - ${sectorTaxonomy.sectorName} d'un hypermarché.

La hiérarchie a exactement 4 niveaux : SECTEUR → RAYON → FAMILLE → SOUS-FAMILLE.
Chaque niveau est marqué entre crochets [SECTEUR], [RAYON], [FAMILLE], [SOUS-FAMILLE].

${tree}

RÈGLES STRICTES :
- Utilise UNIQUEMENT les codes et noms présents dans la hiérarchie ci-dessus
- N'invente AUCUN code ou nom qui n'existe pas dans le sous-arbre
- Chaque article doit être classé au niveau [SOUS-FAMILLE]
- sectorCode = code du [SECTEUR] (ex: "${sectorTaxonomy.sectorCode}")
- rayonCode = code du [RAYON] (ex: "${ex.rayon}")
- familleCode = code de la [FAMILLE] (ex: "${ex.famille}")
- sousFamilleCode = code de la [SOUS-FAMILLE] (ex: "${ex.sousFamille}")
- sectorName = "${sectorTaxonomy.sectorName}"
- confidence entre 0 et 1 (1 = certain, 0.5 = incertain)
- Retourne UNIQUEMENT du JSON valide, aucune explication narrative
- Renvoie exactement un résultat par article dans le même ordre

${candidateHint ? `\nIndices de pré-filtrage :\n${candidateHint}\n` : ''}
Articles à classifier :
${labelLines}`;
}
