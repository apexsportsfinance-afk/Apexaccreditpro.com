# Standing up the staging database schema

> **Read this before `supabase db push`.** The migrations in
> `supabase/migrations/` do **not** contain the full schema — only ~17
> `CREATE TABLE`s for *feature* tables (e.g. `match_events`,
> disciplinary records, areas/stages). The **base** tables the app relies
> on — `events`, `accreditations`, `teams`, `profiles`, `zones`,
> `global_settings`, `spectator_orders`, and others — were created
> directly in the live Supabase dashboard and are **not** reproduced by the
> migrations. So `db push` alone leaves a fresh staging project missing its
> foundation, and later migrations may fail on absent tables.

## Get the full schema onto staging (two options)

### Option A — dump live schema, apply to staging (recommended, faithful)
Schema only. **No data, no PII.**
```bash
# 1) Dump LIVE schema (structure only — safe, no rows)
supabase db dump --linked --schema public -f supabase/schema.live.sql
#    (or: pg_dump --schema-only --no-owner --no-privileges "<LIVE_DB_URL>" > supabase/schema.live.sql)

# 2) Point the CLI at STAGING — verify the ref is NOT the live ref
supabase link --project-ref <STAGING_REF>

# 3) Apply the base schema, THEN the incremental migrations
psql "<STAGING_DB_URL>" -f supabase/schema.live.sql
supabase db push        # applies supabase/migrations/ on top
```
> Review `schema.live.sql` before applying: confirm it is structure only
> (no `INSERT`/`COPY` with real rows). Do **not** commit a dump that
> contains data.

### Option B — reconstruct base tables as a migration (more work, fully in-repo)
Author a `00000000_base_schema.sql` migration from the live dump so the whole
schema lives in git and `db push` is self-sufficient. Better long-term, but
needs careful review that it matches live exactly — defer unless you want the
repo to be the single source of truth.

## After the schema exists — seed FAKE data only
Run `supabase/seed.staging.sql` (template alongside this file). It inserts a
handful of obviously-fake events/teams so the UI has something to render.
**Never** seed real athlete photos, IDs, or PII into staging.

## Pre-flight (repeat of the golden rule)
Before any write, confirm in DevTools → Network that every Supabase request
targets `<STAGING_REF>.supabase.co` and never `dixelomafeobabahqeqg.supabase.co`.
See [docs/STAGING_CLOUDFLARE.md](../docs/STAGING_CLOUDFLARE.md).
