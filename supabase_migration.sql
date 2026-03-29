-- STRIPE INTEGRATION MIGRATION
-- Run this in the Supabase SQL Editor

-- 1. Add payment columns to accreditations
ALTER TABLE accreditations 
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS stripe_session_id text,
ADD COLUMN IF NOT EXISTS payment_amount numeric(10,2);

-- 2. Ensure spectator_orders has consistent columns
ALTER TABLE spectator_orders 
ADD COLUMN IF NOT EXISTS stripe_session_id text;

-- 3. Update existing spectator_orders payment_id to stripe_session_id if they contain session IDs
-- UPDATE spectator_orders SET stripe_session_id = payment_id WHERE payment_id LIKE 'cs_%';

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accreditations_stripe_session ON accreditations(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_spectator_orders_stripe_session ON spectator_orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_spectator_orders_qr_code ON spectator_orders(qr_code_id);
