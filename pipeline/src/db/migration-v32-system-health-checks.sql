-- Historical record of scheduled system health checks (health-check.ts).
-- Each run's findings get stored here, not just emailed — gives a trend line
-- to actually learn from ("has this check been flaky before?") instead of
-- every run starting from zero context.
CREATE TABLE IF NOT EXISTS system_health_checks (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  run_at       TIMESTAMPTZ DEFAULT NOW(),
  overall_ok   BOOLEAN     NOT NULL,
  issues_found INTEGER     NOT NULL DEFAULT 0,
  auto_healed  INTEGER     NOT NULL DEFAULT 0,
  checks       JSONB       NOT NULL   -- array of {name, ok, detail, healed?}
);

CREATE INDEX IF NOT EXISTS system_health_checks_run_at_idx ON system_health_checks (run_at);
