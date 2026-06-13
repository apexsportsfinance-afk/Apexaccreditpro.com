-- ==============================================================================
-- PHASE 4G: RULES & REGULATIONS + ACKNOWLEDGEMENTS
--
-- Adds `event_rules_documents` (admin-published rules/regulations per event,
-- e.g. general rules, sport-specific rules, code of conduct, venue rules,
-- eligibility, deadlines, notices) and ensures `team_rules_acknowledgements`
-- (pre-existing table) has the columns needed to track which team user
-- acknowledged which document and when.
--
-- Idempotent: safe to re-run. Run in the Supabase SQL editor (or `supabase db push`).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EVENT RULES DOCUMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_rules_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    description TEXT,
    file_url TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_rules_documents_event_id ON public.event_rules_documents(event_id);

ALTER TABLE public.event_rules_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view active rules documents" ON public.event_rules_documents;
DROP POLICY IF EXISTS "Admins manage rules documents" ON public.event_rules_documents;

CREATE POLICY "Authenticated users view active rules documents"
ON public.event_rules_documents
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Admins manage rules documents"
ON public.event_rules_documents
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'event_admin', 'media_admin', 'admin')
);

-- ------------------------------------------------------------------------------
-- 2. TEAM RULES ACKNOWLEDGEMENTS
--    Table is pre-existing (provisioned for RLS testing) but its column shape
--    is unconfirmed. CREATE TABLE IF NOT EXISTS covers the case it does not
--    exist yet; the ADD COLUMN IF NOT EXISTS statements backfill the columns
--    this feature needs without touching any pre-existing columns/rows.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_rules_acknowledgements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.team_rules_acknowledgements ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.team_rules_acknowledgements ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.team_rules_acknowledgements ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.event_rules_documents(id) ON DELETE CASCADE;
ALTER TABLE public.team_rules_acknowledgements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.team_rules_acknowledgements ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_rules_ack_unique ON public.team_rules_acknowledgements(team_id, document_id, user_id);
CREATE INDEX IF NOT EXISTS idx_team_rules_ack_event_id ON public.team_rules_acknowledgements(event_id);

ALTER TABLE public.team_rules_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members manage own acknowledgements" ON public.team_rules_acknowledgements;
DROP POLICY IF EXISTS "Admins view all acknowledgements" ON public.team_rules_acknowledgements;

CREATE POLICY "Team members manage own acknowledgements"
ON public.team_rules_acknowledgements
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.team_users tu
    WHERE tu.team_id = team_rules_acknowledgements.team_id AND tu.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.team_users tu
    WHERE tu.team_id = team_rules_acknowledgements.team_id AND tu.user_id = auth.uid()
  )
);

CREATE POLICY "Admins view all acknowledgements"
ON public.team_rules_acknowledgements
FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'event_admin', 'media_admin', 'admin')
);
