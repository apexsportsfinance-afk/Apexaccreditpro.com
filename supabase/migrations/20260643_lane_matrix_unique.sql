-- lane_matrix: ensure table exists with the correct schema and add the unique
-- constraint that HeatSheetMatrixAPI.upsertMatrix() relies on for deduplication.
-- Without this constraint, re-uploading a heat sheet inserts duplicate rows
-- instead of updating existing ones.

CREATE TABLE IF NOT EXISTS public.lane_matrix (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  meet_id       TEXT        NOT NULL,
  event_code    TEXT        NOT NULL DEFAULT '',
  event_name    TEXT,
  athlete_name  TEXT        NOT NULL DEFAULT 'Unknown',
  club          TEXT,
  age           TEXT,
  heat          TEXT,
  lane          TEXT,
  rank          TEXT,
  result_time   TEXT,
  session_name  TEXT,
  race_time     TEXT,
  call_room_time TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lane_matrix_meet_event_athlete_unique'
  ) THEN
    ALTER TABLE public.lane_matrix
      ADD CONSTRAINT lane_matrix_meet_event_athlete_unique
      UNIQUE (meet_id, event_code, athlete_name);
  END IF;
END $$;
