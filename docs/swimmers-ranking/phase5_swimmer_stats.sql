-- =====================================================================
-- SWIMMERS RANKING — Phase 5  (Swimmer registry + profiles)
-- =====================================================================
-- Purely additive: one view that powers the Swimmers tab list (each
-- swimmer with their club and swim/meet/event tallies). Profiles read the
-- existing ranking_best_times (personal bests) and ranking_results (full
-- history) directly, so no other schema is needed.
--
-- HOW TO RUN: paste into the Supabase WEB SQL editor and Run. Transaction-
-- wrapped + idempotent (safe to re-run). Do NOT use `db push`. Requires
-- Phase 1 (ranking_swimmers, ranking_results, ranking_clubs).
-- =====================================================================

begin;

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
group by s.id, s.org_id, s.full_name, s.normalized_name, s.gender,
         s.is_verified, s.current_club_id, c.name;

commit;

-- =====================================================================
-- END Phase 5 view. The Swimmers tab lists ranking_swimmer_stats; opening a
-- swimmer shows their personal bests (ranking_best_times, filtered by
-- swimmer_id) and full history (ranking_results + meet/club).
-- =====================================================================
