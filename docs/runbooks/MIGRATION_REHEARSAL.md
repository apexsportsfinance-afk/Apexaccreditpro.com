# Migration rehearsal — role-trust + partner-key hashing (do BEFORE live)

The two pending institutional migrations change **authorization**, so they get a
dress rehearsal on a **clone of live data** before they ever touch production.
This runbook doubles as the **Phase-0 restore drill** (rung 2) — running it logs a
tested restore.

Pending migrations (the only two in our branch not yet on live):
- `20260650_role_trust_hardening.sql` — **CRITICAL.** RLS now decides "is admin?"
  from `public.profiles.role` (server-controlled) instead of self-writable JWT
  `user_metadata`. Closes a privilege-escalation hole.
- `20260651_partner_api_key_hashing.sql` — **HIGH.** Hashes `partner_api_keys.api_key`
  (was plaintext); verification moves to a hash-compare RPC.

## The one real risk
`20260650` backfills `profiles.role` from `user_metadata` **only where
`profiles.role IS NULL`**, and only for users who **have a profiles row**. So an
admin gets locked out only if they **have no profiles row at all**, or already
have a **wrong non-NULL** `profiles.role`. The rehearsal finds those before live.

---

## Step 1 — Clone live into a throwaway project (this IS the restore drill)
- Supabase Dashboard → live project → Database → Backups → **restore latest backup
  (or PITR) into a NEW throwaway project** (e.g. `apex-rehearsal`).
- Record the start/finish time + that the restore succeeded → this closes the
  restore-drill gate in [`../DR_RUNBOOK.md`](../DR_RUNBOOK.md). Log today's date there.

## Step 2 — Pre-apply safety queries (run on the CLONE, in SQL editor)
Find admins that the backfill would NOT save:
```sql
-- (a) admin in JWT metadata but NO profiles row -> WOULD BE LOCKED OUT
select u.id, u.email, u.raw_user_meta_data->>'role' as meta_role
from auth.users u
left join public.profiles p on p.id = u.id
where u.raw_user_meta_data->>'role' in ('super_admin','event_admin','media_admin','admin')
  and p.id is null;

-- (b) admin in metadata but profiles.role is a DIFFERENT non-null value -> backfill SKIPS it
select u.email, u.raw_user_meta_data->>'role' as meta_role, p.role as profile_role
from auth.users u join public.profiles p on p.id = u.id
where u.raw_user_meta_data->>'role' in ('super_admin','event_admin','media_admin','admin')
  and p.role is not null and p.role <> u.raw_user_meta_data->>'role';
```
- **(a) must return 0 rows.** If not, insert the missing profiles rows (with the
  correct role) on live BEFORE applying — that's the fix.
- **(b)** rows are users whose `profiles.role` will win over metadata — eyeball
  that the `profile_role` is the *intended* one; correct any that are wrong.

## Step 3 — Apply both migrations on the clone
```bash
# point the CLI at the clone (NOT live):
supabase db push --project-ref <REHEARSAL_REF>
# or paste each .sql into the clone's SQL editor (both are idempotent).
```

## Step 4 — Post-apply verification (on the clone)
```sql
-- every expected admin still resolves as admin:
select id, email, role from public.profiles
where role in ('super_admin','event_admin','media_admin','admin') order by role;

-- the helper agrees (impersonation not needed — check the function exists & runs):
select public.is_admin(), public.is_super_admin();   -- as a logged-in admin session
```
Then **functionally**, against the clone's data via a staging build pointed at it
(or the SQL editor as a known admin):
- [ ] A `super_admin` can read/write admin-only tables (e.g. `partner_api_keys`).
- [ ] An `event_admin` can manage accreditations but NOT `partner_api_keys` beyond policy.
- [ ] A normal `viewer` can NOT escalate (`update profiles set role='super_admin'`
      on self must be **rejected** by the new WITH CHECK policy).
- [ ] Spot-check a few of the ~6,000 accreditations still read correctly.

## Step 5 — Partner-API key check (`20260651`)
- [ ] Take an existing partner key (plaintext) and verify it still authenticates
      via the hash-compare RPC / `verify-badge` path on the clone.
- [ ] If any partner key was plaintext-unrecoverable, plan a **re-issue** for that
      partner at cutover (don't silently break their integration).

## Step 6 — Go / no-go + live apply
- **Green** (Step 2(a) = 0 rows, Step 4 admins all present, Step 5 keys verify):
  apply the same two migrations to **live** in a window:
  ```bash
  supabase db push --project-ref dixelomafeobabahqeqg
  ```
  Immediately re-run the Step-4 admin query on live and confirm the super-admin
  resolves. Keep the clone until live has soaked.
- **Rollback:** the helpers + policies are idempotent swaps; to revert, re-apply
  the prior policy definitions (kept in `20260612_rls_hardening.sql` /
  `20260647_rls_gap_fix.sql`). Partner hashing is one-way — keep the plaintext
  backup (from the clone) until partners are confirmed working.

## Log
- Restore drill run: ____ (date)  → also update `DR_RUNBOOK.md`.
- Rehearsal result: ____  · Live apply: ____
