-- event_document_requirements: admin-configurable list of document types required per event
CREATE TABLE IF NOT EXISTS event_document_requirements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  is_required boolean DEFAULT true,
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, doc_type)
);

ALTER TABLE event_document_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage doc requirements"
  ON event_document_requirements FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin','event_admin','media_admin','admin'));

CREATE POLICY "Authenticated read doc requirements"
  ON event_document_requirements FOR SELECT
  USING (auth.role() = 'authenticated');

-- Also update team_documents.review_notes to allow rejection reason (column likely already exists, use IF NOT EXISTS pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_documents' AND column_name = 'review_notes'
  ) THEN
    ALTER TABLE team_documents ADD COLUMN review_notes text;
  END IF;
END $$;
