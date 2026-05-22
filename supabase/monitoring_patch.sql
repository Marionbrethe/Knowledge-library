-- Monitoring patch: run in Supabase SQL editor before using the Monitoring tab.

CREATE TABLE IF NOT EXISTS monitored_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  url             TEXT NOT NULL UNIQUE,
  added_by        TEXT NOT NULL DEFAULT 'team',
  added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS source_articles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id    UUID NOT NULL REFERENCES monitored_sources(id) ON DELETE CASCADE,
  title        TEXT,
  url          TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  found_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  document_id  UUID REFERENCES documents(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS source_articles_url_idx ON source_articles(url);
