import type { FinalClassification, PipelineMetrics } from '@/lib/cyrus/types';

export function formatClassificationsToMarkdown(
  classifications: FinalClassification[],
  duplicateMap: Map<string, number[]>,
  metrics: PipelineMetrics,
): string {
  const allRows = expandWithDuplicates(classifications, duplicateMap);
  allRows.sort((a, b) => a.inputIndex - b.inputIndex);

  const lines: string[] = [];

  lines.push(
    '| Libellé | Numéro Secteur | Nom Secteur | Numéro Rayon | Nom Rayon | Numéro Famille | Nom Famille | Code Sous-Famille | Nom Sous-Famille |',
  );
  lines.push(
    '|---------|----------------|-------------|--------------|-----------|----------------|-------------|-------------------|------------------|',
  );

  for (const row of allRows) {
    let label = row.rawLabel;
    if (row.status === 'needs_review') {
      label = `⚠️ ${label}`;
    } else if (row.status === 'fallback_used') {
      label = `❓ ${label}`;
    }

    lines.push(
      `| ${label} | ${row.sectorCode} | ${row.sectorName} | ${row.rayonCode} | ${row.rayonName} | ${row.familleCode} | ${row.familleName} | ${row.sousFamilleCode} | ${row.sousFamilleName} |`,
    );
  }

  const durationSec = (metrics.durationMs / 1000).toFixed(1);
  const needsReview = allRows.filter(
    (r) => r.status === 'needs_review' || r.status === 'fallback_used',
  ).length;

  lines.push('');
  lines.push('---');
  lines.push(
    `📊 **Résumé** : ${allRows.length} articles classés | ${metrics.cacheHits} depuis cache | ${needsReview} à vérifier | Temps : ${durationSec}s`,
  );

  return lines.join('\n');
}

function expandWithDuplicates(
  classifications: FinalClassification[],
  duplicateMap: Map<string, number[]>,
): FinalClassification[] {
  const result: FinalClassification[] = [];

  const classificationByKey = new Map<string, FinalClassification>();
  for (const c of classifications) {
    const key = c.normalizedLabel.replace(/\s+/g, '_').toLowerCase();
    classificationByKey.set(key, c);
    result.push(c);
  }

  for (const [normalizedKey, dupIndexes] of duplicateMap) {
    const original = classificationByKey.get(normalizedKey);
    if (!original) continue;

    for (const dupIndex of dupIndexes) {
      if (dupIndex === original.inputIndex) continue;
      result.push({
        ...original,
        inputIndex: dupIndex,
      });
    }
  }

  return result;
}
