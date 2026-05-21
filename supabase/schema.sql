-- ============================================================
-- LichenAI Knowledge Library — Supabase Schema
-- Run this in the Supabase SQL editor (Settings → SQL Editor)
-- Requires the pgvector extension (enabled by default on Supabase)
-- ============================================================

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Core tables
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url                 TEXT,
    file_path           TEXT,
    title               TEXT,
    summary             TEXT,
    tension             TEXT,
    relevance_score     INTEGER CHECK (relevance_score BETWEEN 1 AND 10),
    relevance_reason    TEXT,
    next_steps          JSONB,
    auto_questions      JSONB,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'done', 'error')),
    -- set when a document is added via the "Explore More" feature (Phase 5)
    source_document_id  UUID REFERENCES documents(id) ON DELETE SET NULL,
    uploaded_by         TEXT NOT NULL,
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    raw_content         TEXT,
    embedding           vector(1536)
);

CREATE TABLE IF NOT EXISTS categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('topic', 'use_case')),
    created_by  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name, type)
);

-- Junction table linking documents to their categories/tags
CREATE TABLE IF NOT EXISTS document_categories (
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, category_id)
);

CREATE TABLE IF NOT EXISTS notes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    added_by    TEXT NOT NULL,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_question BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================
-- Indexes
-- ============================================================

-- IVFFlat index for approximate nearest-neighbour search (Phase 4)
-- Adjust `lists` once the document count is known (~sqrt(row_count))
CREATE INDEX IF NOT EXISTS documents_embedding_idx
    ON documents USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS documents_status_idx       ON documents (status);
CREATE INDEX IF NOT EXISTS documents_uploaded_at_idx  ON documents (uploaded_at DESC);
CREATE INDEX IF NOT EXISTS documents_score_idx        ON documents (relevance_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS notes_document_id_idx      ON notes (document_id, added_at);

-- ============================================================
-- Helper functions
-- ============================================================

-- The Python supabase client sends embeddings as plain text (pgvector string format).
-- This RPC wrapper handles the explicit cast so the REST layer doesn't need to.
CREATE OR REPLACE FUNCTION update_document_embedding(p_doc_id UUID, p_embedding TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE documents
    SET    embedding = p_embedding::vector
    WHERE  id = p_doc_id;
END;
$$;

-- Vector similarity search used by the /query endpoint (Phase 4)
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_count     INT DEFAULT 5
)
RETURNS TABLE (
    id              UUID,
    title           TEXT,
    summary         TEXT,
    url             TEXT,
    raw_content     TEXT,
    relevance_score INTEGER,
    similarity      FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.title,
        d.summary,
        d.url,
        d.raw_content,
        d.relevance_score,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM   documents d
    WHERE  d.embedding IS NOT NULL
      AND  d.status = 'done'
    ORDER  BY d.embedding <=> query_embedding
    LIMIT  match_count;
END;
$$;

-- ============================================================
-- Seed data — default topic categories and use-case tags
-- ============================================================

INSERT INTO categories (name, type, created_by) VALUES
    ('Evals & measurement',          'topic',    'system'),
    ('AI adoption & org change',     'topic',    'system'),
    ('Mapping problem & discovery',  'topic',    'system'),
    ('Tacit knowledge & work capture','topic',   'system'),
    ('Playbook & methodology',       'topic',    'system'),
    ('Co-design & worker voice',     'topic',    'system'),
    ('Data flywheel & moat',         'topic',    'system'),
    ('RAG & retrieval',              'topic',    'system'),
    ('LLM tooling & infrastructure', 'topic',    'system'),
    ('Research & evidence base',     'topic',    'system'),
    ('Consultant pitch',             'use_case', 'system'),
    ('Investor narrative',           'use_case', 'system'),
    ('Evals evidence',               'use_case', 'system'),
    ('Onboarding',                   'use_case', 'system'),
    ('Competitive intelligence',     'use_case', 'system'),
    ('Product decision',             'use_case', 'system')
ON CONFLICT (name, type) DO NOTHING;
