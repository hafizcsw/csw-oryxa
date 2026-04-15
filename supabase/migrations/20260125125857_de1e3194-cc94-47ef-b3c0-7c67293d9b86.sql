-- Create the trigger that binds the function to programs table
-- Drop if exists first (idempotent)
DROP TRIGGER IF EXISTS enforce_program_publish_requirements ON public.programs;

-- Create BEFORE INSERT OR UPDATE trigger
CREATE TRIGGER enforce_program_publish_requirements
  BEFORE INSERT OR UPDATE ON public.programs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_program_publish_requirements();