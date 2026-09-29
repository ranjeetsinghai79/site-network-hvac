-- migration-v12-scraped-combos.sql
-- Tracks which city×niche combos have been scraped and whether exhausted.
-- Enables combo-level skip: scraper skips exhausted combos entirely.

-- Add niche column to scraped_places for future precision
ALTER TABLE scraped_places ADD COLUMN IF NOT EXISTS niche TEXT;

-- Combo tracking table
CREATE TABLE IF NOT EXISTS scraped_combos (
  id          SERIAL PRIMARY KEY,
  tab         TEXT        NOT NULL,
  niche       TEXT        NOT NULL,
  city        TEXT        NOT NULL,
  state       TEXT        NOT NULL,
  count_found INTEGER     NOT NULL DEFAULT 0,
  exhausted   BOOLEAN     NOT NULL DEFAULT FALSE,
  scraped_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tab, niche, city)
);

CREATE INDEX IF NOT EXISTS idx_scraped_combos_tab_exhausted ON scraped_combos (tab, exhausted);

-- Pre-seed exhausted combos for single-niche tabs from existing scraped_places data.
-- A city with >= 50 results in a single-niche tab = exhausted (60 max from Maps).
INSERT INTO scraped_combos (tab, niche, city, state, count_found, exhausted)
SELECT
  sp.tab,
  CASE sp.tab
    WHEN 'MEDSPAS'          THEN 'medspa-usa'
    WHEN 'USA_DentalOffices' THEN 'dental-office'
    WHEN 'USA_Restaurants'   THEN 'restaurant'
    WHEN 'USA_BarberShops'   THEN 'barbershop'
    WHEN 'USA_LawFirms'      THEN 'lawfirm'
    WHEN 'USA_NailStudios'   THEN 'nail-studio'
    WHEN 'USA_SkinClinics'   THEN 'skin-clinic'
    WHEN 'USA_IVTherapy'     THEN 'iv-therapy'
    WHEN 'USA_RealEstateAgents' THEN 'real-estate-agent'
    WHEN 'INDIA_MEDSPAS'     THEN 'india-medspa'
    WHEN 'INDIA_DentalOffices' THEN 'india-dental'
    WHEN 'India_Restaurants'  THEN 'india-restaurant'
    ELSE NULL
  END AS niche,
  sp.city,
  'unknown' AS state,
  COUNT(*)::INTEGER AS count_found,
  COUNT(*) >= 50 AS exhausted
FROM scraped_places sp
WHERE sp.tab IN (
  'MEDSPAS','USA_DentalOffices','USA_Restaurants','USA_BarberShops',
  'USA_LawFirms','USA_NailStudios','USA_SkinClinics','USA_IVTherapy',
  'USA_RealEstateAgents','INDIA_MEDSPAS','INDIA_DentalOffices','India_Restaurants'
)
GROUP BY sp.tab, sp.city
HAVING CASE sp.tab
    WHEN 'MEDSPAS'          THEN 'medspa-usa'
    WHEN 'USA_DentalOffices' THEN 'dental-office'
    WHEN 'USA_Restaurants'   THEN 'restaurant'
    WHEN 'USA_BarberShops'   THEN 'barbershop'
    WHEN 'USA_LawFirms'      THEN 'lawfirm'
    WHEN 'USA_NailStudios'   THEN 'nail-studio'
    WHEN 'USA_SkinClinics'   THEN 'skin-clinic'
    WHEN 'USA_IVTherapy'     THEN 'iv-therapy'
    WHEN 'USA_RealEstateAgents' THEN 'real-estate-agent'
    WHEN 'INDIA_MEDSPAS'     THEN 'india-medspa'
    WHEN 'INDIA_DentalOffices' THEN 'india-dental'
    WHEN 'India_Restaurants'  THEN 'india-restaurant'
    ELSE NULL
  END IS NOT NULL
ON CONFLICT (tab, niche, city) DO NOTHING;
