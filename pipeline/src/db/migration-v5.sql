-- Migration v5: Stripe subscription fields for recurring billing
-- Idempotent — safe to re-run

ALTER TABLE leads ADD COLUMN IF NOT EXISTS stripe_customer_id    text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS subscription_active    boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS subscription_plan      text;  -- 'reception' | 'growth'

CREATE INDEX IF NOT EXISTS leads_subscription_active_idx ON leads (subscription_active) WHERE subscription_active = TRUE;
CREATE INDEX IF NOT EXISTS leads_stripe_customer_idx     ON leads (stripe_customer_id)  WHERE stripe_customer_id IS NOT NULL;

SELECT 'Migration v5 complete.' AS result;
