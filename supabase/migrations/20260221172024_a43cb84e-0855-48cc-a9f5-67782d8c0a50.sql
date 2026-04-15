-- =============================================
-- D4 State Machine: Extend university_enrichment_draft
-- =============================================

-- Add retry tracking + terminal state columns
ALTER TABLE public.university_enrichment_draft
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS last_attempted_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS next_retry_after timestamptz,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_version text;

-- Update status CHECK to include all terminal + transitional states
-- Drop old constraint if exists, then add new one
DO $$ BEGIN
  ALTER TABLE public.university_enrichment_draft 
    DROP CONSTRAINT IF EXISTS university_enrichment_draft_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.university_enrichment_draft
  ADD CONSTRAINT university_enrichment_draft_status_check
  CHECK (status IN (
    'pending',           -- awaiting processing
    'processing',        -- currently being worked on
    'candidate_found',   -- candidate found, awaiting publish decision
    'published',         -- successfully published to universities table (TERMINAL)
    'source_missing',    -- no candidate found after all attempts (TERMINAL)
    'low_confidence',    -- found but confidence too low for auto-publish
    'manual_review',     -- needs human review (TERMINAL until reviewed)
    'conflict',          -- eTLD+1 or value conflict (TERMINAL)
    'blocked',           -- blocked by policy (TERMINAL)
    'retry_scheduled',   -- will retry later
    'retry_exhausted',   -- all retries used, no result (TERMINAL)
    'rejected'           -- legacy: kept for backward compat (TERMINAL)
  ));

-- Index for efficient selection of retryable items
CREATE INDEX IF NOT EXISTS idx_d4_draft_retry
  ON public.university_enrichment_draft (field_name, status, next_retry_after)
  WHERE status IN ('retry_scheduled', 'pending');

-- Index for progress queries
CREATE INDEX IF NOT EXISTS idx_d4_draft_field_status
  ON public.university_enrichment_draft (field_name, status);

-- Index for finalization tracking
CREATE INDEX IF NOT EXISTS idx_d4_draft_finalized
  ON public.university_enrichment_draft (field_name, finalized_at)
  WHERE finalized_at IS NOT NULL;

