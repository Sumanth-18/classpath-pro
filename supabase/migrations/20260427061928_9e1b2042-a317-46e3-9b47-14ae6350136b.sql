-- Allow school admins to insert profiles for staff in their school
CREATE POLICY "Admins insert profiles in school"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  school_id = public.get_user_school_id(auth.uid())
  AND public.has_role(auth.uid(), 'school_admin'::public.app_role)
);

-- Allow school admins to delete profiles in their school (for staff removal)
CREATE POLICY "Admins delete profiles in school"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  school_id = public.get_user_school_id(auth.uid())
  AND public.has_role(auth.uid(), 'school_admin'::public.app_role)
);