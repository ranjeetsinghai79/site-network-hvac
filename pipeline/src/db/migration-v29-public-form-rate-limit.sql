-- Per-IP rate limiting for the public, unauthenticated Cloudflare Worker
-- endpoints (POST /leads, POST /audit at api.webcrew.app). Both accept
-- attacker-controlled fields (businessOwnerPhone triggers a real SMS send
-- with no consent gate; websiteUrl triggers real PageSpeed/Firecrawl calls)
-- with no prior throttle — this closes that gap. Used by api/src/index.ts.
CREATE TABLE IF NOT EXISTS public_form_submissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address  text NOT NULL,
  endpoint    text NOT NULL,        -- 'leads' | 'audit'
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS public_form_submissions_ip_idx
  ON public_form_submissions (ip_address, created_at);
