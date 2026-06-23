export function buildRouterPrompt(
  sectorSummaries: Array<{
    code: string;
    name: string;
    rayonCount: number;
    description: string;
  }>,
  labels: string[],
): string {
  const sectorLines = sectorSummaries
    .map(
      (s) =>
        `- ${s.code} ${s.name} (${s.rayonCount} rayons) : ${s.description}`,
    )
    .join('\n');

  const labelLines = labels.map((l, i) => `${i + 1}. ${l}`).join('\n');

  return `Tu es un routeur de classification d'articles de grande surface. Pour chaque article, choisis le secteur le plus probable parmi la liste ci-dessous.

Secteurs disponibles :
${sectorLines}

RÈGLES STRICTES :
- Retourne UNIQUEMENT du JSON valide, aucune explication narrative
- Utilise UNIQUEMENT les codes secteurs listés ci-dessus
- Pour chaque article, fournis : label (le libellé exact), topSectorCode (code secteur), confidence (0 à 1), reason (1 phrase courte), et optionnellement alternatives (secteurs secondaires plausibles)
- confidence >= 0.90 : tu es sûr du secteur
- confidence 0.65-0.89 : probable mais ambigu, ajoute des alternatives
- confidence < 0.65 : très incertain, ajoute 2+ alternatives

Articles à router :
${labelLines}`;
}
