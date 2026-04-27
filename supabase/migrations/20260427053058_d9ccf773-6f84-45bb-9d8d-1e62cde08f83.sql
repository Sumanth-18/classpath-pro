-- Drop both possible prior unique constraints
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_school_admission_unique;
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_school_id_admission_number_key;
DROP INDEX IF EXISTS public.students_school_admission_ci_unique;

-- Normalize existing admission numbers to uppercase (only active rows to avoid colliding with the inactive duplicates)
UPDATE public.students
SET admission_number = upper(admission_number)
WHERE is_active = true AND admission_number <> upper(admission_number);

-- Case-insensitive unique admission number per school, only enforced on active students
CREATE UNIQUE INDEX students_school_admission_ci_unique
ON public.students (school_id, lower(admission_number))
WHERE is_active = true;