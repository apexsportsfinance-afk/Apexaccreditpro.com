-- =====================================================================
-- SWIMMERS RANKING — Club alias / merge  (Phase 3d)
-- =====================================================================
-- Real Hy-Tek result files spell the SAME club differently across meets
-- ("Hamilton" vs "Hamilton Aquatics Dubai", "Msc Dubai" vs "MY Swim Club
-- Dubai"). Short forms are arbitrary human abbreviations that no algorithm
-- can map safely, so we let an admin MERGE duplicates by hand; the merge is
-- remembered (winner.aliases) so future imports of either spelling resolve
-- to the one canonical club.
--
-- This migration is purely additive:
--   * adds ranking_clubs.canonical_club_id (self-ref; null = canonical,
--     set = this row was merged INTO another and is a tombstone)
--   * adds a helper view ranking_club_stats (per-club swim + swimmer counts)
--
-- HOW TO RUN (do NOT use `db push`): paste into the Supabase WEB SQL editor
-- and Run. Transaction-wrapped + idempotent (safe to re-run).
-- =====================================================================

begin;

-- 1. Merge pointer. NULL = canonical club. Non-null = merged away into the
--    referenced surviving club (kept as a tombstone so a merge is reversible
--    and auditable, and so re-importing the old spelling still resolves).
alter table public.ranking_clubs
  add column if not exists canonical_club_id uuid references public.ranking_clubs(id);

create index if not exists idx_ranking_clubs_canonical
  on public.ranking_clubs (org_id, canonical_club_id);

-- 2. Per-club usage counts for the Clubs admin tab. security_invoker = true so
--    the counts honour tenant RLS (each caller only ever counts their own org).
create or replace view public.ranking_club_stats
with (security_invoker = true) as
select
  c.*,
  (select count(*) from public.ranking_results  r where r.club_id = c.id)         as result_count,
  (select count(*) from public.ranking_swimmers s where s.current_club_id = c.id)  as swimmer_count
from public.ranking_clubs c;

commit;

-- =====================================================================
-- END Phase 3d. The import path (rankingImportApi._ensureClubs) resolves
-- incoming club names through name + aliases + canonical_club_id; the Clubs
-- tab (RankingClubsPanel) drives merge/rename.
-- =====================================================================
