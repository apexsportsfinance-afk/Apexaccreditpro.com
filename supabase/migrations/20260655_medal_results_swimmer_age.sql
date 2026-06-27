-- Medal Rankings: store the swimmer's actual age (from the HY-TEK result line)
-- so the leaderboard can group/filter by athlete age instead of the event's age
-- group. Populated on the next results re-import.
ALTER TABLE public.medal_results
  ADD COLUMN IF NOT EXISTS swimmer_age integer;
