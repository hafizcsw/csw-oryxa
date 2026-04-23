ALTER TABLE public.document_lane_facts ADD COLUMN IF NOT EXISTS trace_id text;
ALTER TABLE public.document_review_queue ADD COLUMN IF NOT EXISTS trace_id text;