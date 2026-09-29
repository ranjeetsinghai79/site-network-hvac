CREATE TABLE IF NOT EXISTS reception_email_verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL,
  call_sid    text NOT NULL,
  config_id   uuid REFERENCES reception_configs(id) ON DELETE CASCADE,
  email       text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','expired')),
  expires_at  timestamptz NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  verified_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS reception_email_verification_active_phone_idx
  ON reception_email_verifications (phone) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS reception_email_verification_call_idx
  ON reception_email_verifications (call_sid, created_at DESC);
