-- Allow any authenticated user to read all profiles.
-- Previously restricted to id = auth.uid(), which caused "?" in chat
-- participant names whenever a join fetched another user's profile.
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);
