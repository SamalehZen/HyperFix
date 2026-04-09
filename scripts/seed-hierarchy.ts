import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateText } from 'ai';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { generateId } from 'ai';
import {
  parseHierarchy,
  type RawHierarchyNode,
} from '../lib/hierarchy-parser';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}

const GOOGLE_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!GOOGLE_API_KEY) {
  console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const embeddingModel = genAI.getGenerativeModel({
  model: 'text-embedding-004',
});

async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

const hierarchyText = readFileSync(
  resolve(__dirname, '../data/store-hierarchy.txt'),
  'utf-8',
);

function enrichNodeSimple(node: RawHierarchyNode): string {
  return node.fullPath;
}

async function main() {
  console.log('🌱 Starting hierarchy seeding...');

  const nodes = parseHierarchy(hierarchyText);
  console.log(`📊 Found ${nodes.length} nodes to process`);

  await db.execute(sql`DELETE FROM hierarchy_node`);
  console.log('🗑️  Cleared existing hierarchy nodes');

  let processed = 0;
  const batchSize = 20;

  for (let i = 0; i < nodes.length; i += batchSize) {
    const batch = nodes.slice(i, i + batchSize);

    const records = await Promise.all(
      batch.map(async (node) => {
        const enrichedText = enrichNodeSimple(node);
        const embedding = await generateEmbedding(enrichedText);
        return {
          id: generateId(),
          sectorCode: node.sectorCode,
          sectorName: node.sectorName,
          rayonCode: node.rayonCode ?? null,
          rayonName: node.rayonName ?? null,
          familleCode: node.familleCode ?? null,
          familleName: node.familleName ?? null,
          sousFamilleCode: node.sousFamilleCode ?? null,
          sousFamilleName: node.sousFamilleName ?? null,
          level: node.level,
          fullPath: node.fullPath,
          enrichedText,
          embedding: `[${embedding.join(',')}]`,
        };
      }),
    );

    for (const record of records) {
      await db.execute(sql`
        INSERT INTO hierarchy_node (
          id, sector_code, sector_name, rayon_code, rayon_name,
          famille_code, famille_name, sous_famille_code, sous_famille_name,
          level, full_path, enriched_text, embedding
        ) VALUES (
          ${record.id}, ${record.sectorCode}, ${record.sectorName},
          ${record.rayonCode}, ${record.rayonName},
          ${record.familleCode}, ${record.familleName},
          ${record.sousFamilleCode}, ${record.sousFamilleName},
          ${record.level}, ${record.fullPath}, ${record.enrichedText},
          ${record.embedding}::vector
        )
      `);
    }

    processed += batch.length;
    console.log(`✅ Processed ${processed}/${nodes.length} nodes`);

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log(`🎉 Seeding complete! ${processed} nodes indexed.`);
}

main().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
