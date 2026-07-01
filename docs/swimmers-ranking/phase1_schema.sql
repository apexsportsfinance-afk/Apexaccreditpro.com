-- =====================================================================
-- SWIMMERS RANKING — Phase 1 Database Structure  (DRAFT FOR REVIEW)
-- =====================================================================
-- STATUS: LIVE-READY DRAFT for review. Product owner has chosen to run this
--         on the LIVE Supabase (2026-07-01). It is purely additive (only
--         CREATEs new ranking_* objects; touches NO existing table) and the
--         tables ship EMPTY, so no user-facing behavior changes until the
--         feature is built & approved.
--   HOW TO RUN (do NOT use `db push` -- live schema-version history collides):
--     1. PREFLIGHT: confirm helpers exist ->
--          select proname from pg_proc
--          where proname in ('is_platform_admin','is_org_member');
--        Both must be returned before proceeding.
--     2. Paste this whole file into the Supabase WEB SQL editor and Run.
--        It is transaction-wrapped + idempotent (safe to re-run).
--
-- Design principles (confirmed with product owner 2026-07-01):
--   * Cross-event, permanent results database. New results ADD to history,
--     they never overwrite. Rankings are DERIVED (a view), never stored
--     destructively, so re-uploads and reverse-imports auto re-rank.
--   * Ranking = for each (gender, age_at_swim, stroke, distance, course_type):
--     keep each swimmer's fastest valid time across ALL meets, list 1..N.
--   * Only valid times exist here. DQ/DNS/DNF/NT rows are skipped at parse
--     time and never stored.
--   * Age groups are single-year; age_at_swim + age_group_label are FROZEN
--     per race so old results stay in the age group swum at the time.
--   * Course type (SC/LC) is chosen at upload; parser fills it when the file
--     states it, but the admin's choice is source of truth.
--   * World Aquatics points are computed in the ranking view from an
--     admin-managed base-time table; updating a base re-ranks everything.
--   * Every table is org_id-anchored with RESTRICTIVE RLS, matching the
--     existing tenant_isolation pattern (helpers: is_platform_admin(),
--     is_org_member(uuid)). org_id is auto-filled on insert via trigger.
-- =====================================================================

begin;  -- all-or-nothing: any error rolls the whole thing back, zero partial state

-- ---------- 1. CLUBS / TEAMS (persistent registry across meets) -------
create table if not exists public.ranking_clubs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null,
  name            text not null,
  normalized_name text not null,          -- lowercased/trimmed for matching
  aliases         jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  unique (org_id, normalized_name)
);

-- ---------- 2. SWIMMERS (persistent identity across years/events) -----
create table if not exists public.ranking_swimmers (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null,
  full_name              text not null,
  normalized_name        text not null,
  date_of_birth          date,                       -- usually absent in result files
  gender                 text check (gender in ('M','F')),  -- from event header Boys/Girls
  current_club_id        uuid references public.ranking_clubs(id),
  linked_accreditation_id uuid,                       -- soft link to existing athlete profile
  is_verified            boolean not null default false,  -- false = temp record, needs review
  created_at             timestamptz not null default now()
);
create index if not exists idx_ranking_swimmers_match
  on public.ranking_swimmers (org_id, normalized_name, gender);

-- ---------- 3. MEETS / COMPETITIONS -----------------------------------
create table if not exists public.ranking_meets (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null,
  name              text not null,
  course_type       text not null check (course_type in ('SC','LC')),
  start_date        date,
  end_date          date,
  season            int,                    -- calendar year (Jan-Dec)
  city              text,
  sanctioning_body  text,                   -- e.g. "UAE Aquatics"
  created_at        timestamptz not null default now()
);

-- ---------- 4. IMPORT BATCHES (one per upload session) ----------------
create table if not exists public.ranking_import_batches (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null,
  meet_id                  uuid references public.ranking_meets(id),
  uploaded_by              uuid,
  uploaded_at              timestamptz not null default now(),
  status                   text not null default 'extracting'
                             check (status in ('extracting','review','approved','reversed')),
  course_type              text check (course_type in ('SC','LC')),  -- upload-time choice
  season                   int,
  results_imported         int not null default 0,
  errors_count             int not null default 0,
  duplicates_skipped       int not null default 0,
  swimmers_matched         int not null default 0,
  swimmers_needing_review  int not null default 0
);

-- ---------- 5. IMPORT FILES (multi-PDF per batch, dup guard) ----------
create table if not exists public.ranking_import_files (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  batch_id     uuid not null references public.ranking_import_batches(id) on delete cascade,
  file_name    text not null,
  file_sha256  text not null,             -- blocks re-uploading the exact same PDF
  page_count   int,
  parse_status text,
  error_detail text,
  created_at   timestamptz not null default now(),
  unique (org_id, file_sha256)
);

-- ---------- 6. STAGING RESULTS (extracted, pre-approval review) -------
create table if not exists public.ranking_staging_results (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null,
  batch_id          uuid not null references public.ranking_import_batches(id) on delete cascade,
  -- raw extracted text (for the correction grid)
  raw_name          text,
  raw_team          text,
  raw_time          text,
  -- parsed / correctable fields
  full_name         text,
  club_name         text,
  gender            text,
  stroke            text,
  distance          int,
  course_type       text,
  age_at_swim       int,
  age_group_label   text,
  swim_date         date,
  season            int,
  time_ms           int,                   -- milliseconds; null if unparseable
  time_display      text,
  finish_position   int,
  -- matching / review
  matched_swimmer_id uuid references public.ranking_swimmers(id),
  match_confidence   numeric,
  needs_review       boolean not null default false,
  review_reason      text,
  created_at         timestamptz not null default now()
);
create index if not exists idx_ranking_staging_batch
  on public.ranking_staging_results (batch_id);

