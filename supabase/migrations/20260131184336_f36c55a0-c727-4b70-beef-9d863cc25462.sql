-- Add foreign key constraint for program_id in scholarships table
ALTER TABLE public.scholarships
ADD CONSTRAINT scholarships_program_id_fkey
FOREIGN KEY (program_id) REFERENCES public.programs(id)
ON DELETE SET NULL;