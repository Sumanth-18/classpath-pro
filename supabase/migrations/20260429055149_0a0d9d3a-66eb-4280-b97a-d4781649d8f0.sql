-- 1. multi-class applicability for a fee structure
CREATE TABLE IF NOT EXISTS public.fee_structure_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_structure_id UUID NOT NULL,
  class_id UUID NOT NULL,
  school_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fee_structure_id, class_id)
);
CREATE INDEX IF NOT EXISTS fsc_school_idx ON public.fee_structure_classes(school_id);
CREATE INDEX IF NOT EXISTS fsc_struct_idx ON public.fee_structure_classes(fee_structure_id);

ALTER TABLE public.fee_structure_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage fsc"
ON public.fee_structure_classes FOR ALL TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'::public.app_role))
WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'::public.app_role));

CREATE POLICY "View fsc in school"
ON public.fee_structure_classes FOR SELECT TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()));


-- 2. instalment plan
CREATE TABLE IF NOT EXISTS public.fee_instalments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_structure_id UUID NOT NULL,
  school_id UUID NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  due_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fi_school_idx ON public.fee_instalments(school_id);
CREATE INDEX IF NOT EXISTS fi_struct_idx ON public.fee_instalments(fee_structure_id);

ALTER TABLE public.fee_instalments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage instalments"
ON public.fee_instalments FOR ALL TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'::public.app_role))
WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'::public.app_role));

CREATE POLICY "View instalments in school"
ON public.fee_instalments FOR SELECT TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()));


-- 3. teacher flags for admin follow-up
CREATE TABLE IF NOT EXISTS public.fee_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL,
  student_id UUID NOT NULL,
  raised_by UUID NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ff_school_idx ON public.fee_flags(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ff_student_idx ON public.fee_flags(student_id);

ALTER TABLE public.fee_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage flags"
ON public.fee_flags FOR ALL TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'::public.app_role))
WITH CHECK (school_id = public.get_user_school_id(auth.uid()) AND public.has_role(auth.uid(), 'school_admin'::public.app_role));

CREATE POLICY "Teachers raise flags"
ON public.fee_flags FOR INSERT TO authenticated
WITH CHECK (
  school_id = public.get_user_school_id(auth.uid())
  AND raised_by = auth.uid()
  AND (public.has_role(auth.uid(), 'teacher'::public.app_role) OR public.has_role(auth.uid(), 'school_admin'::public.app_role))
);

CREATE POLICY "Staff view flags in school"
ON public.fee_flags FOR SELECT TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  AND (public.has_role(auth.uid(), 'school_admin'::public.app_role) OR public.has_role(auth.uid(), 'teacher'::public.app_role))
);


-- 4. payment extras
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS receipt_url TEXT;


-- 5. private storage bucket for receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('fee-receipts', 'fee-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: file path convention is {school_id}/{student_id}/{filename}
CREATE POLICY "Admins read receipts in school"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'fee-receipts'
  AND (storage.foldername(name))[1]::uuid = public.get_user_school_id(auth.uid())
  AND public.has_role(auth.uid(), 'school_admin'::public.app_role)
);

CREATE POLICY "Parents read own child receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'fee-receipts'
  AND public.is_parent_of_student(auth.uid(), (storage.foldername(name))[2]::uuid)
);

-- Service role does writes from edge function; no client write policy needed.
