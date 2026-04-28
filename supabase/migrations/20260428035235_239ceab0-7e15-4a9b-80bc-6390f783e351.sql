-- 1. Drop the FK from profiles.user_id -> auth.users so we can create staff placeholders
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- 2. Case-insensitive uniqueness for employee_id within a school
CREATE UNIQUE INDEX IF NOT EXISTS staff_profiles_school_employee_id_ci_unique
  ON public.staff_profiles (school_id, lower(employee_id))
  WHERE employee_id IS NOT NULL;