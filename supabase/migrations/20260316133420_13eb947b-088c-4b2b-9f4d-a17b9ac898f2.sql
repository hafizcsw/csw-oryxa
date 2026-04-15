
-- ORX 2.0 Fact Lifecycle: transition log, audit views, readiness helpers

-- 1) Fact lifecycle transition log
CREATE TABLE IF NOT EXISTS public.orx_fact_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id uuid NOT NULL REFERENCES public.orx_dimension_facts(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  transitioned_by uuid,
  reason text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orx_fact_transitions_fact ON public.orx_fact_transitions(fact_id);
CREATE INDEX idx_orx_fact_transitions_created ON public.orx_fact_transitions(created_at DESC);

ALTER TABLE public.orx_fact_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on transitions"
  ON public.orx_fact_transitions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2) Server-side transition validation function
CREATE OR REPLACE FUNCTION public.orx_transition_fact(
  _fact_id uuid,
  _to_status text,
  _transitioned_by uuid DEFAULT NULL,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_status text;
  _valid_transitions jsonb := '{
    "candidate": ["internal_approved", "rejected"],
    "internal_approved": ["published", "rejected", "stale", "superseded"],
    "rejected": ["candidate"],
    "stale": ["candidate", "superseded"],
    "superseded": [],
    "published": ["stale", "superseded"]
  }'::jsonb;
  _allowed jsonb;
BEGIN
  SELECT status INTO _current_status
  FROM orx_dimension_facts
  WHERE id = _fact_id;

  IF _current_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Fact not found');
  END IF;

  _allowed := _valid_transitions -> _current_status;
  IF _allowed IS NULL OR NOT _allowed ? _to_status THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', format('Invalid transition: %s → %s', _current_status, _to_status),
      'allowed', _allowed
    );
  END IF;

  UPDATE orx_dimension_facts
  SET status = _to_status::orx_dimension_fact_status,
      updated_at = now(),
      last_verified_at = CASE WHEN _to_status IN ('internal_approved', 'published') THEN now() ELSE last_verified_at END
  WHERE id = _fact_id;

  INSERT INTO orx_fact_transitions (fact_id, from_status, to_status, transitioned_by, reason)
  VALUES (_fact_id, _current_status, _to_status, _transitioned_by, _reason);

  RETURN jsonb_build_object(
    'ok', true,
    'fact_id', _fact_id,
    'from_status', _current_status,
    'to_status', _to_status
  );
END;
$$;

-- 3) Internal ops views
CREATE OR REPLACE VIEW public.vw_orx_facts_pending_review AS
SELECT * FROM orx_dimension_facts WHERE status = 'candidate'
ORDER BY created_at DESC;

CREATE OR REPLACE VIEW public.vw_orx_facts_approved_unpublished AS
SELECT * FROM orx_dimension_facts WHERE status = 'internal_approved'
ORDER BY updated_at DESC;

CREATE OR REPLACE VIEW public.vw_orx_facts_published AS
SELECT * FROM orx_dimension_facts WHERE status = 'published'
ORDER BY updated_at DESC;

CREATE OR REPLACE VIEW public.vw_orx_facts_stale AS
SELECT * FROM orx_dimension_facts WHERE status = 'stale'
ORDER BY updated_at DESC;

CREATE OR REPLACE VIEW public.vw_orx_facts_rejected AS
SELECT * FROM orx_dimension_facts WHERE status = 'rejected'
ORDER BY updated_at DESC;

-- 4) QA / Audit summary view
CREATE OR REPLACE VIEW public.vw_orx_facts_audit_summary AS
SELECT
  dimension_domain,
  boundary_type,
  source_family,
  fact_family,
  status,
  COUNT(*) AS fact_count,
  AVG(confidence) AS avg_confidence,
  AVG(coverage_score) AS avg_coverage,
  AVG(comparability_score) AS avg_comparability,
  SUM(CASE WHEN sparsity_flag THEN 1 ELSE 0 END) AS sparsity_flagged,
  SUM(CASE WHEN regional_bias_flag THEN 1 ELSE 0 END) AS regional_bias_flagged,
  MIN(freshness_date) AS oldest_freshness,
  MAX(freshness_date) AS newest_freshness
FROM orx_dimension_facts
GROUP BY dimension_domain, boundary_type, source_family, fact_family, status;

-- 5) Entity coverage summary
CREATE OR REPLACE VIEW public.vw_orx_entity_coverage AS
SELECT
  entity_type,
  entity_id,
  dimension_domain,
  COUNT(*) AS total_facts,
  COUNT(*) FILTER (WHERE status = 'published') AS published_facts,
  COUNT(*) FILTER (WHERE status = 'internal_approved') AS approved_facts,
  COUNT(*) FILTER (WHERE status = 'candidate') AS candidate_facts,
  AVG(confidence) AS avg_confidence,
  AVG(coverage_score) AS avg_coverage,
  AVG(comparability_score) AS avg_comparability,
  BOOL_OR(sparsity_flag) AS has_sparsity,
  BOOL_OR(regional_bias_flag) AS has_regional_bias,
  COUNT(DISTINCT source_family) AS source_diversity,
  COUNT(DISTINCT fact_family) AS fact_family_coverage
FROM orx_dimension_facts
GROUP BY entity_type, entity_id, dimension_domain;

-- 6) Dimension readiness summary
CREATE OR REPLACE VIEW public.vw_orx_dimension_readiness AS
SELECT
  dimension_domain,
  COUNT(*) AS total_facts,
  COUNT(*) FILTER (WHERE status = 'published') AS published_facts,
  COUNT(*) FILTER (WHERE status = 'internal_approved') AS approved_facts,
  COUNT(*) FILTER (WHERE status = 'candidate') AS pending_facts,
  COUNT(DISTINCT entity_id) AS unique_entities,
  COUNT(DISTINCT source_family) AS source_diversity,
  COUNT(DISTINCT fact_family) AS fact_families_covered,
  AVG(confidence) AS avg_confidence,
  AVG(coverage_score) AS avg_coverage,
  AVG(comparability_score) AS avg_comparability,
  SUM(CASE WHEN sparsity_flag THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100 AS sparsity_pct,
  SUM(CASE WHEN regional_bias_flag THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100 AS regional_bias_pct
FROM orx_dimension_facts
GROUP BY dimension_domain;
