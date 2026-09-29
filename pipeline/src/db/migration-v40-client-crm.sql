-- Client-mode AI Reception: per-client calendar, caller classification, and a
-- per-client CRM (contacts → opportunities → events → follow-ups).
--
-- Why separate tables instead of reusing `leads`: `leads` is WebCrew's OWN sales
-- pipeline. A paying client's customers calling their receptionist must never be
-- written into it (they'd be picked up by WebCrew outreach/Sofia). Everything
-- here is scoped by reception_configs.id, i.e. by client.

-- ── Per-client calendar (Cal.com) ─────────────────────────────────────────────
ALTER TABLE reception_configs ADD COLUMN IF NOT EXISTS cal_api_key       TEXT;
ALTER TABLE reception_configs ADD COLUMN IF NOT EXISTS cal_event_type_id INT;
ALTER TABLE reception_configs ADD COLUMN IF NOT EXISTS timezone          TEXT;

-- ── Call classification (set by the classify_call tool) ───────────────────────
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS intent  TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS urgency TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS route   TEXT;

-- ── Contacts: one row per (client, caller phone) ──────────────────────────────
CREATE TABLE IF NOT EXISTS reception_contacts (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id      UUID        NOT NULL REFERENCES reception_configs(id) ON DELETE CASCADE,
  phone          TEXT,
  email          TEXT,
  name           TEXT,
  sms_consent    BOOLEAN     NOT NULL DEFAULT FALSE,
  sms_consent_at TIMESTAMPTZ,
  call_count     INT         NOT NULL DEFAULT 0,
  first_call_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_call_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS reception_contacts_config_phone_uniq
  ON reception_contacts (config_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS reception_contacts_config_idx ON reception_contacts (config_id, last_call_at DESC);

-- ── Opportunities: the pipeline card (stage lives here) ───────────────────────
-- stage: new | callback_requested | booked | cancelled | escalated | contacted | won | lost | spam
-- Voice moves a card through the first five; contacted/won/lost are owner-driven.
CREATE TABLE IF NOT EXISTS reception_opportunities (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id        UUID        NOT NULL REFERENCES reception_configs(id) ON DELETE CASCADE,
  contact_id       UUID        NOT NULL REFERENCES reception_contacts(id) ON DELETE CASCADE,
  title            TEXT,
  intent           TEXT,
  urgency          TEXT,
  stage            TEXT        NOT NULL DEFAULT 'new',
  notes            TEXT,
  source_call_sid  TEXT,
  booking_uid      TEXT,
  booking_start    TIMESTAMPTZ,
  stage_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reception_opps_config_stage_idx ON reception_opportunities (config_id, stage, created_at DESC);
CREATE INDEX IF NOT EXISTS reception_opps_contact_idx      ON reception_opportunities (contact_id, created_at DESC);

-- ── Timeline ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reception_events (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id      UUID        NOT NULL REFERENCES reception_configs(id) ON DELETE CASCADE,
  contact_id     UUID        REFERENCES reception_contacts(id) ON DELETE CASCADE,
  opportunity_id UUID        REFERENCES reception_opportunities(id) ON DELETE CASCADE,
  event_type     TEXT        NOT NULL,
  detail         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reception_events_contact_idx ON reception_events (contact_id, created_at DESC);

-- ── Follow-up queue (drained by scripts/reception-follow-ups.ts) ──────────────
-- kind: appointment_reminder (to the caller) | callback_nudge (to the business owner)
-- status: pending | sent | skipped | failed
CREATE TABLE IF NOT EXISTS reception_follow_ups (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id      UUID        NOT NULL REFERENCES reception_configs(id) ON DELETE CASCADE,
  contact_id     UUID        REFERENCES reception_contacts(id) ON DELETE CASCADE,
  opportunity_id UUID        REFERENCES reception_opportunities(id) ON DELETE CASCADE,
  kind           TEXT        NOT NULL,
  due_at         TIMESTAMPTZ NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending',
  attempts       INT         NOT NULL DEFAULT 0,
  last_error     TEXT,
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reception_follow_ups_due_idx ON reception_follow_ups (due_at) WHERE status = 'pending';

SELECT 'Migration v40 (client CRM) complete.' AS result;
