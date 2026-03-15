-- Supabase Cleanup & Optimization Script
-- This script should be run in the Supabase SQL Editor.

-- 1. Truncate stale audit logs (if non-empty)
-- TRUNCATE TABLE audit_logs;

-- 2. Remove orphaned foreign keys (if any)
-- Check and cleanup accreditations that reference non-existent events
DELETE FROM accreditations WHERE event_id NOT IN (SELECT id FROM events);

-- 3. Maintenance: VACUUM & ANALYZE
-- This improves query planning and reclaims space
VACUUM ANALYZE accreditations;
VACUUM ANALYZE events;
VACUUM ANALYZE zones;
VACUUM ANALYZE categories;
VACUUM ANALYZE event_categories;
VACUUM ANALYZE global_settings;
VACUUM ANALYZE broadcasts_v2;
VACUUM ANALYZE athlete_events;
VACUUM ANALYZE form_field_settings;

-- 4. Consolidate/Check Indexes
-- Ensure we have indexes on frequently searched columns
CREATE INDEX IF NOT EXISTS idx_accreditations_event_id ON accreditations(event_id);
CREATE INDEX IF NOT EXISTS idx_accreditations_status ON accreditations(status);
CREATE INDEX IF NOT EXISTS idx_athlete_events_event_id ON athlete_events(event_id);

-- 5. Cleanup Obsolete Objects (Example: if 'old_table' existed)
-- DROP TABLE IF EXISTS old_debug_table;
