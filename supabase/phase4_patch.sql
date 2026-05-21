-- Phase 4 patch: run this in the Supabase SQL editor before using the /query endpoint.
-- It adds a text-accepting wrapper around the vector search so supabase-py can call it
-- without needing native pgvector type support in the client.

CREATE OR REPLACE FUNCTION match_documents_by_text(
    query_embedding text,
    match_count     int DEFAULT 5
)
RETURNS TABLE (
    id              uuid,
    title           text,
    summary         text,
    url             text,
    raw_content     text,
    relevance_score integer,
    similarity      float
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
        1 - (d.embedding <=> query_embedding::vector) AS similarity
    FROM   documents d
    WHERE  d.embedding IS NOT NULL
      AND  d.status = 'done'
    ORDER  BY d.embedding <=> query_embedding::vector
    LIMIT  match_count;
END;
$$;
