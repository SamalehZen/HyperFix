export type TaxonomyLevel = "sector" | "rayon" | "famille" | "sous-famille";

export interface TaxonomyNode {
  id: string;
  level: TaxonomyLevel;
  code: string;
  name: string;
  parentId: string | null;
  aliases: string[];
}

export interface MasterTaxonomy {
  version: string;
  storeName: string;
  storeCode: string;
  generatedAt: string;
  nodes: TaxonomyNode[];
}

export interface SectorTaxonomy {
  sectorCode: string;
  sectorName: string;
  sectorId: string;
  nodes: TaxonomyNode[];
}

export interface InputRecord {
  inputIndex: number;
  sourceType: "text" | "txt" | "csv" | "xlsx" | "pdf";
  sourceFileName?: string;
  sourceRow?: number;
  rawLabel: string;
}

export interface NormalizedRecord extends InputRecord {
  normalizedLabel: string;
  normalizedKey: string;
}

export interface CandidateNode {
  nodeId: string;
  sectorCode: string;
  path: string[];
  score: number;
  reasons: string[];
}

export interface RoutingDecision {
  topSectorCode: string;
  alternatives: Array<{ sectorCode: string; confidence: number }>;
  confidence: number;
  reason: string;
}

export interface ExpertDecision {
  sectorCode: string;
  sectorName: string;
  rayonCode: string;
  rayonName: string;
  familleCode: string;
  familleName: string;
  sousFamilleCode: string;
  sousFamilleName: string;
  confidence: number;
  reason: string;
}

export type ClassificationStatus = "classified" | "needs_review" | "fallback_used";
export type ClassificationSource = "cache" | "expert" | "validator" | "legacy";

export interface FinalClassification {
  inputIndex: number;
  rawLabel: string;
  normalizedLabel: string;
  sectorCode: string;
  sectorName: string;
  rayonCode: string;
  rayonName: string;
  familleCode: string;
  familleName: string;
  sousFamilleCode: string;
  sousFamilleName: string;
  confidence: number;
  status: ClassificationStatus;
  source: ClassificationSource;
}

export interface CyrusPipelineResult {
  classifications: FinalClassification[];
  markdown: string;
  metrics: PipelineMetrics;
}

export interface PipelineMetrics {
  totalInput: number;
  uniqueLabels: number;
  cacheHits: number;
  cacheMisses: number;
  durationMs: number;
  mode: "simple" | "bulk";
}

export interface AliasEntry {
  term: string;
  targets: string[];
  weight: number;
}

export interface AliasStore {
  version: string;
  aliases: AliasEntry[];
}
