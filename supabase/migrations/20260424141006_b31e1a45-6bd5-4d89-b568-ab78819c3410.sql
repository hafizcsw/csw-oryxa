-- User has deleted all files in CRM; purge stale Portal-side processing rows.
DELETE FROM public.document_foundation_outputs;
DELETE FROM public.document_lane_facts;
DELETE FROM public.document_review_queue;
DELETE FROM public.document_analyses;