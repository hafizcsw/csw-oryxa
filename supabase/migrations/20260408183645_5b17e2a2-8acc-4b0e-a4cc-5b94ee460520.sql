ALTER TABLE public.institution_page_edits
  DROP CONSTRAINT institution_page_edits_block_type_check;

ALTER TABLE public.institution_page_edits
  ADD CONSTRAINT institution_page_edits_block_type_check
  CHECK (block_type = ANY (ARRAY['about','gallery','cover','logo','contact','social']));