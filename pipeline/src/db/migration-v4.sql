-- Migration v4: business_knowledge table (AI knowledge base per scraped business)
-- Run once: psql $DATABASE_URL -f pipeline/src/db/migration-v4.sql
-- Safe: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS — idempotent

CREATE TABLE IF NOT EXISTS business_knowledge (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          uuid        REFERENCES leads(id) ON DELETE CASCADE,
  website_url      text        NOT NULL,
  scraped_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),

  -- Firecrawl raw output
  raw_pages        jsonb,      -- [{url, markdown, html, metadata}]
  sitemap_urls     jsonb,      -- string[]
  page_count       integer,

  -- Extracted assets
  image_urls       jsonb,      -- string[]
  video_urls       jsonb,      -- string[]
  form_fields      jsonb,      -- [{action, method, fields:[{name,type,label}]}]
  internal_links   jsonb,      -- string[]
  external_links   jsonb,      -- string[]

  -- Contact info (extracted across all pages)
  phone_numbers    jsonb,      -- string[]
  email_addresses  jsonb,      -- string[]
  addresses        jsonb,      -- string[]

  -- Brand signals
  brand_colors     jsonb,      -- string[] hex codes
  brand_fonts      jsonb,      -- string[] font names

  -- Content per section
  services_text    text,
  about_text       text,
  homepage_text    text,

  -- AI-generated (Gemini)
  business_summary text,
  brand_voice      text,
  niche_detected   text,

  UNIQUE (website_url)
);

CREATE INDEX IF NOT EXISTS bk_lead_idx    ON business_knowledge (lead_id);
CREATE INDEX IF NOT EXISTS bk_url_idx     ON business_knowledge (website_url);
CREATE INDEX IF NOT EXISTS bk_scraped_idx ON business_knowledge (scraped_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_bk_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS bk_updated_at ON business_knowledge;
CREATE TRIGGER bk_updated_at
  BEFORE UPDATE ON business_knowledge
  FOR EACH ROW EXECUTE FUNCTION set_bk_updated_at();

SELECT 'Migration v4 complete: business_knowledge table ready.' AS result;
