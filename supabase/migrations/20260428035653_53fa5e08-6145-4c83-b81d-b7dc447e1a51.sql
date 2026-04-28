ALTER TABLE public.staff_profiles
DROP CONSTRAINT IF EXISTS staff_profiles_user_id_fkey;

CREATE UNIQUE INDEX IF NOT EXISTS staff_profiles_school_employee_id_ci_unique
ON public.staff_profiles (school_id, lower(employee_id))
WHERE employee_id IS NOT NULL;