-- Enable pgvector extension (Neon supports this natively)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create hierarchy_node table for RAG-based classification
CREATE TABLE IF NOT EXISTS "hierarchy_node" (
  "id" text PRIMARY KEY,
  "sector_code" varchar(10) NOT NULL,
  "sector_name" text NOT NULL,
  "rayon_code" varchar(10),
  "rayon_name" text,
  "famille_code" varchar(10),
  "famille_name" text,
  "sous_famille_code" varchar(10),
  "sous_famille_name" text,
  "level" integer NOT NULL, -- 1=sector, 2=rayon, 3=famille, 4=sous_famille
  "full_path" text NOT NULL, -- e.g. "MARCHE > BOUCHERIE > STAND TRADITIONNEL > BOEUF LOCAL"
  "enriched_text" text NOT NULL, -- Description used for embedding
  "embedding" vector(768), -- Gemini text-embedding-004 dimensions
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- HNSW index for cosine similarity search
CREATE INDEX IF NOT EXISTS "hierarchy_node_embedding_idx"
  ON "hierarchy_node" USING hnsw ("embedding" vector_cosine_ops);

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS "hierarchy_node_level_idx" ON "hierarchy_node" ("level");
CREATE INDEX IF NOT EXISTS "hierarchy_node_sector_idx" ON "hierarchy_node" ("sector_code");
