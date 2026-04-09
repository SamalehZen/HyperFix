import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from './index';
import { type HierarchyNode } from './schema';
import { generateEmbedding } from '@/lib/embeddings';

export interface HierarchySearchResult {
  node: HierarchyNode;
  similarity: number;
}

export async function findSimilarHierarchyNodes(
  query: string,
  k: number = 8,
  minSimilarity: number = 0.45,
): Promise<HierarchySearchResult[]> {
  const queryEmbedding = await generateEmbedding(query);
  const embeddingStr = `[${queryEmbedding.join(',')}]`;

  const results = await db.execute(sql`
    SELECT
      *,
      1 - (embedding <=> ${embeddingStr}::vector) AS similarity
    FROM hierarchy_node
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> ${embeddingStr}::vector) > ${minSimilarity}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${k}
  `);

  return (results.rows as any[]).map((row) => ({
    node: {
      id: row.id,
      sectorCode: row.sector_code,
      sectorName: row.sector_name,
      rayonCode: row.rayon_code,
      rayonName: row.rayon_name,
      familleCode: row.famille_code,
      familleName: row.famille_name,
      sousFamilleCode: row.sous_famille_code,
      sousFamilleName: row.sous_famille_name,
      level: row.level,
      fullPath: row.full_path,
      enrichedText: row.enriched_text,
      embedding: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    } as HierarchyNode,
    similarity: parseFloat(row.similarity),
  }));
}

export async function getHierarchyNodeCount(): Promise<number> {
  const result = await db.execute(
    sql`SELECT COUNT(*) as count FROM hierarchy_node`,
  );
  return parseInt((result.rows[0] as any).count);
}
