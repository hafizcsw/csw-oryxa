
-- ============================================================
-- DOOR 4: University Enrichment Pipeline
-- Phase 1: website enrichment with full provenance
-- ============================================================

-- 1) Enrichment drafts table (stores all proposed enrichments)
CREATE TABLE public.university_enrichment_draft (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  university_id UUID NOT NULL REFERENCES public.universities(id),
  field_name TEXT NOT NULL,
  proposed_value TEXT,
  source_name TEXT NOT NULL,
  source_url TEXT,
  evidence_snippet TEXT,
  confidence NUMERIC(3,2) DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','published','rejected','conflict')),
  reject_reason TEXT,
  trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  published_at TIMESTAMPTZ,
  published_by UUID
);

-- Indexes for selector queue and lookups
CREATE INDEX idx_enrichment_draft_university ON public.university_enrichment_draft(university_id);
CREATE INDEX idx_enrichment_draft_status ON public.university_enrichment_draft(status, field_name);
CREATE INDEX idx_enrichment_draft_field ON public.university_enrichment_draft(field_name, university_id);
CREATE UNIQUE INDEX idx_enrichment_draft_dedup ON public.university_enrichment_draft(university_id, field_name, source_name) WHERE status NOT IN ('rejected');

-- RLS
ALTER TABLE public.university_enrichment_draft ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage enrichment drafts"
  ON public.university_enrichment_draft FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can read enrichment drafts"
  ON public.university_enrichment_draft FOR SELECT
  USING (auth.role() = 'authenticated');

-- 2) Field provenance table (tracks source of each enriched field on universities)
CREATE TABLE public.university_field_provenance (
  university_id UUID NOT NULL REFERENCES public.universities(id),
  field_name TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT,
  confidence NUMERIC(3,2),
  enrichment_draft_id UUID REFERENCES public.university_enrichment_draft(id),
  trace_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  PRIMARY KEY (university_id, field_name)
);

ALTER TABLE public.university_field_provenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage field provenance"
  ON public.university_field_provenance FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can read field provenance"
  ON public.university_field_provenance FOR SELECT
  USING (auth.role() = 'authenticated');

