-- Allow the new 'birthday' broadcast type on broadcasts_v2.
--
-- Birthday certificates are now stored as a distinct broadcast type so they
-- stay separate from changeable athlete/personal broadcasts (own section in the
-- QR profile, never overwritten by a personal notification). The original
-- broadcasts_v2_type_check constraint only permitted ('global','athlete'), so
-- inserting type='birthday' failed with:
--   new row for relation "broadcasts_v2" violates check constraint "broadcasts_v2_type_check"
--
-- This widens the allowed set to include 'birthday'. Safe to re-run.

ALTER TABLE public.broadcasts_v2
  DROP CONSTRAINT IF EXISTS broadcasts_v2_type_check;

ALTER TABLE public.broadcasts_v2
  ADD CONSTRAINT broadcasts_v2_type_check
  CHECK (type IN ('global', 'athlete', 'birthday'));
