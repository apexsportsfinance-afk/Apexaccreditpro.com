-- =====================================================================
-- SWIMMERS RANKING — Phase 4 view enhancements  (Rankings + Settings)
-- =====================================================================
-- Adds what the Rankings tab needs to display and export, WITHOUT touching
-- any data. Purely additive:
--   1. ranking_best_times   — re-defined to also expose swimmer_name,
--      club_name, meet_name (appended columns, so `create or replace`
--      is valid and nothing that reads the old columns breaks).
--   2. ranking_event_index  — NEW view: the distinct (gender, age, stroke,
--      distance, course, season) events that actually exist, with a result
--      count. Powers the cascading filter dropdowns cheaply (no scanning
--      thousands of result rows in the browser just to list the options).
--
-- HOW TO RUN: paste into the Supabase WEB SQL editor and Run. Transaction-
-- wrapped + idempotent (safe to re-run). Do NOT use `db push`.
-- Requires Phase 1 (ranking_best_times, ranking_results, etc.) to exist.
-- =====================================================================

begin;

-- ---------- 1. ranking_best_times: attach display names -----------------
-- Same columns/order as Phase 1, PLUS swimmer_name, club_name, meet_name at
-- the end. security_invoker keeps base-table RLS in force (no tenant leak).
create or replace view public.ranking_best_times
with (security_invoker = true) as
with best as (
  select r.*,
         row_number() over (
           partition by r.org_id, r.swimmer_id, r.gender, r.age_at_swim,
                        r.stroke, r.distance, r.course_type
           order by r.time_ms asc, r.swim_date asc nulls last
         ) as rn
  from public.ranking_results r
)
select
  b.org_id,
  b.swimmer_id,
  b.gender,
  b.age_at_swim,
  b.age_group_label,
  b.stroke,
  b.distance,
  b.course_type,
  b.id            as best_result_id,
  b.meet_id,
  b.club_id,
  b.swim_date,
  b.season,
  b.time_ms       as best_time_ms,
  b.time_display  as best_time_display,
  b.finish_position,
  wa.base_time_ms,
  case when wa.base_time_ms is not null
       then round(1000 * power(wa.base_time_ms::numeric / b.time_ms, 3))
       else null end                                      as wa_points,
  rank() over (
    partition by b.org_id, b.gender, b.age_at_swim, b.stroke, b.distance, b.course_type
    order by b.time_ms asc
  )                                                       as rank_position,
  -- appended display columns (safe for create-or-replace):
  s.full_name     as swimmer_name,
  c.name          as club_name,
  m.name          as meet_name
from best b
left join lateral (
  select w.base_time_ms
  from public.ranking_wa_base_times w
  where w.org_id      = b.org_id
    and w.gender      = b.gender
    and w.course_type = b.course_type
    and w.stroke      = b.stroke
    and w.distance    = b.distance
  order by w.year desc
  limit 1
) wa on true
left join public.ranking_swimmers s on s.id = b.swimmer_id
left join public.ranking_clubs    c on c.id = b.club_id
left join public.ranking_meets    m on m.id = b.meet_id
where b.rn = 1;

-- ---------- 2. ranking_event_index: distinct events that exist ----------
-- One row per (gender, age, stroke, distance, course) event, with the season
-- span and how many swimmers are ranked in it. Drives the filter dropdowns.
create or replace view public.ranking_event_index
with (security_invoker = true) as
select
  org_id,
  gender,
  age_at_swim,
  max(age_group_label)              as age_group_label,
  stroke,
  distance,
  course_type,
  count(distinct swimmer_id)        as swimmer_count,
  count(*)                          as result_count,
  min(season)                       as first_season,
  max(season)                       as last_season
from public.ranking_results
group by org_id, gender, age_at_swim, stroke, distance, course_type;

commit;

-- =====================================================================
-- END Phase 4 views. The Rankings tab reads ranking_best_times (filtered by
-- gender/age/stroke/distance/course, ordered by rank_position) and lists the
-- distinct events from ranking_event_index. WA base times are managed in the
-- Settings tab (ranking_wa_base_times) and feed wa_points automatically.
-- =====================================================================
