-- migration-v13-dedup-phone.sql
-- Prevent duplicate leads for the same business phone number.
-- Same business scraped from multiple search results gets different place_id
-- hashes (scraped_XXXXX) → bypasses ON CONFLICT (place_id) → creates duplicates.

-- Step 1: Remove duplicate rows keeping the most-advanced-status lead per phone.
-- Status priority order (highest = keep).
DELETE FROM leads
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY phone
        ORDER BY
          CASE status
            WHEN 'paid'               THEN 1
            WHEN 'handed_off'         THEN 2
            WHEN 'payment_link_sent'  THEN 3
            WHEN 'meeting_scheduled'  THEN 4
            WHEN 'conversation_active' THEN 5
            WHEN 'sms_sent'           THEN 6
            WHEN 'outreach_sent'      THEN 7
            WHEN 'deployed'           THEN 8
            WHEN 'built'              THEN 9
            WHEN 'config_generated'   THEN 10
            WHEN 'analyzed'           THEN 11
            ELSE 12
          END,
          created_at ASC
      ) AS rn
    FROM leads
    WHERE phone IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- Step 2: Add partial unique index on phone (NULLs excluded — NULL ≠ NULL in PG).
-- This prevents future duplicates at the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_unique
  ON leads (phone)
  WHERE phone IS NOT NULL;
