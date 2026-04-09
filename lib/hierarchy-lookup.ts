import 'server-only';
import {
  findSimilarHierarchyNodes,
  type HierarchySearchResult,
} from '@/lib/db/hierarchy';

export interface RAGContext {
  query: string;
  candidates: HierarchySearchResult[];
  contextText: string;
}

export function extractProductsFromMessage(message: string): string[] {
  const lines = message
    .split(/[\n,;]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && l.length < 200)
    .filter(
      (l) =>
        !l.startsWith('#') &&
        !l.startsWith('-') &&
        !/^(classe|classer|voici|liste)/i.test(l),
    );

  return [...new Set(lines)];
}

export function buildRAGContextText(
  ragResults: Map<string, HierarchySearchResult[]>,
): string {
  if (ragResults.size === 0) return '';

  let context =
    '\n\n---\n## CATÉGORIES CANDIDATES RAG (Base de référence officielle)\n';
  context +=
    'Pour chaque article, utilise UNIQUEMENT les catégories candidates suivantes :\n\n';

  for (const [product, candidates] of ragResults.entries()) {
    context += `**Article : "${product}"**\n`;
    candidates.forEach((c, i) => {
      const n = c.node;
      context += `  ${i + 1}. [${(c.similarity * 100).toFixed(0)}%] `;
      context += `Secteur: ${n.sectorCode} ${n.sectorName}`;
      if (n.rayonCode) context += ` | Rayon: ${n.rayonCode} ${n.rayonName}`;
      if (n.familleCode)
        context += ` | Famille: ${n.familleCode} ${n.familleName}`;
      if (n.sousFamilleCode)
        context += ` | Sous-fam: ${n.sousFamilleCode} ${n.sousFamilleName}`;
      context += '\n';
    });
    context += '\n';
  }

  return context;
}

export async function getRAGContextForMessage(
  userMessage: string,
): Promise<string> {
  try {
    const products = extractProductsFromMessage(userMessage);

    if (products.length === 0) return '';

    const productsToProcess = products.slice(0, 50);

    const ragResults = new Map<string, HierarchySearchResult[]>();

    await Promise.all(
      productsToProcess.map(async (product) => {
        const candidates = await findSimilarHierarchyNodes(product, 7, 0.45);
        if (candidates.length > 0) {
          ragResults.set(product, candidates);
        }
      }),
    );

    return buildRAGContextText(ragResults);
  } catch (error) {
    console.error('[RAG] Failed to fetch hierarchy context:', error);
    return '';
  }
}
