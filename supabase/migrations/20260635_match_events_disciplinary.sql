-- ==============================================================================
-- PHASE 2: MATCH EVENTS (goal/point scorers) + PLAYER DISCIPLINARY RECORDS
--
-- Two new, purely additive tables. No existing tables/columns/functions are
-- changed. Both link back to live_score_matches/teams/accreditations but use
-- ON DELETE SET NULL for those references so historical records survive if a
-- match/team/accreditation is later removed.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- match_events: records who scored (goal/point/try/etc.), when, in which match.
-- Shown in admin match management, the public live-scores widget, and the
-- Team Portal schedule. Mirrors the live_score_matches RLS pattern (public
-- read, any authenticated user can manage) since it's edited from the same
-- Live Scores admin screen by the same roles (incl. Score Operators).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.live_score_matches(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  player_accreditation_id uuid REFERENCES public.accreditations(id) ON DELETE SET NULL,
  player_name text NOT NULL,
  event_type text NOT NULL DEFAULT 'Goal',
  minute text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_events_match_id ON public.match_events(match_id);
CREATE INDEX IF NOT EXISTS idx_match_events_event_id ON public.match_events(event_id);

ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Access" ON public.match_events
FOR SELECT USING (true);

CREATE POLICY "Auth Write Access" ON public.match_events
FOR ALL USING (auth.role() = 'authenticated');

-- ------------------------------------------------------------------------------
-- player_disciplinary_records: yellow/red cards tied to a player, match and
-- team, for disciplinary review / suspension management. Admin-facing only
-- (no public read policy) - authenticated staff can view and manage.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_disciplinary_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.live_score_matches(id) ON DELETE SET NULL,
  sport_id uuid REFERENCES public.live_score_sports(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  player_accreditation_id uuid REFERENCES public.accreditations(id) ON DELETE SET NULL,
  player_name text NOT NULL,
  match_title text,
  competition text,
  match_date date,
  card_type text NOT NULL,
  reason text,
  minute text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_disciplinary_event_id ON public.player_disciplinary_records(event_id);
CREATE INDEX IF NOT EXISTS idx_player_disciplinary_player ON public.player_disciplinary_records(player_accreditation_id);
CREATE INDEX IF NOT EXISTS idx_player_disciplinary_team ON public.player_disciplinary_records(team_id);

ALTER TABLE public.player_disciplinary_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth Access" ON public.player_disciplinary_records
FOR ALL USING (auth.role() = 'authenticated');

-- ------------------------------------------------------------------------------
-- Drop the temporary RLS-inspection helper from the previous migration.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.diag_rls_policies();
