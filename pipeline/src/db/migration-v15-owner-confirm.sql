-- migration-v15-owner-confirm.sql
-- Attendance confirmation loop for in-person appointments.
-- Business owner replies YES/NO before review request is sent to customer.
--
-- Run: psql $DATABASE_URL -f pipeline/src/db/migration-v15-owner-confirm.sql

ALTER TABLE cal_bookings ADD COLUMN IF NOT EXISTS business_owner_phone TEXT;
ALTER TABLE cal_bookings ADD COLUMN IF NOT EXISTS host_confirm_sent_at TIMESTAMPTZ;
ALTER TABLE cal_bookings ADD COLUMN IF NOT EXISTS host_confirmed BOOLEAN;
ALTER TABLE cal_bookings ADD COLUMN IF NOT EXISTS host_confirmed_at TIMESTAMPTZ;

-- Index for fast SMS reply routing (check if inbound number is a business owner)
CREATE INDEX IF NOT EXISTS idx_cal_bookings_owner_phone
  ON cal_bookings(business_owner_phone)
  WHERE business_owner_phone IS NOT NULL;

-- Index for send-review-requests.ts Step 1 query
CREATE INDEX IF NOT EXISTS idx_cal_bookings_pending_confirm
  ON cal_bookings(end_time, status, host_confirm_sent_at)
  WHERE host_confirm_sent_at IS NULL AND status = 'confirmed';
