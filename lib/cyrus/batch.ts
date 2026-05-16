import type {
  NormalizedRecord,
  FinalClassification,
} from '@/lib/cyrus/types';
import { BULK_BATCH_SIZE } from '@/lib/cyrus/constants';

async function parallelWithLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      const currentIndex = index;
      index++;
      const result = await tasks[currentIndex]();
      results.push(result);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => runNext(),
  );

  await Promise.all(workers);
  return results;
}

export async function processBatches(
  records: NormalizedRecord[],
  processFn: (batch: NormalizedRecord[]) => Promise<FinalClassification[]>,
  batchSize: number = BULK_BATCH_SIZE,
  maxParallel: number = 3,
): Promise<FinalClassification[]> {
  if (records.length === 0) return [];

  const batches: NormalizedRecord[][] = [];
  for (let i = 0; i < records.length; i += batchSize) {
    batches.push(records.slice(i, i + batchSize));
  }

  console.log(
    `[Cyrus V2] Processing ${batches.length} batches (${records.length} records, batch size ${batchSize}, max parallel ${maxParallel})`,
  );

  const tasks = batches.map(
    (batch) => () => processFn(batch),
  );

  const batchResults = await parallelWithLimit(tasks, maxParallel);
  return batchResults.flat();
}
