-- Fix infinite recursion between students and parent_student RLS policies.
-- Use a SECURITY DEFINER helper to check parent linkage without re-triggering RLS.

CREATE OR REPLACE FUNCTION public.is_parent_of_student(_user_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_student
    WHERE student_id = _student_id AND parent_user_id = _user_id
  );
$$;

-- Replace the recursive parent-facing policies on students
DROP POLICY IF EXISTS "Parents view own children" ON public.students;
CREATE POLICY "Parents view own children"
ON public.students
FOR SELECT
TO authenticated
USING (public.is_parent_of_student(auth.uid(), id));

-- Replace recursive parent policies on attendance
DROP POLICY IF EXISTS "Parents view child attendance" ON public.attendance;
CREATE POLICY "Parents view child attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (public.is_parent_of_student(auth.uid(), student_id));

-- Replace recursive parent policies on fee_dues
DROP POLICY IF EXISTS "Parents view child dues" ON public.fee_dues;
CREATE POLICY "Parents view child dues"
ON public.fee_dues
FOR SELECT
TO authenticated
USING (public.is_parent_of_student(auth.uid(), student_id));

-- Replace recursive parent policies on fee_payments
DROP POLICY IF EXISTS "Parents view child payments" ON public.fee_payments;
CREATE POLICY "Parents view child payments"
ON public.fee_payments
FOR SELECT
TO authenticated
USING (public.is_parent_of_student(auth.uid(), student_id));

-- Replace recursive parent policies on marks
DROP POLICY IF EXISTS "Parents view child marks" ON public.marks;
CREATE POLICY "Parents view child marks"
ON public.marks
FOR SELECT
TO authenticated
USING (public.is_parent_of_student(auth.uid(), student_id));

-- Also simplify parent_student SELECT policy to avoid touching students recursively
DROP POLICY IF EXISTS "View parent_student links" ON public.parent_student;
CREATE POLICY "View parent_student links"
ON public.parent_student
FOR SELECT
TO authenticated
USING (
  parent_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'school_admin'::public.app_role)
);