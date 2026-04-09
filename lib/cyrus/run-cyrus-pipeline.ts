import { generateObject } from 'ai';
import { z } from 'zod';
import { hyper } from '@/ai/providers';
import type {
  CyrusPipelineResult,
  FinalClassification,
  NormalizedRecord,
  PipelineMetrics,
  ExpertDecision,
  CandidateNode,
} from '@/lib/cyrus/types';
import {
  BULK_BATCH_SIZE,
  CYRUS_V2_ENABLED,
  CYRUS_V2_DEBUG,
  ROUTER_HIGH_CONFIDENCE,
  ROUTER_MEDIUM_CONFIDENCE,
} from '@/lib/cyrus/constants';
import { extractInputRecordsAsync } from '@/lib/cyrus/extract-input';
import { normalizeAndDeduplicate } from '@/lib/cyrus/normalize';
import { lookupCache, writeCache } from '@/lib/cyrus/cache';
import { formatClassificationsToMarkdown } from '@/lib/cyrus/format-output';
import { loadMasterTaxonomy, isValidPath } from '@/lib/cyrus/taxonomy';
import { retrieveCandidates, ensureSearchIndex } from '@/lib/cyrus/retrieve';
import { routeLabels, getSectorsForLabel } from '@/lib/cyrus/router';
import { classifyInSector } from '@/lib/cyrus/expert';
import { validateDecisions } from '@/lib/cyrus/validator';
import { processBatches } from '@/lib/cyrus/batch';
import { MetricsCollector } from '@/lib/cyrus/metrics';
import { CyrusLogger } from '@/lib/cyrus/logger';

// ──────────────────────────────────────────────
// Legacy Sprint 1 fallback (streamText-compatible)
// ──────────────────────────────────────────────

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

async function classifyBatchLegacy(
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
        source: 'legacy',
      });
    }
  } catch (error) {
    console.error('[Cyrus V2] Legacy batch classification failed:', error);
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
          source: 'legacy',
        });
      }
    }
  }

  return results;
}

// ──────────────────────────────────────────────
// Sprint 2 intelligent pipeline
// ──────────────────────────────────────────────

async function classifyBatchV2(
  records: NormalizedRecord[],
  metrics?: MetricsCollector,
  logger?: CyrusLogger,
): Promise<FinalClassification[]> {
  const candidatesMap = new Map<string, CandidateNode[]>();
  for (const record of records) {
    const candidates = retrieveCandidates(record.normalizedLabel);
    candidatesMap.set(record.normalizedLabel, candidates);
  }

  const labels = records.map((r) => r.normalizedLabel);
  const routingDecisions = await routeLabels(labels, candidatesMap);

  if (metrics) {
    for (const [, decision] of routingDecisions) {
      metrics.incrementRouting(decision.confidence);
    }
  }

  const sectorGroups = new Map<string, NormalizedRecord[]>();

  for (const record of records) {
    const decision = routingDecisions.get(record.normalizedLabel);
    if (!decision) continue;

    const targetSectors = getSectorsForLabel(decision);
    for (const sector of targetSectors) {
      const group = sectorGroups.get(sector) ?? [];
      group.push(record);
      sectorGroups.set(sector, group);
    }
  }

  const expertTasks: (() => Promise<{
    sectorCode: string;
    results: Map<string, ExpertDecision>;
  }>)[] = [];

  for (const [sectorCode, sectorRecords] of sectorGroups) {
    if (metrics) {
      metrics.increment('expertCalls');
      metrics.addSector(sectorCode);
    }
    expertTasks.push(async () => {
      const results = await classifyInSector(
        sectorCode,
        sectorRecords,
        candidatesMap,
      );
      return { sectorCode, results };
    });
  }

  const MAX_PARALLEL_EXPERTS = 3;
  const expertResults: {
    sectorCode: string;
    results: Map<string, ExpertDecision>;
  }[] = [];

  let taskIndex = 0;
  async function runNextExpert(): Promise<void> {
    while (taskIndex < expertTasks.length) {
      const idx = taskIndex;
      taskIndex++;
      const result = await expertTasks[idx]();
      expertResults.push(result);
    }
  }

  const workers = Array.from(
    { length: Math.min(MAX_PARALLEL_EXPERTS, expertTasks.length) },
    () => runNextExpert(),
  );
  await Promise.all(workers);

  const mergedDecisions = new Map<
    string,
    ExpertDecision | ExpertDecision[]
  >();

  for (const { results } of expertResults) {
    for (const [label, decision] of results) {
      const existing = mergedDecisions.get(label);
      if (!existing) {
        mergedDecisions.set(label, decision);
      } else if (Array.isArray(existing)) {
        existing.push(decision);
      } else {
        mergedDecisions.set(label, [existing, decision]);
      }
    }
  }

  return validateDecisions(mergedDecisions, records);
}

// ──────────────────────────────────────────────
// Main orchestrator
// ──────────────────────────────────────────────

