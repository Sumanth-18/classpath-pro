ALTER TABLE public.fee_instalments
  ADD COLUMN IF NOT EXISTS instalment_number INTEGER,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE public.fee_flags
  ADD COLUMN IF NOT EXISTS flagged_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';