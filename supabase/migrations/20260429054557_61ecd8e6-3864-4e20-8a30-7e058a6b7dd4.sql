-- 1. parent phone on students
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_phone TEXT;

-- 2. notes/reason on attendance + unique constraint for upsert
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS notes TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_student_date_unique'
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_student_date_unique UNIQUE (student_id, date);
  END IF;
END $$;

-- 3. Extend attendance_status enum to include late + leave_approved if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'late' AND enumtypid = 'public.attendance_status'::regtype) THEN
    ALTER TYPE public.attendance_status ADD VALUE 'late';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'leave_approved' AND enumtypid = 'public.attendance_status'::regtype) THEN
    ALTER TYPE public.attendance_status ADD VALUE 'leave_approved';
  END IF;
END $$;

-- 4. attendance audit log
CREATE TABLE IF NOT EXISTS public.attendance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  student_id UUID,
  attendance_id UUID,
  action TEXT NOT NULL, -- 'override' | 'past_edit' | 'whatsapp_send'
  date DATE,
  old_status TEXT,
  new_status TEXT,
  reason TEXT,
  payload JSONB,
  performed_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attendance_audit_school_idx ON public.attendance_audit(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS attendance_audit_student_idx ON public.attendance_audit(student_id);

ALTER TABLE public.attendance_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View audit in school"
ON public.attendance_audit FOR SELECT TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Staff insert audit"
ON public.attendance_audit FOR INSERT TO authenticated
WITH CHECK (
  school_id = public.get_user_school_id(auth.uid())
  AND (public.has_role(auth.uid(), 'school_admin'::public.app_role)
       OR public.has_role(auth.uid(), 'teacher'::public.app_role))
  AND performed_by = auth.uid()
);