-- ---------- 7. RESULTS (immutable, one row per valid swim) ------------
create table if not exists public.ranking_results (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null,
  swimmer_id       uuid not null references public.ranking_swimmers(id),
  club_id          uuid references public.ranking_clubs(id),
  meet_id          uuid not null references public.ranking_meets(id),
  import_batch_id  uuid not null references public.ranking_import_batches(id) on delete cascade,
  gender           text not null,          -- 'M' / 'F'  (from event header)
  stroke           text not null,          -- Freestyle / Backstroke / ...
  distance         int  not null,          -- 50, 100, 200, ...
  course_type      text not null check (course_type in ('SC','LC')),
  age_at_swim      int  not null,          -- FROZEN: swimmer's age on the result
  age_group_label  text not null,          -- FROZEN: e.g. "9 Year Olds"
  swim_date        date,
  season           int,                    -- calendar year
  time_ms          int  not null,          -- milliseconds, exact sort key
  time_display     text not null,          -- "34.62" / "1:04.23"
  finish_position  int,                    -- place at that meet (informational)
  natural_key_hash text not null,          -- dedup: swimmer+event+meet+time
  created_at       timestamptz not null default now(),
  unique (org_id, natural_key_hash)
);
-- indexes that power ranking + filtering at thousands-of-rows scale
create index if not exists idx_ranking_results_event
  on public.ranking_results (org_id, gender, age_at_swim, stroke, distance, course_type, time_ms);
create index if not exists idx_ranking_results_swimmer
  on public.ranking_results (org_id, swimmer_id);
create index if not exists idx_ranking_results_meet
  on public.ranking_results (org_id, meet_id);
create index if not exists idx_ranking_results_season
  on public.ranking_results (org_id, season);

-- ---------- 8. WORLD AQUATICS BASE TIMES (the "1000-point" times) ------
create table if not exists public.ranking_wa_base_times (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  gender       text not null check (gender in ('M','F')),
  course_type  text not null check (course_type in ('SC','LC')),
  stroke       text not null,
  distance     int  not null,
  base_time_ms int  not null,             -- the time equal to 1000 points
  year         int  not null,             -- version (base times update ~yearly)
  created_at   timestamptz not null default now(),
  unique (org_id, gender, course_type, stroke, distance, year)
);

-- =====================================================================
-- RANKING VIEW  (derived, never stored destructively)
-- security_invoker = true  -> RLS of base tables applies (no tenant leak).
-- For each swimmer keep their fastest swim per event/age/gender/course,
-- rank 1..N, and attach World Aquatics points.
-- =====================================================================
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
  )                                                       as rank_position
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
where b.rn = 1;
-- Filtering (year/season/meet/date-range/stroke/distance/gender/age/club/
-- course/individual/all-time) = WHERE clauses on this view.

-- =====================================================================
-- ROW LEVEL SECURITY  (restrictive tenant isolation on every table)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'ranking_clubs','ranking_swimmers','ranking_meets','ranking_import_batches',
    'ranking_import_files','ranking_staging_results','ranking_results','ranking_wa_base_times'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
    -- PERMISSIVE base grant. REQUIRED: a RESTRICTIVE policy can only narrow
    -- access; without a permissive policy Postgres denies everything (403).
    -- The restrictive tenant_isolation policy below AND-narrows this to the
    -- caller's own org, so isolation still holds. (Mirrors the base_read +
    -- tenant_isolation pairing on the proven live tables, extended to writes.)
    execute format('drop policy if exists ranking_base_access on public.%I;', t);
    execute format($p$
      create policy ranking_base_access on public.%I
        as permissive for all to authenticated
        using (true) with check (true);
    $p$, t);
    execute format('drop policy if exists tenant_isolation on public.%I;', t);
    execute format($p$
      create policy tenant_isolation on public.%I
        as restrictive for all to authenticated
        using (public.is_platform_admin() or public.is_org_member(org_id))
        with check (public.is_platform_admin() or public.is_org_member(org_id));
    $p$, t);
  end loop;
end $$;

-- =====================================================================
-- AUTO-FILL org_id ON INSERT  (prevents restrictive-RLS 403 when the
-- client omits org_id; mirrors the fix noted for events on live)
-- =====================================================================
create or replace function public.ranking_set_org_id()
returns trigger language plpgsql security definer as $$
begin
  if new.org_id is null then
    new.org_id := (
      select org_id from public.organization_members
      where user_id = auth.uid()
      limit 1
    );
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'ranking_clubs','ranking_swimmers','ranking_meets','ranking_import_batches',
    'ranking_import_files','ranking_staging_results','ranking_results','ranking_wa_base_times'
  ] loop
    execute format('drop trigger if exists trg_%1$s_set_org on public.%1$s;', t);
    execute format(
      'create trigger trg_%1$s_set_org before insert on public.%1$s
         for each row execute function public.ranking_set_org_id();', t);
  end loop;
end $$;

commit;  -- everything above applied together, or not at all

-- =====================================================================
-- END Phase 1 draft. Next: Phase 2 results parser (rankingResultParser.js).
-- =====================================================================
