
ALTER TABLE public.learning_enrollments
  ADD COLUMN IF NOT EXISTS enrollment_status text NOT NULL DEFAULT 'exploring',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS academic_track text,
  ADD COLUMN IF NOT EXISTS placement_score integer;

COMMENT ON COLUMN public.learning_enrollments.enrollment_status IS 'exploring | path_selected | placement_done | awaiting_payment | active | paused | completed';
COMMENT ON COLUMN public.learning_enrollments.payment_status IS 'unpaid | pending | paid | failed';