-- 3) Selector RPC: picks universities needing enrichment for a given field
CREATE OR REPLACE FUNCTION public.rpc_d4_select_enrichment_targets(
  p_field_name TEXT DEFAULT 'website',
  p_limit INT DEFAULT 50,
  p_cooldown_hours INT DEFAULT 24
)
RETURNS TABLE (
  university_id UUID,
  university_name TEXT,
  uniranks_slug TEXT,
  uniranks_rank INT,
  programs_count BIGINT,
  last_attempt_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS university_id,
    u.name AS university_name,
    u.uniranks_slug,
    u.uniranks_rank::int,
    COALESCE(pc.cnt, 0) AS programs_count,
    latest.last_attempt_at
  FROM universities u
  LEFT JOIN LATERAL (
    SELECT count(*) AS cnt FROM programs p WHERE p.university_id = u.id AND p.publish_status = 'published'
  ) pc ON true
  LEFT JOIN LATERAL (
    SELECT max(ed.created_at) AS last_attempt_at
    FROM university_enrichment_draft ed
    WHERE ed.university_id = u.id AND ed.field_name = p_field_name
  ) latest ON true
  WHERE u.uniranks_slug IS NOT NULL
    AND (
      (p_field_name = 'website' AND (u.website IS NULL OR u.website = ''))
      OR (p_field_name = 'acceptance_rate' AND u.acceptance_rate IS NULL)
      OR (p_field_name = 'university_type' AND (u.university_type IS NULL OR u.university_type = ''))
      OR (p_field_name = 'enrolled_students' AND u.enrolled_students IS NULL)
    )
    AND (latest.last_attempt_at IS NULL OR latest.last_attempt_at < now() - (p_cooldown_hours || ' hours')::interval)
  ORDER BY
    COALESCE(pc.cnt, 0) DESC,
    u.uniranks_rank ASC NULLS LAST
  LIMIT p_limit;
END;
$$;

-- 4) Publish RPC: safely writes enrichment value to universities with provenance
CREATE OR REPLACE FUNCTION public.rpc_d4_publish_enrichment(
  p_draft_id UUID,
  p_force BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_draft RECORD;
  v_current_value TEXT;
  v_result JSONB;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Fetch draft
  SELECT * INTO v_draft FROM university_enrichment_draft WHERE id = p_draft_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'draft_not_found_or_not_pending');
  END IF;

  -- Check current value (only website for Phase 1)
  IF v_draft.field_name = 'website' THEN
    SELECT website INTO v_current_value FROM universities WHERE id = v_draft.university_id;
  ELSIF v_draft.field_name = 'acceptance_rate' THEN
    SELECT acceptance_rate::text INTO v_current_value FROM universities WHERE id = v_draft.university_id;
  ELSIF v_draft.field_name = 'university_type' THEN
    SELECT university_type INTO v_current_value FROM universities WHERE id = v_draft.university_id;
  ELSIF v_draft.field_name = 'enrolled_students' THEN
    SELECT enrolled_students::text INTO v_current_value FROM universities WHERE id = v_draft.university_id;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'unsupported_field: ' || v_draft.field_name);
  END IF;

  -- No-overwrite policy (unless force or null)
  IF v_current_value IS NOT NULL AND v_current_value != '' AND NOT p_force THEN
    UPDATE university_enrichment_draft SET status = 'conflict', reviewed_at = now() WHERE id = p_draft_id;
    RETURN jsonb_build_object('ok', false, 'error', 'field_already_set', 'current_value', v_current_value);
  END IF;

  -- Apply update
  IF v_draft.field_name = 'website' THEN
    UPDATE universities SET website = v_draft.proposed_value WHERE id = v_draft.university_id;
  ELSIF v_draft.field_name = 'acceptance_rate' THEN
    UPDATE universities SET acceptance_rate = v_draft.proposed_value::numeric WHERE id = v_draft.university_id;
  ELSIF v_draft.field_name = 'university_type' THEN
    UPDATE universities SET university_type = v_draft.proposed_value WHERE id = v_draft.university_id;
  ELSIF v_draft.field_name = 'enrolled_students' THEN
    UPDATE universities SET enrolled_students = v_draft.proposed_value::int WHERE id = v_draft.university_id;
  END IF;

  -- Mark draft published
  UPDATE university_enrichment_draft
    SET status = 'published', published_at = now(), published_by = auth.uid()
    WHERE id = p_draft_id;

  -- Upsert provenance
  INSERT INTO university_field_provenance (university_id, field_name, source_name, source_url, confidence, enrichment_draft_id, trace_id, updated_at, updated_by)
  VALUES (v_draft.university_id, v_draft.field_name, v_draft.source_name, v_draft.source_url, v_draft.confidence, p_draft_id, v_draft.trace_id, now(), auth.uid())
  ON CONFLICT (university_id, field_name) DO UPDATE SET
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    confidence = EXCLUDED.confidence,
    enrichment_draft_id = EXCLUDED.enrichment_draft_id,
    trace_id = EXCLUDED.trace_id,
    updated_at = EXCLUDED.updated_at,
    updated_by = EXCLUDED.updated_by;

  -- Telemetry
  INSERT INTO pipeline_health_events (pipeline, event, stage, trace_id, meta)
  VALUES ('d4_enrichment', 'field_published', v_draft.field_name,
    v_draft.trace_id,
    jsonb_build_object(
      'university_id', v_draft.university_id,
      'field', v_draft.field_name,
      'value', v_draft.proposed_value,
      'source', v_draft.source_name,
      'confidence', v_draft.confidence,
      'previous_value', v_current_value
    )
  );

  RETURN jsonb_build_object('ok', true, 'published', v_draft.field_name, 'university_id', v_draft.university_id);
END;
$$;
