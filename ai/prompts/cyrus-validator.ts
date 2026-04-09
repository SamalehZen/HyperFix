import type { ExpertDecision } from '@/lib/cyrus/types';

export function buildValidatorPrompt(
  conflicts: Array<{ label: string; decisions: ExpertDecision[] }>,
): string {
  const conflictLines = conflicts
    .map((c, i) => {
      const options = c.decisions
        .map(
          (d, j) =>
            `  Option ${j + 1}: ${d.sectorCode}/${d.sectorName} > ${d.rayonCode}/${d.rayonName} > ${d.familleCode}/${d.familleName} > ${d.sousFamilleCode}/${d.sousFamilleName} (confiance: ${d.confidence.toFixed(2)}, raison: ${d.reason})`,
        )
        .join('\n');
      return `${i + 1}. "${c.label}"\n${options}`;
    })
    .join('\n\n');

  return `Tu es un arbitre de classification d'articles de grande surface. Plusieurs experts ont donné des classifications différentes pour les mêmes articles.

Pour chaque article en conflit, choisis la meilleure classification parmi les options proposées.

RÈGLES STRICTES :
- Choisis UNIQUEMENT parmi les options données, n'invente rien
- Retourne UNIQUEMENT du JSON valide
- Pour chaque article, retourne : rawLabel, l'option choisie (sectorCode, sectorName, rayonCode, rayonName, familleCode, familleName, sousFamilleCode, sousFamilleName), confidence (0-1), reason

Articles en conflit :
${conflictLines}`;
}
