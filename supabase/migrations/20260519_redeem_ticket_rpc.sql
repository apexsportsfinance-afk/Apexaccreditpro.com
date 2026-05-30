-- Migration: Add transaction-safe ticket redemption RPC
-- Description: Redeems a single ticket and updates the corresponding order's scanned count atomically.

CREATE OR REPLACE FUNCTION redeem_ticket_transaction(
  p_ticket_id UUID,
  p_order_id UUID,
  p_today_date TEXT
) RETURNS JSONB AS $$
DECLARE
  v_scanned_count INT;
  v_current_status TEXT;
  v_valid_date TEXT;
  v_result JSONB;
BEGIN
  -- 1. Lock the ticket row to prevent race conditions
  SELECT status, valid_date INTO v_current_status, v_valid_date 
  FROM spectator_tickets 
  WHERE id = p_ticket_id 
  FOR UPDATE;

  -- 2. Validate ticket exists and its status
  IF v_current_status = 'scanned' AND v_valid_date = p_today_date THEN
    RAISE EXCEPTION 'ALREADY_SCANNED';
  END IF;

  -- 3. Perform scan update on the ticket
  UPDATE spectator_tickets 
  SET status = 'scanned', scanned_at = NOW() 
  WHERE id = p_ticket_id;

  -- 4. Calculate fresh total scanned count under this order
  SELECT COUNT(id) INTO v_scanned_count 
  FROM spectator_tickets 
  WHERE order_id = p_order_id AND status = 'scanned';

  -- 5. Atomic update to spectator_orders table
  UPDATE spectator_orders 
  SET scanned_count = v_scanned_count, last_scan_at = NOW()
  WHERE id = p_order_id;

  -- 6. Retrieve and return the updated order
  SELECT row_to_json(so)::jsonb INTO v_result 
  FROM spectator_orders so 
  WHERE id = p_order_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
