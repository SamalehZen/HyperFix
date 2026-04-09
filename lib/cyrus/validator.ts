import type {
  ExpertDecision,
  FinalClassification,
  NormalizedRecord,
  ClassificationStatus,
  ClassificationSource,
  TaxonomyNode,
} from '@/lib/cyrus/types';
import { isValidPath, loadSectorTaxonomy } from '@/lib/cyrus/taxonomy';

function validatePath(decision: ExpertDecision): boolean {
  return isValidPath(
    decision.sectorCode,
    decision.rayonCode,
    decision.familleCode,
    decision.sousFamilleCode,
  );
}

function normalize(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function tryRepairPath(decision: ExpertDecision): ExpertDecision | null {
  try {
    const sector = loadSectorTaxonomy(decision.sectorCode);
    const nodes = sector.nodes;

    const rayons = nodes.filter((n) => n.level === 'rayon');
    let rayon: TaxonomyNode | undefined;

    rayon = rayons.find((n) => n.code === decision.rayonCode);
    if (!rayon) {
      rayon = rayons.find(
        (n) => normalize(n.name) === normalize(decision.rayonName),
      );
    }
    if (!rayon && rayons.length === 1) {
      rayon = rayons[0];
    }
    if (!rayon) return null;

    const familles = nodes.filter(
      (n) => n.level === 'famille' && n.parentId === rayon!.id,
    );
    let famille: TaxonomyNode | undefined;

    famille = familles.find((n) => n.code === decision.familleCode);
    if (!famille) {
      famille = familles.find(
        (n) => normalize(n.name) === normalize(decision.familleName),
      );
    }
    if (!famille) {
      famille = nodes
        .filter((n) => n.level === 'famille')
        .find(
          (n) =>
            n.code === decision.familleCode ||
            normalize(n.name) === normalize(decision.familleName),
        );
      if (famille) {
        const correctRayon = nodes.find(
          (n) => n.id === famille!.parentId && n.level === 'rayon',
        );
        if (correctRayon) rayon = correctRayon;
      }
    }
    if (!famille) return null;

    const sousFamilles = nodes.filter(
      (n) => n.level === 'sous-famille' && n.parentId === famille!.id,
    );
    let sf: TaxonomyNode | undefined;

    sf = sousFamilles.find((n) => n.code === decision.sousFamilleCode);
    if (!sf) {
      sf = sousFamilles.find(
        (n) => normalize(n.name) === normalize(decision.sousFamilleName),
      );
    }
    if (!sf) {
      sf = nodes
        .filter((n) => n.level === 'sous-famille')
        .find(
          (n) =>
            n.code === decision.sousFamilleCode ||
            normalize(n.name) === normalize(decision.sousFamilleName),
        );
      if (sf) {
        const correctFamille = nodes.find(
          (n) => n.id === sf!.parentId && n.level === 'famille',
        );
        if (correctFamille) {
          famille = correctFamille;
          const correctRayon = nodes.find(
            (n) => n.id === correctFamille.parentId && n.level === 'rayon',
          );
          if (correctRayon) rayon = correctRayon;
        }
      }
    }
    if (!sf) {
      if (sousFamilles.length === 1) {
        sf = sousFamilles[0];
      } else {
        return null;
      }
    }

    const repaired: ExpertDecision = {
      sectorCode: decision.sectorCode,
      sectorName: sector.sectorName,
      rayonCode: rayon.code,
      rayonName: rayon.name,
      familleCode: famille.code,
      familleName: famille.name,
      sousFamilleCode: sf.code,
      sousFamilleName: sf.name,
      confidence: decision.confidence * 0.9,
      reason: `${decision.reason} [auto-repaired]`,
    };

    if (
      isValidPath(
        repaired.sectorCode,
        repaired.rayonCode,
        repaired.familleCode,
        repaired.sousFamilleCode,
      )
    ) {
      return repaired;
    }

    return null;
  } catch {
    return null;
  }
}

function pickBestDecision(decisions: ExpertDecision[]): {
  decision: ExpertDecision;
  source: ClassificationSource;
} {
  const validDecisions = decisions.filter((d) => validatePath(d));

  if (validDecisions.length === 0) {
    for (const d of decisions) {
      const repaired = tryRepairPath(d);
      if (repaired) {
        return { decision: repaired, source: 'validator' };
      }
    }
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
  const repaired = results.filter(
    (r) => r.source === 'validator' && r.status === 'classified',
  ).length;
  console.log(
    `[Cyrus V2] Validation complete: ${classified} classified, ${review} needs_review, ${repaired} auto-repaired, ${results.length} total`,
  );

  return results;
}
