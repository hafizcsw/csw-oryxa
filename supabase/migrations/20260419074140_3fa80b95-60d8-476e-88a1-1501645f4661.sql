-- Force-cleanup orphaned document rows (no matching customer_files).
DELETE FROM public.document_lane_facts
WHERE NOT EXISTS (SELECT 1 FROM public.customer_files cf WHERE cf.id = document_lane_facts.document_id);

DELETE FROM public.document_foundation_outputs
WHERE NOT EXISTS (SELECT 1 FROM public.customer_files cf WHERE cf.id::text = document_foundation_outputs.document_id);

DELETE FROM public.document_analyses
WHERE NOT EXISTS (SELECT 1 FROM public.customer_files cf WHERE cf.id::text = document_analyses.document_id);

DELETE FROM public.extraction_proposals
WHERE NOT EXISTS (SELECT 1 FROM public.customer_files cf WHERE cf.id::text = extraction_proposals.document_id);

-- Add CASCADE-style triggers so future deletions of customer_files clean up automatically.
CREATE OR REPLACE FUNCTION public.cleanup_document_artifacts_on_file_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.document_lane_facts WHERE document_id = OLD.id;
  DELETE FROM public.document_foundation_outputs WHERE document_id = OLD.id::text;
  DELETE FROM public.document_analyses WHERE document_id = OLD.id::text;
  DELETE FROM public.extraction_proposals WHERE document_id = OLD.id::text;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_document_artifacts ON public.customer_files;
CREATE TRIGGER trg_cleanup_document_artifacts
BEFORE DELETE ON public.customer_files
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_document_artifacts_on_file_delete();