import { generateObject } from 'ai';
import { z } from 'zod';
import { hyper } from '@/ai/providers';
import type {
  ExpertDecision,
  NormalizedRecord,
  CandidateNode,
} from '@/lib/cyrus/types';
import { loadSectorTaxonomy } from '@/lib/cyrus/taxonomy';
import { buildExpertPrompt } from '@/ai/prompts/cyrus-sector-expert';

const ExpertOutputSchema = z.object({
  classifications: z.array(
    z.object({
      rawLabel: z.string(),
      sectorCode: z.string(),
      sectorName: z.string(),
      rayonCode: z.string(),
      rayonName: z.string(),
      familleCode: z.string(),
      familleName: z.string(),
      sousFamilleCode: z.string(),
      sousFamilleName: z.string(),
      confidence: z.number().min(0).max(1),
      reason: z.string(),
    }),
  ),
});

export async function classifyInSector(
  sectorCode: string,
  labels: NormalizedRecord[],
  candidates: Map<string, CandidateNode[]>,
): Promise<Map<string, ExpertDecision>> {
  const results = new Map<string, ExpertDecision>();

  const sectorTaxonomy = loadSectorTaxonomy(sectorCode);
  const labelStrings = labels.map((l) => l.normalizedLabel);

  const allCandidates: CandidateNode[] = [];
  for (const label of labels) {
    const labelCandidates = candidates.get(label.normalizedLabel) ?? [];
    const sectorCandidates = labelCandidates.filter(
      (c) => c.sectorCode === sectorCode,
    );
    allCandidates.push(...sectorCandidates);
  }

  const prompt = buildExpertPrompt(sectorTaxonomy, allCandidates, labelStrings);

  try {
    const { object } = await generateObject({
      model: hyper.languageModel('hyper-default'),
      schema: ExpertOutputSchema,
      prompt,
    });

    for (const cls of object.classifications) {
      const matchingRecord = labels.find(
        (r) =>
          r.normalizedLabel === cls.rawLabel ||
          r.rawLabel === cls.rawLabel ||
          r.normalizedLabel.toUpperCase() === cls.rawLabel.toUpperCase(),
      );

      if (!matchingRecord) continue;

      results.set(matchingRecord.normalizedLabel, {
        sectorCode: cls.sectorCode,
        sectorName: cls.sectorName,
        rayonCode: cls.rayonCode,
        rayonName: cls.rayonName,
        familleCode: cls.familleCode,
        familleName: cls.familleName,
        sousFamilleCode: cls.sousFamilleCode,
        sousFamilleName: cls.sousFamilleName,
        confidence: cls.confidence,
        reason: cls.reason,
      });
    }
  } catch (error) {
    console.error(
      `[Cyrus V2] Expert classification failed for sector ${sectorCode}:`,
      error,
    );
  }

  console.log(
    `[Cyrus V2] Expert sector ${sectorCode}: classified ${results.size}/${labels.length} labels`,
  );

  return results;
}
