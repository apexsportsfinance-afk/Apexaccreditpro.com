-- The superadmin@accreditpro.com account is confirmed to have
-- raw_user_meta_data->>'role' = 'super_admin', so the email OR-clause
-- in the profiles ALL policy is redundant and can be removed safely.
-- Dropping by email in an RLS policy is a security smell: it means one
-- specific email address bypasses role management permanently.

DROP POLICY IF EXISTS "Super Admins can manage all profiles" ON public.profiles;

CREATE POLICY "Super Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
);
