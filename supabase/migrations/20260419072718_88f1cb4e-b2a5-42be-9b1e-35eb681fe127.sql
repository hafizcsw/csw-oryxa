-- Cleanup orphaned document rows whose source file in customer_files no longer exists.
DELETE FROM public.document_foundation_outputs fo
WHERE NOT EXISTS (SELECT 1 FROM public.customer_files cf WHERE cf.id::text = fo.document_id);

DELETE FROM public.document_lane_facts lf
WHERE NOT EXISTS (SELECT 1 FROM public.customer_files cf WHERE cf.id = lf.document_id);

DELETE FROM public.document_analyses da
WHERE NOT EXISTS (SELECT 1 FROM public.customer_files cf WHERE cf.id::text = da.document_id);