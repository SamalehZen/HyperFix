import type { InputRecord, NormalizedRecord } from '@/lib/cyrus/types';

export function normalizeLabel(rawLabel: string): {
  normalizedLabel: string;
  normalizedKey: string;
} {
  let label = rawLabel.trim();

  label = label.toUpperCase();

  label = label.replace(/\s+/g, ' ');

  label = label.replace(/\u2013|\u2014/g, '-');
  label = label.replace(/[\u2018\u2019\u201A\u201B\u0060]/g, "'");
  label = label.replace(/[\u201C\u201D\u201E\u201F]/g, '"');

  label = label.replace(/[^A-Z0-9\s\-\/'.ÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ]/g, '');

  label = label.replace(/\s+/g, ' ').trim();

  const normalizedKey = label.replace(/\s+/g, '_').toLowerCase();

  return { normalizedLabel: label, normalizedKey };
}

export function normalizeAndDeduplicate(records: InputRecord[]): {
  uniqueRecords: NormalizedRecord[];
  duplicateMap: Map<string, number[]>;
  totalDuplicates: number;
} {
  const uniqueRecords: NormalizedRecord[] = [];
  const duplicateMap = new Map<string, number[]>();
  const seenKeys = new Map<string, number>();
  let totalDuplicates = 0;

  for (const record of records) {
    const { normalizedLabel, normalizedKey } = normalizeLabel(record.rawLabel);

    if (seenKeys.has(normalizedKey)) {
      const existing = duplicateMap.get(normalizedKey);
      if (existing) {
        existing.push(record.inputIndex);
      } else {
        duplicateMap.set(normalizedKey, [
          seenKeys.get(normalizedKey)!,
          record.inputIndex,
        ]);
      }
      totalDuplicates++;
    } else {
      seenKeys.set(normalizedKey, record.inputIndex);
      uniqueRecords.push({
        ...record,
        normalizedLabel,
        normalizedKey,
      });
    }
  }

  return { uniqueRecords, duplicateMap, totalDuplicates };
}