-- =============================================
-- D4 Target Fields Registry
-- =============================================
CREATE TABLE IF NOT EXISTS public.d4_target_fields (
  field_name text PRIMARY KEY,
  display_name_ar text NOT NULL,
  display_name_en text NOT NULL,
  source_strategy text NOT NULL DEFAULT 'firecrawl_search',
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  max_attempts integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.d4_target_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "d4_target_fields_read_all" ON public.d4_target_fields
  FOR SELECT USING (true);

CREATE POLICY "d4_target_fields_admin_write" ON public.d4_target_fields
  FOR ALL USING (public.is_admin(auth.uid()));

-- Seed the fields
INSERT INTO public.d4_target_fields (field_name, display_name_ar, display_name_en, source_strategy, priority, is_active) VALUES
  ('website', 'الموقع الرسمي', 'Official Website', 'firecrawl_search', 10, true),
  ('founded_year', 'سنة التأسيس', 'Founded Year', 'firecrawl_search', 20, false),
  ('university_type', 'نوع الجامعة', 'University Type', 'firecrawl_search', 30, false),
  ('acceptance_rate', 'معدل القبول', 'Acceptance Rate', 'firecrawl_search', 40, false),
  ('enrolled_students', 'عدد الطلاب', 'Enrolled Students', 'firecrawl_search', 50, false)
ON CONFLICT (field_name) DO NOTHING;

-- =============================================
-- Progress RPC: Per-field stats
-- =============================================
CREATE OR REPLACE FUNCTION public.rpc_d4_field_progress()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target_count AS (
    SELECT COUNT(*) AS total 
    FROM universities 
    WHERE uniranks_slug IS NOT NULL
  ),
  field_stats AS (
    SELECT
      d.field_name,
      COUNT(*) AS total_drafts,
      COUNT(*) FILTER (WHERE d.status = 'published') AS published,
      COUNT(*) FILTER (WHERE d.status = 'source_missing') AS source_missing,
      COUNT(*) FILTER (WHERE d.status = 'conflict') AS conflict,
      COUNT(*) FILTER (WHERE d.status = 'manual_review') AS manual_review,
      COUNT(*) FILTER (WHERE d.status = 'low_confidence') AS low_confidence,
      COUNT(*) FILTER (WHERE d.status = 'blocked') AS blocked,
      COUNT(*) FILTER (WHERE d.status IN ('rejected', 'retry_exhausted')) AS rejected,
      COUNT(*) FILTER (WHERE d.status IN ('retry_scheduled', 'pending')) AS retryable,
      COUNT(*) FILTER (WHERE d.status = 'processing') AS in_progress,
      COUNT(*) FILTER (WHERE d.finalized_at IS NOT NULL) AS finalized,
      ROUND(AVG(d.confidence) FILTER (WHERE d.confidence IS NOT NULL), 3) AS avg_confidence,
      -- Throughput: published in last hour
      COUNT(*) FILTER (WHERE d.status = 'published' AND d.published_at > now() - interval '1 hour') AS published_last_hour,
      -- Finalized in last hour (for ETA)
      COUNT(*) FILTER (WHERE d.finalized_at > now() - interval '1 hour') AS finalized_last_hour
    FROM university_enrichment_draft d
    GROUP BY d.field_name
  )
  SELECT jsonb_build_object(
    'target_universities', (SELECT total FROM target_count),
    'fields', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'field_name', fs.field_name,
          'target', tc.total,
          'published', fs.published,
          'source_missing', fs.source_missing,
          'conflict', fs.conflict,
          'manual_review', fs.manual_review,
          'low_confidence', fs.low_confidence,
          'blocked', fs.blocked,
          'rejected', fs.rejected,
          'retryable', fs.retryable,
          'in_progress', fs.in_progress,
          'finalized', fs.finalized,
          'avg_confidence', fs.avg_confidence,
          'throughput_per_hour', fs.finalized_last_hour,
          'finalized_pct', ROUND((fs.finalized::numeric / NULLIF(tc.total, 0)) * 100, 2),
          'eta_hours', CASE 
            WHEN fs.finalized_last_hour > 0 
            THEN ROUND(((tc.total - fs.finalized)::numeric / fs.finalized_last_hour), 1)
            ELSE NULL 
          END
        )
      )
      FROM field_stats fs, target_count tc
    ),
    'global', (
      SELECT jsonb_build_object(
        'total_items', tc.total * (SELECT COUNT(*) FROM d4_target_fields WHERE is_active),
        'finalized_items', COALESCE(SUM(fs.finalized), 0),
        'published_items', COALESCE(SUM(fs.published), 0),
        'pending_items', COALESCE(SUM(fs.retryable), 0),
        'throughput_per_hour', COALESCE(SUM(fs.finalized_last_hour), 0),
        'finalized_pct', CASE 
          WHEN tc.total * (SELECT COUNT(*) FROM d4_target_fields WHERE is_active) > 0
          THEN ROUND(
            (COALESCE(SUM(fs.finalized), 0)::numeric / 
             (tc.total * (SELECT COUNT(*) FROM d4_target_fields WHERE is_active))) * 100, 2)
          ELSE 0
        END,
        'eta_hours', CASE 
          WHEN COALESCE(SUM(fs.finalized_last_hour), 0) > 0
          THEN ROUND(
            ((tc.total * (SELECT COUNT(*) FROM d4_target_fields WHERE is_active) - COALESCE(SUM(fs.finalized), 0))::numeric / 
             SUM(fs.finalized_last_hour)), 1)
          ELSE NULL
        END
      )
      FROM field_stats fs, target_count tc
      GROUP BY tc.total
    )
  )
  FROM target_count;
$$;

-- Update the simple progress RPC to also return field breakdown
CREATE OR REPLACE FUNCTION public.rpc_d4_progress_website()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'completed', COUNT(*) FILTER (WHERE website IS NOT NULL),
    'remaining', COUNT(*) FILTER (WHERE website IS NULL),
    'total', COUNT(*)
  )
  FROM universities
  WHERE uniranks_slug IS NOT NULL;
$$;
