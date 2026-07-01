-- ===== 019 — per-user access context for org-level feature gating (LIVE) =====
-- Returns, for the logged-in user:
--   is_platform : true if super_admin OR a member of the platform org (apex)
--                 -> unrestricted by org features (Apex owner + Apex staff).
--   features    : their (non-apex) org's features jsonb -> the set of module
--                 paths that org is allowed. Empty/legacy = unrestricted
--                 (the frontend treats "no /admin keys" as fail-open).
-- The frontend (AuthContext) calls this and gates the sidebar/modules by it,
-- so a CLIENT — even a client 'admin' — only sees the pages their org bought.
-- ============================================================================
create or replace function public.my_access_context()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'is_platform', public.is_platform_admin() or public.is_platform_org_member(),
    'features', coalesce((
      select o.features
      from public.organizations o
      join public.organization_members m on m.org_id = o.id
      where m.user_id = auth.uid() and o.slug <> 'apex'
      order by o.created_at nulls last
      limit 1
    ), '{}'::jsonb)
  );
$$;
grant execute on function public.my_access_context() to authenticated;
