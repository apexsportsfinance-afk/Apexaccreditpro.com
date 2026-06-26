-- Call Room Heat Display Control
-- -----------------------------------------------------------------------------
-- A self-contained, additive feature: drives the call-room display screens.
-- It touches NO existing tables. The marshal (an authenticated admin) builds a
-- PII-free ordered heat list from lane_matrix and stores a snapshot here, plus a
-- single "position" pointer. Each display screen subscribes via Supabase
-- Realtime and renders heat_list[position + screen_offset], so one write fans
-- out to every screen instantly.
--
-- Why store a snapshot instead of letting screens read lane_matrix directly:
--   - Display URLs are PUBLIC (no login). lane_matrix holds athlete PII (names,
--     clubs). The snapshot contains only event_code / event_name / gender / heat
--     — nothing personal — so anon screens never touch PII.
--   - It also freezes the call order at "Start Event" time.

CREATE TABLE IF NOT EXISTS public.call_room_state (
  event_id    TEXT        PRIMARY KEY,            -- events.id (kept TEXT to match how eventId flows through the app / lane_matrix.meet_id)
  event_name  TEXT,                               -- denormalised label for the marshal/screens
  position    INTEGER     NOT NULL DEFAULT 0,     -- 0-based index into heat_list = the "current" heat (Screen A)
  started     BOOLEAN     NOT NULL DEFAULT false, -- false until the marshal presses Start Event
  heat_list   JSONB       NOT NULL DEFAULT '[]',  -- [{ eventCode, eventName, gender, heat }] ordered by session/event/heat
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT                                -- marshal email (audit breadcrumb)
);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.call_room_state ENABLE ROW LEVEL SECURITY;

-- Display screens read with the anon key. The snapshot is PII-free sporting
-- metadata, so public SELECT is acceptable and required for Realtime delivery.
DROP POLICY IF EXISTS "crs_read_public" ON public.call_room_state;
CREATE POLICY "crs_read_public" ON public.call_room_state
  FOR SELECT USING (true);

-- Only admins (the marshal) may start/advance/edit the call room.
DROP POLICY IF EXISTS "crs_write_admin" ON public.call_room_state;
CREATE POLICY "crs_write_admin" ON public.call_room_state
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin','media_admin','admin')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin','media_admin','admin')
  );

-- -----------------------------------------------------------------------------
-- Realtime: stream changes to subscribed display screens.
-- -----------------------------------------------------------------------------
-- REPLICA IDENTITY FULL guarantees the full row is present in change payloads
-- even when only `position` changes.
ALTER TABLE public.call_room_state REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'call_room_state'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.call_room_state;
    END IF;
  END IF;
END $$;
