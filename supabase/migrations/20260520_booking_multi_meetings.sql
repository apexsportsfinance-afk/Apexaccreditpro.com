-- Migration to support booking one slot per meeting (group_name) instead of one per event.

-- 1. Drop the old strict constraint that prevented multiple bookings per event
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS unique_accreditation_booking;

-- 2. Add group_name column to track which meeting the booking belongs to
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS group_name TEXT NOT NULL DEFAULT 'General Meeting';

-- 3. Add the new constraint allowing exactly ONE booking per meeting per participant
ALTER TABLE public.bookings ADD CONSTRAINT unique_participant_meeting UNIQUE (event_id, accreditation_id, group_name);
