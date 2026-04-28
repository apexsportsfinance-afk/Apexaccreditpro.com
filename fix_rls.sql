-- 1. Enable RLS on profiles if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive read policies if they exist (common default)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 3. Create a policy that allows anyone authenticated to read profiles
-- (This is the simplest way to fix the dashboard visibility)
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 4. Create a policy that allows Super Admins to do everything
CREATE POLICY "Super Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'super_admin' OR 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
);

-- 5. Verify policies
SELECT * FROM pg_policies WHERE tablename = 'profiles';
