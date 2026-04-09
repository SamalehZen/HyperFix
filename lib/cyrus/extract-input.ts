import { InputRecord } from '@/lib/cyrus/types';

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  const sep = line.includes(';') ? ';' : ',';

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === sep) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

const LABEL_HEADERS = ['libellé', 'libelle', 'article', 'nom', 'label', 'designation', 'désignation', 'produit'];

function detectLabelColumn(headerRow: string[]): number {
  const lower = headerRow.map((h) => h.toLowerCase().replace(/['"]/g, '').trim());
  for (let i = 0; i < lower.length; i++) {
    if (LABEL_HEADERS.includes(lower[i])) return i;
  }
  return 0;
}

function linesFromText(raw: string): string[] {
  return raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
}

function recordsFromLines(
  lines: string[],
  sourceType: InputRecord['sourceType'],
  sourceFileName?: string,
): InputRecord[] {
  return lines.map((line, idx) => ({
    inputIndex: idx,
    sourceType,
    sourceFileName,
    sourceRow: idx + 1,
    rawLabel: line,
  }));
}

function parseCSVContent(raw: string, sourceFileName?: string): InputRecord[] {
  const rows = raw.split('\n').filter((l) => l.trim().length > 0);
  if (rows.length === 0) return [];

  const headerFields = parseCSVLine(rows[0]);
  const colIdx = detectLabelColumn(headerFields);

  const isHeaderRow = LABEL_HEADERS.includes(
    headerFields[colIdx]?.toLowerCase().replace(/['"]/g, '').trim() ?? '',
  );

  const dataRows = isHeaderRow ? rows.slice(1) : rows;
  const records: InputRecord[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const fields = parseCSVLine(dataRows[i]);
    const label = (fields[colIdx] ?? '').replace(/^["']|["']$/g, '').trim();
    if (!label) continue;
    records.push({
      inputIndex: records.length,
      sourceType: 'csv',
      sourceFileName,
      sourceRow: (isHeaderRow ? i + 2 : i + 1),
      rawLabel: label,
    });
  }
  return records;
}

function parseXLSXContent(buffer: ArrayBuffer, sourceFileName?: string): InputRecord[] {
  try {
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length === 0) return [];

    const headerRow = rows[0].map((c: unknown) => String(c ?? ''));
    const colIdx = detectLabelColumn(headerRow);

    const isHeaderRow = LABEL_HEADERS.includes(
      headerRow[colIdx]?.toLowerCase().replace(/['"]/g, '').trim() ?? '',
    );

    const dataRows = isHeaderRow ? rows.slice(1) : rows;
    const records: InputRecord[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const label = String(dataRows[i][colIdx] ?? '').trim();
      if (!label) continue;
      records.push({
        inputIndex: records.length,
        sourceType: 'xlsx',
        sourceFileName,
        sourceRow: (isHeaderRow ? i + 2 : i + 1),
        rawLabel: label,
      });
    }
    return records;
  } catch {
    return [];
  }
}

export function extractInputRecords(
  messageContent: string,
  attachments?: Array<{ name: string; contentType: string; url: string }>,
): InputRecord[] {
  const records: InputRecord[] = [];

  const textLines = linesFromText(messageContent);
  if (textLines.length > 0) {
    records.push(...recordsFromLines(textLines, 'text'));
  }

  return records;
}

export async function extractInputRecordsAsync(
  messageContent: string,
  attachments?: Array<{ name: string; contentType: string; url: string }>,
): Promise<InputRecord[]> {
  const records: InputRecord[] = [];
  let indexOffset = 0;

  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      try {
        const res = await fetch(att.url);
        if (!res.ok) continue;

        const ext = att.name.split('.').pop()?.toLowerCase() ?? '';
        const contentType = att.contentType?.toLowerCase() ?? '';

        if (ext === 'csv' || contentType.includes('csv')) {
          const text = await res.text();
          const csvRecords = parseCSVContent(text, att.name);
          for (const r of csvRecords) {
            r.inputIndex = indexOffset + r.inputIndex;
          }
          indexOffset += csvRecords.length;
          records.push(...csvRecords);
        } else if (ext === 'xlsx' || ext === 'xls' || contentType.includes('spreadsheet') || contentType.includes('excel')) {
          const buf = await res.arrayBuffer();
          const xlsxRecords = parseXLSXContent(buf, att.name);
          for (const r of xlsxRecords) {
            r.inputIndex = indexOffset + r.inputIndex;
          }
          indexOffset += xlsxRecords.length;
          records.push(...xlsxRecords);
        } else if (ext === 'txt' || contentType.includes('text/plain')) {
          const text = await res.text();
          const lines = linesFromText(text);
          const txtRecords = recordsFromLines(lines, 'txt', att.name);
          for (const r of txtRecords) {
            r.inputIndex = indexOffset + r.inputIndex;
          }
          indexOffset += txtRecords.length;
          records.push(...txtRecords);
        } else if (ext === 'pdf' || contentType.includes('pdf')) {
          // PDF parsing requires a dedicated library (pdf-parse) not yet installed.
          // Skip PDF files for now — proper support will come in a future sprint.
          console.warn(`[Cyrus V2] Skipping PDF attachment "${att.name}" — PDF parsing not yet supported`);
          continue;
        }
      } catch {
        continue;
      }
    }
  }

  if (records.length === 0) {
    const textLines = linesFromText(messageContent);
    if (textLines.length > 0) {
      records.push(...recordsFromLines(textLines, 'text'));
    }
  } else {
    const textLines = linesFromText(messageContent);
    if (textLines.length > 0) {
      const textRecords = recordsFromLines(textLines, 'text');
      for (const r of textRecords) {
        r.inputIndex = indexOffset + r.inputIndex;
      }
      records.push(...textRecords);
    }
  }

  return records;
}
