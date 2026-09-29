-- Migration v10: integration connection state for public launch
-- Idempotent — safe to re-run

CREATE TABLE IF NOT EXISTS integration_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        text NOT NULL,
  status          text NOT NULL DEFAULT 'not_connected',
  account_label   text,
  scopes          text[] NOT NULL DEFAULT '{}',
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider)
);

CREATE TABLE IF NOT EXISTS oauth_states (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        text NOT NULL,
  state           text NOT NULL UNIQUE,
  redirect_to     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '15 minutes'
);

CREATE INDEX IF NOT EXISTS oauth_states_state_idx ON oauth_states (state);
CREATE INDEX IF NOT EXISTS integration_connections_provider_idx ON integration_connections (provider, status);

SELECT 'Migration v10 integrations complete.' AS result;
