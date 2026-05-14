-- Fix for Infinite Recursion Error in profiles table

-- 1. Drop the recursive policy
DROP POLICY IF EXISTS "Super Admins can manage all profiles" ON public.profiles;

-- 2. Create a non-recursive policy using JWT metadata
-- This checks the 'role' stored in the user's metadata in their Auth token
CREATE POLICY "Super Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin' OR
  (auth.jwt() ->> 'email') = 'superadmin@accreditpro.com'
);

-- 3. Ensure the 'viewable by authenticated' policy is also clean
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 4. Verify
SELECT * FROM pg_policies WHERE tablename = 'profiles';
