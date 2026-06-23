export const SMALL_INPUT_THRESHOLD = 20;
export const BULK_BATCH_SIZE = 100;

export const ROUTER_HIGH_CONFIDENCE = 0.9;
export const ROUTER_MEDIUM_CONFIDENCE = 0.65;

export const RETRIEVAL_TOP_N = 15;

export const CYRUS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const CYRUS_CACHE_MAX_SIZE = 5000;
export const CYRUS_TAXONOMY_VERSION = "1.0.0";

export const CLASSIFICATION_STATUSES = [
  "classified",
  "needs_review",
  "fallback_used",
] as const;

export const CLASSIFICATION_SOURCES = [
  "cache",
  "expert",
  "validator",
  "legacy",
] as const;

export const CYRUS_V2_ENABLED = process.env.CYRUS_V2_DISABLED !== 'true';

export const CYRUS_V2_DEBUG = process.env.CYRUS_V2_DEBUG === 'true';
