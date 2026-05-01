-- Add published flag to exams
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT false;

-- ============== messages ==============
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  student_id UUID NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_student ON public.messages(student_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages(receiver_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Parent: see messages about their own child where they are sender or receiver
CREATE POLICY "Parents view own messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    public.is_parent_of_student(auth.uid(), student_id)
    AND (sender_id = auth.uid() OR receiver_id = auth.uid())
  );

-- Teacher: see messages about students in section where they are class teacher, and they are sender or receiver
CREATE POLICY "Teachers view own messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'teacher')
    AND (sender_id = auth.uid() OR receiver_id = auth.uid())
    AND student_id IN (
      SELECT st.id FROM public.students st
      JOIN public.sections s ON s.id = st.section_id
      WHERE s.class_teacher_id = (
        SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );

-- Admin: view all messages in their school
CREATE POLICY "Admins view messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'school_admin')
  );

-- Insert: sender must be auth.uid() and within school
CREATE POLICY "Send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND school_id = public.get_user_school_id(auth.uid())
  );

-- Update is_read by receiver
CREATE POLICY "Receiver marks read"
  ON public.messages FOR UPDATE TO authenticated
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());

-- ============== homework_submissions ==============
CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL,
  student_id UUID NOT NULL,
  marked_done_by_parent BOOLEAN NOT NULL DEFAULT false,
  marked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_homework_subs_student ON public.homework_submissions(student_id);

ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents view child submissions"
  ON public.homework_submissions FOR SELECT TO authenticated
  USING (public.is_parent_of_student(auth.uid(), student_id));

CREATE POLICY "Parents upsert child submissions"
  ON public.homework_submissions FOR INSERT TO authenticated
  WITH CHECK (public.is_parent_of_student(auth.uid(), student_id));

CREATE POLICY "Parents update child submissions"
  ON public.homework_submissions FOR UPDATE TO authenticated
  USING (public.is_parent_of_student(auth.uid(), student_id))
  WITH CHECK (public.is_parent_of_student(auth.uid(), student_id));

CREATE POLICY "Staff view submissions"
  ON public.homework_submissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students st
      WHERE st.id = homework_submissions.student_id
        AND st.school_id = public.get_user_school_id(auth.uid())
        AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher'))
    )
  );

-- ============== substitute_log ==============
CREATE TABLE IF NOT EXISTS public.substitute_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  section_id UUID NOT NULL,
  substitute_teacher_id UUID NOT NULL,
  date DATE NOT NULL,
  note TEXT,
  logged_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sublog_section_date ON public.substitute_log(section_id, date);

ALTER TABLE public.substitute_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage substitute log"
  ON public.substitute_log FOR ALL TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'school_admin')
  )
  WITH CHECK (
    school_id = public.get_user_school_id(auth.uid())
    AND public.has_role(auth.uid(), 'school_admin')
  );

CREATE POLICY "Staff view substitute log"
  ON public.substitute_log FOR SELECT TO authenticated
  USING (
    school_id = public.get_user_school_id(auth.uid())
    AND (public.has_role(auth.uid(), 'school_admin') OR public.has_role(auth.uid(), 'teacher'))
  );