
-- 1. Add invite tracking columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invite_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS invited_at timestamptz;

-- For existing profiles that have a real auth user, mark them active
UPDATE public.profiles p
SET invite_status = 'active'
WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);

-- 2. Clean up orphan rows from previous broken attempts
DELETE FROM public.staff_profiles s
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = s.user_id);

DELETE FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);

-- 3. Re-add foreign keys (skip if already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_profiles_user_id_fkey'
  ) THEN
    ALTER TABLE public.staff_profiles
      ADD CONSTRAINT staff_profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Trigger: when a user signs in for the first time, mark their profile active
CREATE OR REPLACE FUNCTION public.mark_profile_active_on_signin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.last_sign_in_at IS NULL AND NEW.last_sign_in_at IS NOT NULL)
     OR (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at AND NEW.last_sign_in_at IS NOT NULL) THEN
    UPDATE public.profiles
    SET invite_status = 'active'
    WHERE user_id = NEW.id AND invite_status <> 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_signin_mark_active ON auth.users;
CREATE TRIGGER on_auth_user_signin_mark_active
AFTER UPDATE OF last_sign_in_at ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.mark_profile_active_on_signin();
