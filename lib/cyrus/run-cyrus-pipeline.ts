import { generateObject } from 'ai';
import { z } from 'zod';
import { hyper } from '@/ai/providers';
import type {
  CyrusPipelineResult,
  FinalClassification,
  NormalizedRecord,
  PipelineMetrics,
} from '@/lib/cyrus/types';
import { BULK_BATCH_SIZE } from '@/lib/cyrus/constants';
import { extractInputRecordsAsync } from '@/lib/cyrus/extract-input';
import { normalizeAndDeduplicate } from '@/lib/cyrus/normalize';
import { lookupCache, writeCache } from '@/lib/cyrus/cache';
import { formatClassificationsToMarkdown } from '@/lib/cyrus/format-output';
import { loadMasterTaxonomy, isValidPath } from '@/lib/cyrus/taxonomy';

const BatchClassificationSchema = z.object({
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
    }),
  ),
});

function buildTaxonomySummary(): string {
  const master = loadMasterTaxonomy();
  const nodes = master.nodes;
  const sectors = nodes.filter((n) => n.level === 'sector');
  const lines: string[] = [];

  for (const sector of sectors) {
    lines.push(`${sector.code} ${sector.name}`);
    const rayons = nodes.filter(
      (n) => n.level === 'rayon' && n.parentId === sector.id,
    );
    for (const rayon of rayons) {
      lines.push(`  ${rayon.code} ${rayon.name}`);
      const familles = nodes.filter(
        (n) => n.level === 'famille' && n.parentId === rayon.id,
      );
      for (const famille of familles) {
        const sousFamilles = nodes.filter(
          (n) => n.level === 'sous-famille' && n.parentId === famille.id,
        );
        const sfList = sousFamilles
          .map((sf) => `${sf.code}:${sf.name}`)
          .join(', ');
        lines.push(`    ${famille.code} ${famille.name} → [${sfList}]`);
      }
    }
  }

  return lines.join('\n');
}

let taxonomySummaryCache: string | null = null;

function getTaxonomySummary(): string {
  if (!taxonomySummaryCache) {
    taxonomySummaryCache = buildTaxonomySummary();
  }
  return taxonomySummaryCache;
}

async function classifyBatch(
  records: NormalizedRecord[],
): Promise<Map<string, FinalClassification>> {
  const results = new Map<string, FinalClassification>();
  const labels = records.map((r) => r.normalizedLabel);
  const taxonomyJson = getTaxonomySummary();

  try {
    const { object } = await generateObject({
      model: hyper.languageModel('hyper-default'),
      schema: BatchClassificationSchema,
      system: `Tu es un expert en classification d'articles de grande surface (hypermarché GEANT CASINO).
Tu dois classer chaque article dans la hiérarchie exacte du magasin.

Hiérarchie du magasin (Secteur > Rayon > Famille > Sous-Famille) :
${taxonomyJson}

Règles :
- Utilise UNIQUEMENT les codes et noms présents dans la hiérarchie ci-dessus
- Chaque article doit être classé au niveau sous-famille
- sectorCode = code secteur (ex: "01"), sectorName = nom secteur (ex: "MARCHE")
- rayonCode = code rayon (ex: "010"), rayonName = nom rayon (ex: "BOUCHERIE")
- familleCode = code famille (ex: "101"), familleName = nom famille
- sousFamilleCode = code sous-famille, sousFamilleName = nom sous-famille
- confidence entre 0 et 1 (1 = certain, 0.5 = incertain)
- Renvoie exactement un résultat par article, dans le même ordre`,
      prompt: `Classifie ces ${labels.length} articles :\n\n${labels.map((l, i) => `${i + 1}. ${l}`).join('\n')}`,
    });

    for (const cls of object.classifications) {
      const matchingRecord = records.find(
        (r) =>
          r.normalizedLabel === cls.rawLabel ||
          r.rawLabel === cls.rawLabel ||
          r.normalizedLabel.toUpperCase() === cls.rawLabel.toUpperCase(),
      );

      if (!matchingRecord) continue;

      const valid = isValidPath(
        cls.sectorCode,
        cls.rayonCode,
        cls.familleCode,
        cls.sousFamilleCode,
      );

      const confidence = valid ? cls.confidence : Math.min(cls.confidence, 0.5);
      let status: FinalClassification['status'] = 'classified';
      if (!valid) {
        status = 'fallback_used';
      } else if (cls.confidence < 0.65) {
        status = 'needs_review';
      }

      results.set(matchingRecord.normalizedKey, {
        inputIndex: matchingRecord.inputIndex,
        rawLabel: matchingRecord.rawLabel,
        normalizedLabel: matchingRecord.normalizedLabel,
        sectorCode: cls.sectorCode,
        sectorName: cls.sectorName,
        rayonCode: cls.rayonCode,
        rayonName: cls.rayonName,
        familleCode: cls.familleCode,
        familleName: cls.familleName,
        sousFamilleCode: cls.sousFamilleCode,
        sousFamilleName: cls.sousFamilleName,
        confidence,
        status,
        source: 'expert',
      });
    }
  } catch (error) {
    console.error('[Cyrus V2] Batch classification failed:', error);
    for (const record of records) {
      if (!results.has(record.normalizedKey)) {
        results.set(record.normalizedKey, {
          inputIndex: record.inputIndex,
          rawLabel: record.rawLabel,
          normalizedLabel: record.normalizedLabel,
          sectorCode: '',
          sectorName: '',
          rayonCode: '',
          rayonName: '',
          familleCode: '',
          familleName: '',
          sousFamilleCode: '',
          sousFamilleName: '',
          confidence: 0,
          status: 'fallback_used',
          source: 'expert',
        });
      }
    }
  }

  return results;
}

