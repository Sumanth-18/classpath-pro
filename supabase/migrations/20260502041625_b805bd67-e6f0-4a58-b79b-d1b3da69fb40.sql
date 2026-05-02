ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leave_requests_student_id
  ON public.leave_requests(student_id);

-- Backfill from existing reason-encoded student ids
UPDATE public.leave_requests
SET
  student_id = (regexp_match(reason, '^\[Student:\s*([0-9a-fA-F-]+)\]'))[1]::uuid,
  reason = regexp_replace(reason, '^\[Student:\s*[0-9a-fA-F-]+\]\s*', '')
WHERE student_id IS NULL
  AND reason ~ '^\[Student:\s*[0-9a-fA-F-]+\]';