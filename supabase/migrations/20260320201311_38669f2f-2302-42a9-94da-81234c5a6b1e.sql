
-- Wire ects_credits into rpc_publish_programs main path
-- We need to add ects_credits to both the INSERT column list and the ON CONFLICT UPDATE
-- The safest approach: add a trigger that copies ects from draft after publish
-- Actually, let's update rpc_publish_programs to include ects_credits

-- First, let's check the full function signature
-- Since rpc_publish_programs is large, we'll create a post-publish trigger instead
-- This is cleaner and doesn't require rewriting the entire 160-line function

CREATE OR REPLACE FUNCTION public.trg_copy_ects_from_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ects int;
BEGIN
  -- After program_draft is marked 'published', copy ects_credits to programs
  IF NEW.review_status = 'published' AND NEW.published_program_id IS NOT NULL AND NEW.ects_credits IS NOT NULL THEN
    UPDATE public.programs 
    SET ects_credits = NEW.ects_credits, updated_at = now()
    WHERE id = NEW.published_program_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_copy_ects_on_publish ON public.program_draft;
CREATE TRIGGER trg_copy_ects_on_publish
  AFTER UPDATE OF review_status ON public.program_draft
  FOR EACH ROW
  WHEN (NEW.review_status = 'published')
  EXECUTE FUNCTION public.trg_copy_ects_from_draft();