export async function runCyrusPipeline(
  messageContent: string,
  attachments?: Array<{ name: string; contentType: string; url: string }>,
): Promise<CyrusPipelineResult> {
  if (!CYRUS_V2_ENABLED) {
    throw new Error('Cyrus V2 is disabled');
  }

  const startTime = Date.now();
  const metrics = new MetricsCollector();
  const logger = new CyrusLogger();

  if (CYRUS_V2_DEBUG) {
    logger.info('pipeline', 'Starting pipeline in DEBUG mode', {
      messageLength: messageContent.length,
    });
  }

  try {
    // Step 1: Extract input records
    metrics.startStep('extraction');
    const inputRecords = await extractInputRecordsAsync(
      messageContent,
      attachments,
    );
    metrics.endStep('extraction');

    if (inputRecords.length === 0) {
      const base: PipelineMetrics = {
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
        metrics: base,
      };
    }

    // Step 2: Normalize and deduplicate
    metrics.startStep('normalization');
    const { uniqueRecords, duplicateMap, totalDuplicates } =
      normalizeAndDeduplicate(inputRecords);
    metrics.endStep('normalization');

    logger.info('normalization', `${inputRecords.length} → ${uniqueRecords.length} uniques (${totalDuplicates} duplicates)`);

    // Step 3: Cache lookup
    metrics.startStep('cacheLookup');
    const uniqueKeys = uniqueRecords.map((r) => r.normalizedKey);
    const cacheHits = lookupCache(uniqueKeys);
    metrics.endStep('cacheLookup');

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

    logger.info('cache', `${cacheHits.size} hits, ${cacheMisses.length} misses`);

    // Step 4: Classify cache misses
    if (cacheMisses.length > 0) {
      let newClassifications: FinalClassification[] = [];

      try {
        metrics.startStep('retrieval');
        ensureSearchIndex();
        metrics.endStep('retrieval');

        metrics.startStep('expert');

        newClassifications = await processBatches(
          cacheMisses,
          (batch) => classifyBatchV2(batch, metrics, logger),
          BULK_BATCH_SIZE,
          3,
        );

        metrics.endStep('expert');

        logger.info('pipeline', `V2 classified ${newClassifications.length} labels`);
      } catch (error) {
        metrics.endStep('expert');
        logger.error(
          'pipeline',
          'V2 pipeline failed, falling back to legacy',
          { error: error instanceof Error ? error.message : String(error) },
        );
        newClassifications = [];
      }

      const classifiedKeys = new Set(
        newClassifications
          .filter((c) => c.sectorCode !== '')
          .map((c) => c.normalizedLabel.replace(/\s+/g, '_').toLowerCase()),
      );

      const unclassified = cacheMisses.filter(
        (r) => !classifiedKeys.has(r.normalizedKey),
      );

      if (unclassified.length > 0) {
        logger.info('legacy', `Fallback for ${unclassified.length} unclassified labels`);
        for (let i = 0; i < unclassified.length; i += BULK_BATCH_SIZE) {
          const batch = unclassified.slice(i, i + BULK_BATCH_SIZE);
          const legacyResults = await classifyBatchLegacy(batch);
          for (const [key, classification] of legacyResults) {
            allClassifications.set(key, classification);
          }
        }
      }

      for (const cls of newClassifications) {
        if (cls.sectorCode === '') continue;
        const key = cls.normalizedLabel.replace(/\s+/g, '_').toLowerCase();
        allClassifications.set(key, cls);
      }

      for (const [key, classification] of allClassifications) {
        if (
          classification.source !== 'cache' &&
          classification.status !== 'fallback_used'
        ) {
          writeCache(key, classification);
        }
      }
    }

    // Step 5: Build final list
    metrics.startStep('validation');
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
    metrics.endStep('validation');

    for (const cls of finalClassifications) {
      metrics.incrementValidation(cls.status);
    }

    const durationMs = Date.now() - startTime;

    metrics.setBase({
      totalInput: inputRecords.length,
      uniqueLabels: uniqueRecords.length,
      cacheHits: cacheHits.size,
      cacheMisses: cacheMisses.length,
      durationMs,
      mode: 'bulk',
    });

    const estimatedTokens = Math.round(
      inputRecords.length * 60 + (metrics.finalize().expertCalls * 2000),
    );
    metrics.addTokens(estimatedTokens);

    metrics.logSummary();

    // Step 6: Format output
    metrics.startStep('formatting');
    const detailedMetrics = metrics.finalize();
    const markdown = formatClassificationsToMarkdown(
      finalClassifications,
      duplicateMap,
      detailedMetrics,
    );
    metrics.endStep('formatting');

    return {
      classifications: finalClassifications,
      markdown,
      metrics: detailedMetrics,
    };
  } catch (error) {
    console.error('[Cyrus V2] Pipeline error:', {
      step: metrics.getCurrentStep(),
      error: error instanceof Error ? error.message : String(error),
      metrics: metrics.finalize(),
    });
    throw error;
  }
}
