ALTER TYPE public.attendance_status 
  ADD VALUE IF NOT EXISTS 'leave_approved';

ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS parent_phone TEXT;

ALTER TABLE public.fee_payments 
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view audit log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'school_admin'));

CREATE POLICY "Anyone in school can insert audit" 
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()));

CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id),
  to_phone TEXT,
  message TEXT,
  trigger_type TEXT,
  status TEXT DEFAULT 'stub',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view whatsapp logs" 
  ON public.whatsapp_logs FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'school_admin'));

CREATE POLICY "Staff insert whatsapp logs" 
  ON public.whatsapp_logs FOR INSERT TO authenticated
  WITH CHECK (school_id = public.get_user_school_id(auth.uid()));

CREATE TABLE IF NOT EXISTS public.fee_instalments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  fee_structure_id UUID NOT NULL REFERENCES public.fee_structures(id) ON DELETE CASCADE,
  instalment_number INT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  due_date DATE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fee_instalments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View fee instalments in school" 
  ON public.fee_instalments FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Admins manage fee instalments" 
  ON public.fee_instalments FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'school_admin'));

CREATE TABLE IF NOT EXISTS public.fee_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  flagged_by UUID REFERENCES public.profiles(id),
  note TEXT,
  status TEXT DEFAULT 'open',
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fee_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view fee flags" ON public.fee_flags
  FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid())
    AND (public.has_role(auth.uid(), 'school_admin')
      OR public.has_role(auth.uid(), 'teacher')));

CREATE POLICY "Teachers insert fee flags" 
  ON public.fee_flags FOR INSERT TO authenticated
  WITH CHECK (school_id = public.get_user_school_id(auth.uid())
    AND (public.has_role(auth.uid(), 'school_admin')
      OR public.has_role(auth.uid(), 'teacher')));

CREATE POLICY "Admins update fee flags" 
  ON public.fee_flags FOR UPDATE TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'school_admin'));

DROP POLICY IF EXISTS "View students in school (admin/teacher)" ON public.students;

CREATE POLICY "Admins view all students" 
  ON public.students FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'school_admin'));

CREATE POLICY "Teachers view own section students"
  ON public.students FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'teacher')
    AND section_id IN (
      SELECT s.id FROM public.sections s
      WHERE s.class_teacher_id = (
        SELECT id FROM public.profiles 
        WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );

DROP POLICY IF EXISTS "Staff manage attendance" ON public.attendance;

CREATE POLICY "Admins manage all attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'school_admin'))
  WITH CHECK (school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'school_admin'));

CREATE POLICY "Teachers manage own section attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'teacher')
    AND section_id IN (
      SELECT s.id FROM public.sections s
      WHERE s.class_teacher_id = (
        SELECT id FROM public.profiles 
        WHERE user_id = auth.uid() LIMIT 1
      )
    )
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'teacher')
    AND section_id IN (
      SELECT s.id FROM public.sections s
      WHERE s.class_teacher_id = (
        SELECT id FROM public.profiles 
        WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );

DROP POLICY IF EXISTS "View marks in school (staff)" ON public.marks;

CREATE POLICY "Admins view all marks"
  ON public.marks FOR SELECT TO authenticated
  USING (school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'school_admin'));

CREATE POLICY "Teachers view own section marks"
  ON public.marks FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'teacher')
    AND student_id IN (
      SELECT st.id FROM public.students st
      JOIN public.sections s ON s.id = st.section_id
      WHERE s.class_teacher_id = (
        SELECT id FROM public.profiles 
        WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );

CREATE POLICY "Teachers view section fee dues"
  ON public.fee_dues FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'teacher')
    AND student_id IN (
      SELECT st.id FROM public.students st
      JOIN public.sections s ON s.id = st.section_id
      WHERE s.class_teacher_id = (
        SELECT id FROM public.profiles 
        WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );