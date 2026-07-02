-- =====================================================================
-- SWIMMERS RANKING — CONSOLIDATED MIGRATION (run once, in order)
-- =====================================================================
-- Paste this whole file into the Supabase WEB SQL editor and Run.
-- Do NOT use `db push` (live schema-version history collides).
-- Every block is transaction-wrapped + idempotent (safe to re-run).
--
-- PREFLIGHT (run first, must return BOTH rows):
--   select proname from pg_proc
--   where proname in ('is_platform_admin','is_org_member');
--
-- Order: Phase 1 schema -> Phase 3d club merge -> Phase 4 views ->
--        Phase 5b swimmer merge. (phase1_fix is already folded into the
--        schema below; phase5 is superseded by phase5b.)
-- =====================================================================


-- #####################################################################
-- PHASE 1 — DATABASE STRUCTURE
-- #####################################################################
begin;

create table if not exists public.ranking_clubs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null,
  name            text not null,
  normalized_name text not null,
  aliases         jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  unique (org_id, normalized_name)
);

create table if not exists public.ranking_swimmers (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null,
  full_name              text not null,
  normalized_name        text not null,
  date_of_birth          date,
  gender                 text check (gender in ('M','F')),
  current_club_id        uuid references public.ranking_clubs(id),
  linked_accreditation_id uuid,
  is_verified            boolean not null default false,
  created_at             timestamptz not null default now()
);
create index if not exists idx_ranking_swimmers_match
  on public.ranking_swimmers (org_id, normalized_name, gender);

create table if not exists public.ranking_meets (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null,
  name              text not null,
  course_type       text not null check (course_type in ('SC','LC')),
  start_date        date,
  end_date          date,
  season            int,
  city              text,
  sanctioning_body  text,
  created_at        timestamptz not null default now()
);

create table if not exists public.ranking_import_batches (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null,
  meet_id                  uuid references public.ranking_meets(id),
  uploaded_by              uuid,
  uploaded_at              timestamptz not null default now(),
  status                   text not null default 'extracting'
                             check (status in ('extracting','review','approved','reversed')),
  course_type              text check (course_type in ('SC','LC')),
  season                   int,
  results_imported         int not null default 0,
  errors_count             int not null default 0,
  duplicates_skipped       int not null default 0,
  swimmers_matched         int not null default 0,
  swimmers_needing_review  int not null default 0
);

create table if not exists public.ranking_import_files (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  batch_id     uuid not null references public.ranking_import_batches(id) on delete cascade,
  file_name    text not null,
  file_sha256  text not null,
  page_count   int,
  parse_status text,
  error_detail text,
  created_at   timestamptz not null default now(),
  unique (org_id, file_sha256)
);

create table if not exists public.ranking_staging_results (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null,
  batch_id          uuid not null references public.ranking_import_batches(id) on delete cascade,
  raw_name          text,
  raw_team          text,
  raw_time          text,
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
  time_ms           int,
  time_display      text,
  finish_position   int,
  matched_swimmer_id uuid references public.ranking_swimmers(id),
  match_confidence   numeric,
  needs_review       boolean not null default false,
  review_reason      text,
  created_at         timestamptz not null default now()
);
create index if not exists idx_ranking_staging_batch
  on public.ranking_staging_results (batch_id);

create table if not exists public.ranking_results (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null,
  swimmer_id       uuid not null references public.ranking_swimmers(id),
  club_id          uuid references public.ranking_clubs(id),
  meet_id          uuid not null references public.ranking_meets(id),
  import_batch_id  uuid not null references public.ranking_import_batches(id) on delete cascade,
  gender           text not null,
  stroke           text not null,
  distance         int  not null,
  course_type      text not null check (course_type in ('SC','LC')),
  age_at_swim      int  not null,
  age_group_label  text not null,
  swim_date        date,
  season           int,
  time_ms          int  not null,
  time_display     text not null,
  finish_position  int,
  natural_key_hash text not null,
  created_at       timestamptz not null default now(),
  unique (org_id, natural_key_hash)
);
create index if not exists idx_ranking_results_event
  on public.ranking_results (org_id, gender, age_at_swim, stroke, distance, course_type, time_ms);
create index if not exists idx_ranking_results_swimmer
  on public.ranking_results (org_id, swimmer_id);
create index if not exists idx_ranking_results_meet
  on public.ranking_results (org_id, meet_id);
create index if not exists idx_ranking_results_season
  on public.ranking_results (org_id, season);

create table if not exists public.ranking_wa_base_times (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  gender       text not null check (gender in ('M','F')),
  course_type  text not null check (course_type in ('SC','LC')),
  stroke       text not null,
  distance     int  not null,
  base_time_ms int  not null,
  year         int  not null,
  created_at   timestamptz not null default now(),
  unique (org_id, gender, course_type, stroke, distance, year)
);

-- Row Level Security (permissive base grant + restrictive tenant isolation)
do $$
declare t text;
begin
  foreach t in array array[
    'ranking_clubs','ranking_swimmers','ranking_meets','ranking_import_batches',
    'ranking_import_files','ranking_staging_results','ranking_results','ranking_wa_base_times'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
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

-- Auto-fill org_id on insert (prevents restrictive-RLS 403 when client omits it)
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

commit;


-- #####################################################################
-- PHASE 3d — CLUB ALIAS / MERGE
-- #####################################################################
begin;

alter table public.ranking_clubs
  add column if not exists canonical_club_id uuid references public.ranking_clubs(id);

create index if not exists idx_ranking_clubs_canonical
  on public.ranking_clubs (org_id, canonical_club_id);

create or replace view public.ranking_club_stats
with (security_invoker = true) as
select
  c.*,
  (select count(*) from public.ranking_results  r where r.club_id = c.id)         as result_count,
  (select count(*) from public.ranking_swimmers s where s.current_club_id = c.id)  as swimmer_count
from public.ranking_clubs c;

commit;


-- #####################################################################
-- PHASE 4 — RANKING VIEWS (best times w/ names + event index)
-- #####################################################################
begin;

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


-- #####################################################################
-- PHASE 5b — SWIMMER MERGE / DEDUP (+ swimmer stats view)
-- #####################################################################
begin;

alter table public.ranking_swimmers
  add column if not exists canonical_swimmer_id uuid references public.ranking_swimmers(id);

create index if not exists idx_ranking_swimmers_canonical
  on public.ranking_swimmers (canonical_swimmer_id);

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
where s.canonical_swimmer_id is null
group by s.id, s.org_id, s.full_name, s.normalized_name, s.gender,
         s.is_verified, s.current_club_id, c.name;

commit;

-- =====================================================================
-- END. Verify RLS with:
--   select c.relname, bool_or(p.polpermissive) permissive_ok,
--          bool_or(not p.polpermissive) restrictive_ok
--   from pg_policy p join pg_class c on c.oid=p.polrelid
--   where c.relname like 'ranking_%' group by c.relname order by c.relname;
-- Each ranking_ table should show permissive_ok = t AND restrictive_ok = t.
-- =====================================================================
