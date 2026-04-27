-- Prevent duplicate admission numbers within the same school
ALTER TABLE public.students
ADD CONSTRAINT students_school_admission_unique UNIQUE (school_id, admission_number);