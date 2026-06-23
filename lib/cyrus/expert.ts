import { generateObject } from 'ai';
import { z } from 'zod';
import { hyper } from '@/ai/providers';
import type {
  ExpertDecision,
  NormalizedRecord,
  CandidateNode,
  SectorTaxonomy,
} from '@/lib/cyrus/types';
import { loadSectorTaxonomy } from '@/lib/cyrus/taxonomy';
import { buildExpertPrompt } from '@/ai/prompts/cyrus-sector-expert';

function extractCodes(sector: SectorTaxonomy, level: string): [string, ...string[]] {
  const codes = [...new Set(
    sector.nodes.filter((n) => n.level === level).map((n) => n.code),
  )];
  if (codes.length === 0) return [''];
  return codes as [string, ...string[]];
}

function buildDynamicSchema(sector: SectorTaxonomy) {
  const rayonCodes = extractCodes(sector, 'rayon');
  const familleCodes = extractCodes(sector, 'famille');
  const sousFamilleCodes = extractCodes(sector, 'sous-famille');

  return z.object({
    classifications: z.array(
      z.object({
        rawLabel: z.string(),
        sectorCode: z.literal(sector.sectorCode),
        sectorName: z.literal(sector.sectorName),
        rayonCode: z.enum(rayonCodes),
        rayonName: z.string(),
        familleCode: z.enum(familleCodes),
        familleName: z.string(),
        sousFamilleCode: z.enum(sousFamilleCodes),
        sousFamilleName: z.string(),
        confidence: z.number().min(0).max(1),
        reason: z.string(),
      }),
    ),
  });
}

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
  const schema = buildDynamicSchema(sectorTaxonomy);

  try {
    const { object } = await generateObject({
      model: hyper.languageModel('hyper-default'),
      schema,
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