export async function runCyrusPipeline(
  messageContent: string,
  attachments?: Array<{ name: string; contentType: string; url: string }>,
): Promise<CyrusPipelineResult> {
  const startTime = Date.now();

  const inputRecords = await extractInputRecordsAsync(
    messageContent,
    attachments,
  );

  if (inputRecords.length === 0) {
    const metrics: PipelineMetrics = {
      totalInput: 0,
      uniqueLabels: 0,
      cacheHits: 0,
      cacheMisses: 0,
      durationMs: Date.now() - startTime,
      mode: 'bulk',
    };
    return {
      classifications: [],
      markdown: '> Aucun article détecté dans votre message.',
      metrics,
    };
  }

  const { uniqueRecords, duplicateMap, totalDuplicates } =
    normalizeAndDeduplicate(inputRecords);

  const uniqueKeys = uniqueRecords.map((r) => r.normalizedKey);
  const cacheHits = lookupCache(uniqueKeys);

  const cacheMisses = uniqueRecords.filter(
    (r) => !cacheHits.has(r.normalizedKey),
  );

  const allClassifications = new Map<string, FinalClassification>();

  for (const [key, classification] of cacheHits) {
    const record = uniqueRecords.find((r) => r.normalizedKey === key);
    if (record) {
      allClassifications.set(key, {
        ...classification,
        inputIndex: record.inputIndex,
        source: 'cache',
      });
    }
  }

  if (cacheMisses.length > 0) {
    for (let i = 0; i < cacheMisses.length; i += BULK_BATCH_SIZE) {
      const batch = cacheMisses.slice(i, i + BULK_BATCH_SIZE);
      const batchResults = await classifyBatch(batch);

      for (const [key, classification] of batchResults) {
        allClassifications.set(key, classification);
        if (classification.status !== 'fallback_used' || classification.confidence > 0) {
          writeCache(key, classification);
        }
      }
    }
  }

  const finalClassifications: FinalClassification[] = [];
  for (const record of uniqueRecords) {
    const cls = allClassifications.get(record.normalizedKey);
    if (cls) {
      finalClassifications.push(cls);
    } else {
      finalClassifications.push({
        inputIndex: record.inputIndex,
        rawLabel: record.rawLabel,
        normalizedLabel: record.normalizedLabel,
        sectorCode: '',
        sectorName: '',
        rayonCode: '',
        rayonName: '',
        familleCode: '',
        familleName: '',
        sousFamilleCode: '',
        sousFamilleName: '',
        confidence: 0,
        status: 'fallback_used',
        source: 'expert',
      });
    }
  }

  const durationMs = Date.now() - startTime;

  const metrics: PipelineMetrics = {
    totalInput: inputRecords.length,
    uniqueLabels: uniqueRecords.length,
    cacheHits: cacheHits.size,
    cacheMisses: cacheMisses.length,
    durationMs,
    mode: 'bulk',
  };

  const markdown = formatClassificationsToMarkdown(
    finalClassifications,
    duplicateMap,
    metrics,
  );

  return { classifications: finalClassifications, markdown, metrics };
}
