import type { FinalClassification } from '@/lib/cyrus/types';
import { PerformanceCache } from '@/lib/performance-cache';
import {
  CYRUS_CACHE_TTL_MS,
  CYRUS_CACHE_MAX_SIZE,
  CYRUS_TAXONOMY_VERSION,
} from '@/lib/cyrus/constants';

const cyrusCache = new PerformanceCache<FinalClassification>(
  'cyrus-classifications',
  CYRUS_CACHE_MAX_SIZE,
  CYRUS_CACHE_TTL_MS,
);

function cacheKey(normalizedKey: string): string {
  return `cyrus:v2:${CYRUS_TAXONOMY_VERSION}:${normalizedKey}`;
}

export function lookupCache(
  normalizedKeys: string[],
): Map<string, FinalClassification> {
  const hits = new Map<string, FinalClassification>();
  for (const nk of normalizedKeys) {
    const result = cyrusCache.get(cacheKey(nk));
    if (result) {
      hits.set(nk, result);
    }
  }
  return hits;
}

export function writeCache(
  normalizedKey: string,
  classification: FinalClassification,
): void {
  cyrusCache.set(cacheKey(normalizedKey), classification);
}

export function invalidateCyrusCache(): void {
  cyrusCache.clear();
}
