import { z } from "zod";

export const TaxonomyLevelSchema = z.enum([
  "sector",
  "rayon",
  "famille",
  "sous-famille",
]);

export const TaxonomyNodeSchema = z.object({
  id: z.string(),
  level: TaxonomyLevelSchema,
  code: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  aliases: z.array(z.string()),
});

export const MasterTaxonomySchema = z.object({
  version: z.string(),
  storeName: z.string(),
  storeCode: z.string(),
  generatedAt: z.string(),
  nodes: z.array(TaxonomyNodeSchema),
});

export const SectorTaxonomySchema = z.object({
  sectorCode: z.string(),
  sectorName: z.string(),
  sectorId: z.string(),
  nodes: z.array(TaxonomyNodeSchema),
});

export const InputRecordSchema = z.object({
  inputIndex: z.number().int().nonnegative(),
  sourceType: z.enum(["text", "txt", "csv", "xlsx", "pdf"]),
  sourceFileName: z.string().optional(),
  sourceRow: z.number().int().positive().optional(),
  rawLabel: z.string().min(1),
});

export const NormalizedRecordSchema = InputRecordSchema.extend({
  normalizedLabel: z.string().min(1),
  normalizedKey: z.string().min(1),
});

export const CandidateNodeSchema = z.object({
  nodeId: z.string(),
  sectorCode: z.string(),
  path: z.array(z.string()),
  score: z.number().min(0).max(1),
  reasons: z.array(z.string()),
});

export const RoutingDecisionSchema = z.object({
  topSectorCode: z.string(),
  alternatives: z.array(
    z.object({
      sectorCode: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
  confidence: z.number().min(0).max(1),
  reason: z.string(),
});

export const ExpertDecisionSchema = z.object({
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
});

export const ClassificationStatusSchema = z.enum([
  "classified",
  "needs_review",
  "fallback_used",
]);

export const ClassificationSourceSchema = z.enum([
  "cache",
  "expert",
  "validator",
  "legacy",
]);

export const FinalClassificationSchema = z.object({
  inputIndex: z.number().int().nonnegative(),
  rawLabel: z.string(),
  normalizedLabel: z.string(),
  sectorCode: z.string(),
  sectorName: z.string(),
  rayonCode: z.string(),
  rayonName: z.string(),
  familleCode: z.string(),
  familleName: z.string(),
  sousFamilleCode: z.string(),
  sousFamilleName: z.string(),
  confidence: z.number().min(0).max(1),
  status: ClassificationStatusSchema,
  source: ClassificationSourceSchema,
});

export const PipelineMetricsSchema = z.object({
  totalInput: z.number().int().nonnegative(),
  uniqueLabels: z.number().int().nonnegative(),
  cacheHits: z.number().int().nonnegative(),
  cacheMisses: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative(),
  mode: z.enum(["simple", "bulk"]),
});

export const CyrusPipelineResultSchema = z.object({
  classifications: z.array(FinalClassificationSchema),
  markdown: z.string(),
  metrics: PipelineMetricsSchema,
});

export const AliasEntrySchema = z.object({
  term: z.string().min(1),
  targets: z.array(z.string()),
  weight: z.number().min(0).max(1),
});

export const AliasStoreSchema = z.object({
  version: z.string(),
  aliases: z.array(AliasEntrySchema),
});
