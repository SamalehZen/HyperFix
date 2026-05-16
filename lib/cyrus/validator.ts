import type {
  ExpertDecision,
  FinalClassification,
  NormalizedRecord,
  ClassificationStatus,
  ClassificationSource,
} from '@/lib/cyrus/types';
import { isValidPath } from '@/lib/cyrus/taxonomy';

function validatePath(decision: ExpertDecision): boolean {
  return isValidPath(
    decision.sectorCode,
    decision.rayonCode,
    decision.familleCode,
    decision.sousFamilleCode,
  );
}

function pickBestDecision(decisions: ExpertDecision[]): {
  decision: ExpertDecision;
  source: ClassificationSource;
} {
  const validDecisions = decisions.filter((d) => validatePath(d));

  if (validDecisions.length === 0) {
    const sorted = [...decisions].sort((a, b) => b.confidence - a.confidence);
    return { decision: sorted[0], source: 'expert' };
  }

  if (validDecisions.length === 1) {
    return { decision: validDecisions[0], source: 'expert' };
  }

  const allSame =
    validDecisions.every(
      (d) =>
        d.sectorCode === validDecisions[0].sectorCode &&
        d.rayonCode === validDecisions[0].rayonCode &&
        d.familleCode === validDecisions[0].familleCode &&
        d.sousFamilleCode === validDecisions[0].sousFamilleCode,
    );

  if (allSame) {
    const best = validDecisions.reduce((a, b) =>
      a.confidence >= b.confidence ? a : b,
    );
    return { decision: best, source: 'expert' };
  }

  const sorted = validDecisions.sort((a, b) => b.confidence - a.confidence);
  return { decision: sorted[0], source: 'validator' };
}

function determineStatus(
  decision: ExpertDecision,
  pathValid: boolean,
): ClassificationStatus {
  if (!pathValid) return 'needs_review';
  if (decision.confidence >= 0.7) return 'classified';
  return 'needs_review';
}

export function validateDecisions(
  decisions: Map<string, ExpertDecision | ExpertDecision[]>,
  normalizedRecords: NormalizedRecord[],
): FinalClassification[] {
  const results: FinalClassification[] = [];

  for (const record of normalizedRecords) {
    const raw = decisions.get(record.normalizedLabel);

    if (!raw) {
      results.push({
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
        status: 'needs_review',
        source: 'expert',
      });
      continue;
    }

    const decisionsArray = Array.isArray(raw) ? raw : [raw];
    const { decision, source } = pickBestDecision(decisionsArray);
    const pathValid = validatePath(decision);
    const status = determineStatus(decision, pathValid);

    results.push({
      inputIndex: record.inputIndex,
      rawLabel: record.rawLabel,
      normalizedLabel: record.normalizedLabel,
      sectorCode: decision.sectorCode,
      sectorName: decision.sectorName,
      rayonCode: decision.rayonCode,
      rayonName: decision.rayonName,
      familleCode: decision.familleCode,
      familleName: decision.familleName,
      sousFamilleCode: decision.sousFamilleCode,
      sousFamilleName: decision.sousFamilleName,
      confidence: pathValid ? decision.confidence : Math.min(decision.confidence, 0.5),
      status,
      source,
    });
  }

  const classified = results.filter((r) => r.status === 'classified').length;
  const review = results.filter((r) => r.status === 'needs_review').length;
  console.log(
    `[Cyrus V2] Validation complete: ${classified} classified, ${review} needs_review, ${results.length} total`,
  );

  return results;
}
