import * as fs from 'fs';
import * as path from 'path';
import type {
  TaxonomyNode,
  CandidateNode,
  AliasEntry,
  AliasStore,
  MasterTaxonomy,
} from '@/lib/cyrus/types';
import { RETRIEVAL_TOP_N } from '@/lib/cyrus/constants';
import { loadMasterTaxonomy, getFullPath } from '@/lib/cyrus/taxonomy';

interface TokenizedNode {
  node: TaxonomyNode;
  nameTokens: string[];
  ancestorTokens: string[];
  sectorCode: string;
  pathNames: string[];
  level: number;
}

interface TokenizedAlias {
  term: string;
  termTokens: string[];
  targets: string[];
  weight: number;
}

let searchIndex: Map<string, TokenizedNode> | null = null;
let aliasIndex: TokenizedAlias[] | null = null;
let nodesBySectorCode: Map<string, string[]> | null = null;

function tokenize(text: string): string[] {
  return text
    .toUpperCase()
    .split(/[\s\-\/]+/)
    .filter((t) => t.length > 0);
}

function extractSectorCode(node: TaxonomyNode, master: MasterTaxonomy): string {
  const fullPath = getFullPath(node.id);
  const sector = fullPath.find((n) => n.level === 'sector');
  return sector?.code ?? '';
}

function loadAliases(): AliasEntry[] {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'data', 'cyrus', 'aliases.json'),
      'utf-8',
    );
    const store = JSON.parse(raw) as AliasStore;
    return store.aliases;
  } catch {
    return [];
  }
}

export function buildSearchIndex(): void {
  const master = loadMasterTaxonomy();
  searchIndex = new Map();
  aliasIndex = [];
  nodesBySectorCode = new Map();

  const nodeById = new Map<string, TaxonomyNode>();
  for (const node of master.nodes) {
    nodeById.set(node.id, node);
  }

  for (const node of master.nodes) {
    const nameTokens = tokenize(node.name);

    const ancestorTokens: string[] = [];
    const pathNames: string[] = [];
    let current: TaxonomyNode | undefined = node.parentId
      ? nodeById.get(node.parentId)
      : undefined;
    let sectorCode = '';
    let depth = 0;

    while (current) {
      ancestorTokens.push(...tokenize(current.name));
      pathNames.unshift(current.name);
      if (current.level === 'sector') {
        sectorCode = current.code;
      }
      current = current.parentId ? nodeById.get(current.parentId) : undefined;
      depth++;
    }

    if (node.level === 'sector') {
      sectorCode = node.code;
    }

    pathNames.push(node.name);

    const levelDepth: Record<string, number> = {
      sector: 0,
      rayon: 1,
      famille: 2,
      'sous-famille': 3,
    };

    const entry: TokenizedNode = {
      node,
      nameTokens,
      ancestorTokens,
      sectorCode,
      pathNames,
      level: levelDepth[node.level] ?? 0,
    };

    searchIndex.set(node.id, entry);

    if (sectorCode) {
      const existing = nodesBySectorCode.get(sectorCode) ?? [];
      existing.push(node.id);
      nodesBySectorCode.set(sectorCode, existing);
    }
  }

  const aliases = loadAliases();
  for (const alias of aliases) {
    aliasIndex.push({
      term: alias.term.toUpperCase(),
      termTokens: tokenize(alias.term),
      targets: alias.targets,
      weight: alias.weight,
    });
  }

  console.log(
    `[Cyrus V2] Search index built: ${searchIndex.size} nodes, ${aliasIndex.length} aliases`,
  );
}

function ensureIndex(): void {
  if (!searchIndex) {
    buildSearchIndex();
  }
}

export function retrieveCandidates(
  normalizedLabel: string,
  topN: number = RETRIEVAL_TOP_N,
): CandidateNode[] {
  ensureIndex();

  const labelTokens = tokenize(normalizedLabel);
  const labelUpper = normalizedLabel.toUpperCase();
  const scores = new Map<string, { score: number; reasons: string[] }>();

  for (const [nodeId, entry] of searchIndex!) {
    let score = 0;
    const reasons: string[] = [];

    const nameUpper = entry.node.name.toUpperCase();
    if (nameUpper === labelUpper) {
      score += 10;
      reasons.push('exact_name_match');
    }

    for (const token of labelTokens) {
      if (entry.nameTokens.includes(token)) {
        score += 3;
        reasons.push(`token_in_name:${token}`);
      }
      if (entry.ancestorTokens.includes(token)) {
        score += 1;
        reasons.push(`token_in_ancestor:${token}`);
      }
    }

    for (const alias of aliasIndex!) {
      if (alias.targets.some((t) => t === nodeId || nodeId.startsWith(t))) {
        if (labelUpper === alias.term) {
          score += 5 * alias.weight;
          reasons.push(`exact_alias:${alias.term}`);
        } else {
          let partialMatch = false;
          for (const aliasToken of alias.termTokens) {
            if (labelTokens.includes(aliasToken)) {
              partialMatch = true;
              break;
            }
          }
          if (partialMatch) {
            score += 2 * alias.weight;
            reasons.push(`partial_alias:${alias.term}`);
          }
        }
      }
    }

    if (entry.level === 3) {
      score += 0.5;
    } else if (entry.level === 2) {
      score += 0.25;
    }

    if (score > 0) {
      scores.set(nodeId, { score, reasons });
    }
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  const topEntries = sorted.slice(0, topN);

  return topEntries.map(([nodeId, { score, reasons }]) => {
    const entry = searchIndex!.get(nodeId)!;
    const maxScore = Math.max(
      10 + labelTokens.length * 3 + 5,
      1,
    );
    return {
      nodeId,
      sectorCode: entry.sectorCode,
      path: entry.pathNames,
      score: Math.min(score / maxScore, 1),
      reasons: [...new Set(reasons)],
    };
  });
}
