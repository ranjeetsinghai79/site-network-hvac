-- Affiliate program: applications, referral codes, and per-invoice commission
-- ledger. 30% recurring commission on the $297/mo plan, lifetime of the
-- subscription — accrued at the Stripe `invoice.payment_succeeded` webhook
-- (admin/src/app/api/stripe/webhook/route.ts), paid out manually.

CREATE TABLE IF NOT EXISTS affiliates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  promotion_plan TEXT,
  website_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  referral_code TEXT UNIQUE,               -- assigned manually on approval
  payout_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS referral_commissions (
  id SERIAL PRIMARY KEY,
  affiliate_id INTEGER NOT NULL REFERENCES affiliates(id),
  lead_id UUID NOT NULL REFERENCES leads(id),
  stripe_invoice_id TEXT,                  -- dedupe key across recurring cycles / webhook retries
  commission_amount NUMERIC NOT NULL,
  commission_pct NUMERIC NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | paid
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  UNIQUE (affiliate_id, stripe_invoice_id)
);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS referred_by TEXT;
