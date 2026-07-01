-- ===== 020 — list / remove an org's logins (super-admin-gated) =====
-- Backs the Organizations tab "Current logins" list + Remove. Both self-gate on
-- is_platform_admin(); granted to authenticated only. Removing a member only
-- detaches them from the org (organization_members) — it does NOT delete their
-- auth login. Refuses the platform org (apex).
-- ============================================================================

create or replace function public.admin_list_org_members(p_org_slug text)
returns table(user_id uuid, email text, full_name text, app_role text, org_role text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  return query
    select p.id, p.email, p.full_name, p.role, m.role
    from public.organization_members m
    join public.organizations o on o.id = m.org_id
    left join public.profiles p on p.id = m.user_id
    where o.slug = p_org_slug
    order by p.email nulls last;
end;
$$;

create or replace function public.admin_unlink_user(p_email text, p_org_slug text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_user uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  if lower(trim(p_org_slug)) = 'apex' then raise exception 'refusing to modify the platform org (apex)'; end if;
  select id into v_org from public.organizations where slug = p_org_slug;
  if v_org is null then raise exception 'org not found: %', p_org_slug; end if;
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then return; end if;
  delete from public.organization_members where org_id = v_org and user_id = v_user;
end;
$$;

revoke all on function public.admin_list_org_members(text) from public;
revoke all on function public.admin_unlink_user(text,text) from public;
grant execute on function public.admin_list_org_members(text) to authenticated;
grant execute on function public.admin_unlink_user(text,text) to authenticated;
