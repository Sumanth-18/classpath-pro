-- Add optional file attachment URL to assignments
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS file_url text;

-- Storage bucket for assignment attachments (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignment-files', 'assignment-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read assignment files (public bucket)
CREATE POLICY "Public read assignment files"
ON storage.objects FOR SELECT
USING (bucket_id = 'assignment-files');

-- Allow authenticated staff (admin/teacher) of the school to upload
CREATE POLICY "Staff upload assignment files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assignment-files'
  AND (
    public.has_role(auth.uid(), 'school_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'teacher'::public.app_role)
  )
);

CREATE POLICY "Staff update assignment files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND (
    public.has_role(auth.uid(), 'school_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'teacher'::public.app_role)
  )
);

CREATE POLICY "Staff delete assignment files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'assignment-files'
  AND (
    public.has_role(auth.uid(), 'school_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'teacher'::public.app_role)
  )
);
