-- =====================================================================
-- SWIMMERS RANKING — Phase 5b  (Swimmer merge / dedup)
-- =====================================================================
-- The matcher creates a NEW swimmer when a name is too different to link
-- confidently, so the same person can end up as two records under two
-- spellings ("Jon Smith" / "John Smith"). This adds a tombstone pointer so an
-- admin can merge the duplicate INTO the record to keep, and — because the
-- matcher redirects tombstones to their canonical swimmer — future imports of
-- the old spelling resolve to the kept swimmer automatically.
--
-- Purely additive. Paste into the Supabase WEB SQL editor and Run. Idempotent
-- (safe to re-run). Do NOT use `db push`. Supersedes Phase 5's view (adds a
-- tombstone filter), so running this after Phase 5 is correct; running it
-- instead of Phase 5 also works (it re-creates the same view).
-- =====================================================================

begin;

-- Self-referencing tombstone: a merged-away swimmer points at the survivor.
alter table public.ranking_swimmers
  add column if not exists canonical_swimmer_id uuid references public.ranking_swimmers(id);

create index if not exists idx_ranking_swimmers_canonical
  on public.ranking_swimmers (canonical_swimmer_id);

-- Registry stats — same columns as Phase 5, but hide tombstoned duplicates so
-- a merged-away swimmer (now with 0 results) doesn't clutter the Swimmers tab.
create or replace view public.ranking_swimmer_stats
with (security_invoker = true) as
select
  s.id,
  s.org_id,
  s.full_name,
  s.normalized_name,
  s.gender,
  s.is_verified,
  s.current_club_id,
  c.name                                   as club_name,
  count(r.id)                              as result_count,
  count(distinct r.meet_id)                as meet_count,
  count(distinct
        r.gender || '|' || r.stroke || '|' || r.distance || '|' ||
        r.course_type || '|' || r.age_at_swim)  as event_count,
  min(r.swim_date)                         as first_swim_date,
  max(r.swim_date)                         as last_swim_date
from public.ranking_swimmers s
left join public.ranking_clubs   c on c.id = s.current_club_id
left join public.ranking_results r on r.swimmer_id = s.id
where s.canonical_swimmer_id is null          -- exclude merged-away tombstones
group by s.id, s.org_id, s.full_name, s.normalized_name, s.gender,
         s.is_verified, s.current_club_id, c.name;

commit;

-- =====================================================================
-- END Phase 5b. mergeSwimmers() repoints results + staging matches to the
-- winner and tombstones the loser; buildSwimmerIndex() redirects the loser's
-- spelling to the winner id, so the merge is remembered on future imports.
-- =====================================================================
