-- ============================================================
-- Crawler v2 Foundation Schema
-- New unified crawler / evidence factory tables.
-- Does NOT touch: universities, programs, university_media,
--   orx_scores, or existing orx_evidence rows.
-- No publish logic. No AI extraction. No browser rendering.
-- ============================================================

-- ============================================================
-- A) crawler_runs
-- Top-level crawl run record.
-- ============================================================
CREATE TABLE public.crawler_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('all','country','university','custom_list')),
  mode text NOT NULL DEFAULT 'missing_or_stale' CHECK (mode IN (
    'missing_or_stale','failed_only','full_refresh',
    'evidence_only','orx_only','media_only','programs_only','housing_only'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','queued','running','paused','completed','failed','cancelled'
  )),
  created_by uuid NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  total_targets integer NOT NULL DEFAULT 0,
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  filters_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  trace_id text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crawler_runs_status_created ON public.crawler_runs (status, created_at DESC);
CREATE INDEX idx_crawler_runs_scope_mode ON public.crawler_runs (scope, mode);
CREATE INDEX idx_crawler_runs_trace_id ON public.crawler_runs (trace_id);

ALTER TABLE public.crawler_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crawler_runs_service_full" ON public.crawler_runs
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_crawler_runs_updated_at
  BEFORE UPDATE ON public.crawler_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- B) crawler_run_items
-- One university inside a run.
-- ============================================================
CREATE TABLE public.crawler_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.crawler_runs(id) ON DELETE CASCADE,
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  website text NULL,
  target_domain text NULL,
  target_id uuid NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued','website_check','fetching','rendering_needed','rendering',
    'artifact_discovery','artifact_parsing','extracting','ai_extracting',
    'evidence_created','draft_created','needs_review','verified',
    'failed','published','rejected','deleted'
  )),
  stage text NULL,
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  failure_reason text NULL CHECK (failure_reason IN (
    'missing_website','invalid_website','aggregator_domain','country_domain_mismatch',
    'http_403','http_404','http_500','timeout','cloudflare_block','js_render_required',
    'render_failed','empty_content','pdf_parse_failed','no_programs_found',
    'no_evidence_found','extraction_failed','low_confidence','entity_mismatch',
    'publish_blocked','orx_mapping_failed'
  )),
  failure_detail text NULL,
  retry_count integer NOT NULL DEFAULT 0,
  pages_found integer NOT NULL DEFAULT 0,
  pages_fetched integer NOT NULL DEFAULT 0,
  pages_rendered integer NOT NULL DEFAULT 0,
  artifacts_found integer NOT NULL DEFAULT 0,
  artifacts_parsed integer NOT NULL DEFAULT 0,
  evidence_count integer NOT NULL DEFAULT 0,
  evidence_verified_count integer NOT NULL DEFAULT 0,
  draft_count integer NOT NULL DEFAULT 0,
  orx_signal_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  trace_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_crawler_run_items_run_uni UNIQUE (run_id, university_id)
);

CREATE INDEX idx_crawler_run_items_run_status ON public.crawler_run_items (run_id, status);
CREATE INDEX idx_crawler_run_items_university ON public.crawler_run_items (university_id);
CREATE INDEX idx_crawler_run_items_status_updated ON public.crawler_run_items (status, updated_at DESC);
CREATE INDEX idx_crawler_run_items_failure_reason ON public.crawler_run_items (failure_reason) WHERE failure_reason IS NOT NULL;
CREATE INDEX idx_crawler_run_items_trace_id ON public.crawler_run_items (trace_id);

ALTER TABLE public.crawler_run_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crawler_run_items_service_full" ON public.crawler_run_items
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_crawler_run_items_updated_at
  BEFORE UPDATE ON public.crawler_run_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- C) crawler_targets
-- Official/internal crawl target URL for a university.
-- ============================================================
CREATE TABLE public.crawler_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  target_url text NOT NULL,
  target_domain text NOT NULL,
  target_type text NOT NULL DEFAULT 'primary_website' CHECK (target_type IN (
    'primary_website','fallback_website','repair_website','manual_override'
  )),
  status text NOT NULL DEFAULT 'active' CHECK (status IN (
    'active','invalid','aggregator','blocked','deprecated'
  )),
  source text NOT NULL DEFAULT 'universities_table' CHECK (source IN (
    'universities_table','website_resolver','manual_entry','repair_discovery'
  )),
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_0_100 integer NULL CHECK (confidence_0_100 >= 0 AND confidence_0_100 <= 100),
  last_checked_at timestamptz NULL,
  last_check_status text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_crawler_targets_uni_url UNIQUE (university_id, target_url)
);

CREATE INDEX idx_crawler_targets_uni_type ON public.crawler_targets (university_id, target_type);
CREATE INDEX idx_crawler_targets_status ON public.crawler_targets (status);
CREATE INDEX idx_crawler_targets_domain ON public.crawler_targets (target_domain);

ALTER TABLE public.crawler_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crawler_targets_service_full" ON public.crawler_targets
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_crawler_targets_updated_at
  BEFORE UPDATE ON public.crawler_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- D) crawler_locks
-- Prevent concurrent run on same university/country/resource.
-- ============================================================
CREATE TABLE public.crawler_locks (
  resource_type text NOT NULL CHECK (resource_type IN ('university','country','run','target')),
  resource_id text NOT NULL,
  lock_holder text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  lock_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (resource_type, resource_id)
);

CREATE INDEX idx_crawler_locks_expires_at ON public.crawler_locks (expires_at);
CREATE INDEX idx_crawler_locks_holder ON public.crawler_locks (lock_holder);

ALTER TABLE public.crawler_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crawler_locks_service_full" ON public.crawler_locks
  FOR ALL USING (true) WITH CHECK (true);

-- Helper: cleanup expired locks
CREATE OR REPLACE FUNCTION public.cleanup_expired_crawler_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.crawler_locks WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_expired_crawler_locks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_crawler_locks() TO service_role;

-- ============================================================
-- E) crawler_telemetry
-- Per-run/per-item telemetry and debug events.
-- ============================================================
CREATE TABLE public.crawler_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz NOT NULL DEFAULT now(),
  run_id uuid NULL REFERENCES public.crawler_runs(id) ON DELETE CASCADE,
  run_item_id uuid NULL REFERENCES public.crawler_run_items(id) ON DELETE CASCADE,
  stage text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'started','completed','failed','warning','metric'
  )),
  duration_ms integer NULL,
  success boolean NULL,
  error_type text NULL,
  error_message text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  trace_id text NOT NULL
);

CREATE INDEX idx_crawler_telemetry_run_ts ON public.crawler_telemetry (run_id, timestamp DESC);
CREATE INDEX idx_crawler_telemetry_ts ON public.crawler_telemetry (timestamp DESC);
CREATE INDEX idx_crawler_telemetry_stage_event ON public.crawler_telemetry (stage, event_type);
CREATE INDEX idx_crawler_telemetry_error_type ON public.crawler_telemetry (error_type) WHERE error_type IS NOT NULL;
CREATE INDEX idx_crawler_telemetry_trace_id ON public.crawler_telemetry (trace_id);

ALTER TABLE public.crawler_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crawler_telemetry_service_full" ON public.crawler_telemetry
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- F) evidence_items
-- Canonical evidence store for new Crawler v2 output.
-- NO hard unique constraint on (content_hash, university_id, source_url).
-- A single page may produce multiple facts.
-- ============================================================
CREATE TABLE public.evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawler_run_id uuid NOT NULL REFERENCES public.crawler_runs(id) ON DELETE CASCADE,
  crawler_run_item_id uuid NOT NULL REFERENCES public.crawler_run_items(id) ON DELETE CASCADE,
  target_id uuid NULL REFERENCES public.crawler_targets(id),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,

  -- Entity
  entity_type text NOT NULL CHECK (entity_type IN (
    'university','program','housing','media','leadership','research','country'
  )),
  entity_id uuid NULL,
  entity_match_status text NOT NULL DEFAULT 'pending' CHECK (entity_match_status IN (
    'pending','matched','ambiguous','no_match','manual_review'
  )),

  -- Evidence
  fact_group text NOT NULL,
  field_key text NOT NULL,
  value_raw text NOT NULL,
  value_normalized text NULL,
  evidence_quote text NULL,
  evidence_quote_hash text NULL,
  evidence_quote_length integer NULL,
  evidence_quote_storage_url text NULL,

  -- Source
  source_url text NOT NULL,
  source_domain text NOT NULL,
  raw_page_id bigint NULL REFERENCES public.raw_pages(id),
  artifact_id uuid NULL REFERENCES public.crawl_file_artifacts(id),
  content_hash text NOT NULL,
  language_code text NULL,

  -- Quality
  confidence_0_100 integer NOT NULL CHECK (confidence_0_100 >= 0 AND confidence_0_100 <= 100),
  confidence_scale_version text NOT NULL DEFAULT 'v2_0_100',
  legacy_confidence_0_1 real NULL,
  trust_level text NOT NULL DEFAULT 'unverified' CHECK (trust_level IN (
    'official','verified','inferred','unverified'
  )),
  contextual_only boolean NOT NULL DEFAULT false,
  freshness_date timestamptz NULL,

  -- Extraction metadata
  extraction_method text NOT NULL CHECK (extraction_method IN (
    'static_fetch','rendered_fetch','pdf_parse','ai_extraction',
    'regex_extraction','sitemap_discovery','manual_entry'
  )),
  extractor_version text NULL,
  model_provider text NULL,
  model_name text NULL,
  prompt_version text NULL,

  -- Workflow
  validation_status text NOT NULL DEFAULT 'pending' CHECK (validation_status IN (
    'pending','valid','invalid','needs_review'
  )),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN (
    'pending','verified','rejected','needs_revision','contextual'
  )),
  publish_status text NOT NULL DEFAULT 'unpublished' CHECK (publish_status IN (
    'unpublished','published','superseded','deleted'
  )),

  -- ORX bridge (populated later by orx_mapping phase)
  orx_layer text NULL CHECK (orx_layer IN ('country','university','program')),
  orx_signal_family text NULL,
  orx_evidence_id uuid NULL REFERENCES public.orx_evidence(id),

  -- Legacy compatibility
  legacy_source_table text NULL,
  legacy_source_id text NULL,

  -- Tracing
  trace_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Phase 1 indexes only — no unique constraint on (content_hash, university_id, source_url)
CREATE INDEX idx_evidence_items_run_item ON public.evidence_items (crawler_run_id, crawler_run_item_id);
CREATE INDEX idx_evidence_items_university ON public.evidence_items (university_id);
CREATE INDEX idx_evidence_items_entity ON public.evidence_items (entity_type, entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_evidence_items_fact ON public.evidence_items (fact_group, field_key);
CREATE INDEX idx_evidence_items_review_publish ON public.evidence_items (review_status, publish_status);
CREATE INDEX idx_evidence_items_orx ON public.evidence_items (orx_layer, orx_signal_family) WHERE orx_layer IS NOT NULL;
CREATE INDEX idx_evidence_items_confidence ON public.evidence_items (confidence_0_100) WHERE confidence_0_100 >= 70;
CREATE INDEX idx_evidence_items_content_hash ON public.evidence_items (content_hash);
CREATE INDEX idx_evidence_items_source ON public.evidence_items (source_domain, source_url);
CREATE INDEX idx_evidence_items_legacy ON public.evidence_items (legacy_source_table, legacy_source_id) WHERE legacy_source_table IS NOT NULL;

ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence_items_service_full" ON public.evidence_items
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_evidence_items_updated_at
  BEFORE UPDATE ON public.evidence_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- G) evidence_validation_rules
-- Configurable evidence validation.
-- ============================================================
CREATE TABLE public.evidence_validation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL UNIQUE,
  fact_group text NOT NULL,
  field_key text NOT NULL,
  validation_type text NOT NULL CHECK (validation_type IN (
    'regex_pattern','value_range','value_list','url_pattern',
    'date_range','entity_lookup','cross_field','ai_verification'
  )),
  regex_pattern text NULL,
  min_value numeric NULL,
  max_value numeric NULL,
  allowed_values jsonb NULL,
  reference_table text NULL,
  reference_column text NULL,
  custom_logic jsonb NULL,
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('error','warning','info')),
  auto_reject boolean NOT NULL DEFAULT false,
  requires_manual_review boolean NOT NULL DEFAULT false,
  description text NULL,
  examples jsonb NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_evr_fact_field_type UNIQUE (fact_group, field_key, validation_type)
);

ALTER TABLE public.evidence_validation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence_validation_rules_service_full" ON public.evidence_validation_rules
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- H) publish_audit_trail
-- Future publish audit. No publish logic in this batch.
-- entity_id is nullable — some draft/entity references may be bigint or text.
-- ============================================================
CREATE TABLE public.publish_audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid NULL,
  entity_type text NOT NULL,
  entity_uuid uuid NULL,
  entity_text_id text NULL,
  draft_ref jsonb NULL,
  evidence_item_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  action text NOT NULL CHECK (action IN (
    'publish','reject','delete_run_output','supersede'
  )),
  confidence_min integer NULL,
  confidence_avg integer NULL,
  before_snapshot jsonb NULL,
  after_snapshot jsonb NULL,
  rollback_snapshot jsonb NULL,
  trace_id text NOT NULL
);

CREATE INDEX idx_publish_audit_entity ON public.publish_audit_trail (entity_type, entity_uuid);
CREATE INDEX idx_publish_audit_at ON public.publish_audit_trail (published_at DESC);
CREATE INDEX idx_publish_audit_trace ON public.publish_audit_trail (trace_id);

ALTER TABLE public.publish_audit_trail ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publish_audit_trail_service_full" ON public.publish_audit_trail
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- I) program_curriculum_draft
-- Program-level curriculum/module evidence.
-- program_draft_id is bigint (program_draft.id = BIGSERIAL).
-- ============================================================
CREATE TABLE public.program_curriculum_draft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_draft_id bigint NOT NULL REFERENCES public.program_draft(id) ON DELETE CASCADE,
  evidence_item_id uuid NOT NULL REFERENCES public.evidence_items(id) ON DELETE CASCADE,
  curriculum_type text NOT NULL CHECK (curriculum_type IN (
    'module','course','internship','capstone','project',
    'requirement','elective','specialization'
  )),
  module_name text NULL,
  module_code text NULL,
  semester integer NULL,
  credits numeric NULL,
  description text NULL,
  ai_exposure_detected boolean NOT NULL DEFAULT false,
  applied_learning_detected boolean NOT NULL DEFAULT false,
  future_skill_detected boolean NOT NULL DEFAULT false,
  orx_signal_family text NULL,
  orx_signal_strength integer NULL CHECK (orx_signal_strength >= 0 AND orx_signal_strength <= 100),
  confidence_0_100 integer NULL CHECK (confidence_0_100 >= 0 AND confidence_0_100 <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_curriculum_draft_prog_ev UNIQUE (program_draft_id, evidence_item_id)
);

CREATE INDEX idx_curriculum_draft_program ON public.program_curriculum_draft (program_draft_id);
CREATE INDEX idx_curriculum_draft_evidence ON public.program_curriculum_draft (evidence_item_id);
CREATE INDEX idx_curriculum_draft_orx ON public.program_curriculum_draft (orx_signal_family) WHERE orx_signal_family IS NOT NULL;
CREATE INDEX idx_curriculum_draft_ai ON public.program_curriculum_draft (ai_exposure_detected) WHERE ai_exposure_detected = true;

ALTER TABLE public.program_curriculum_draft ENABLE ROW LEVEL SECURITY;
CREATE POLICY "program_curriculum_draft_service_full" ON public.program_curriculum_draft
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- J) Housing draft tables
-- ============================================================

CREATE TABLE public.housing_draft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  crawler_run_id uuid NOT NULL REFERENCES public.crawler_runs(id) ON DELETE CASCADE,
  crawler_run_item_id uuid NOT NULL REFERENCES public.crawler_run_items(id) ON DELETE CASCADE,
  housing_name text NOT NULL,
  housing_type text NULL,
  location_address text NULL,
  latitude real NULL,
  longitude real NULL,
  distance_to_campus_km real NULL,
  capacity integer NULL,
  available_spaces integer NULL,
  facilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  eligibility_text text NULL,
  international_students_allowed boolean NULL,
  primary_evidence_id uuid NULL REFERENCES public.evidence_items(id),
  review_status text NOT NULL DEFAULT 'pending',
  publish_status text NOT NULL DEFAULT 'unpublished',
  trace_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_housing_draft_university ON public.housing_draft (university_id);
CREATE INDEX idx_housing_draft_run ON public.housing_draft (crawler_run_id);

ALTER TABLE public.housing_draft ENABLE ROW LEVEL SECURITY;
CREATE POLICY "housing_draft_service_full" ON public.housing_draft
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_housing_draft_updated_at
  BEFORE UPDATE ON public.housing_draft
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- --

CREATE TABLE public.housing_price_draft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  housing_draft_id uuid NOT NULL REFERENCES public.housing_draft(id) ON DELETE CASCADE,
  evidence_item_id uuid NULL REFERENCES public.evidence_items(id),
  room_type text NOT NULL,
  price_amount numeric NOT NULL CHECK (price_amount >= 0),
  currency text NOT NULL,
  period text NOT NULL CHECK (period IN ('monthly','semester','yearly','one_time')),
  includes text[] NOT NULL DEFAULT '{}',
  excludes text[] NOT NULL DEFAULT '{}',
  confidence_0_100 integer NULL CHECK (confidence_0_100 >= 0 AND confidence_0_100 <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_housing_price_draft_housing ON public.housing_price_draft (housing_draft_id);

ALTER TABLE public.housing_price_draft ENABLE ROW LEVEL SECURITY;
CREATE POLICY "housing_price_draft_service_full" ON public.housing_price_draft
  FOR ALL USING (true) WITH CHECK (true);

-- --

CREATE TABLE public.housing_media_draft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  housing_draft_id uuid NOT NULL REFERENCES public.housing_draft(id) ON DELETE CASCADE,
  evidence_item_id uuid NULL REFERENCES public.evidence_items(id),
  media_type text NULL,
  media_url text NOT NULL,
  storage_path text NULL,
  caption text NULL,
  is_official boolean NOT NULL DEFAULT true,
  confidence_0_100 integer NULL CHECK (confidence_0_100 >= 0 AND confidence_0_100 <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_housing_media_draft_housing ON public.housing_media_draft (housing_draft_id);

ALTER TABLE public.housing_media_draft ENABLE ROW LEVEL SECURITY;
CREATE POLICY "housing_media_draft_service_full" ON public.housing_media_draft
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- K) leadership_draft
-- ============================================================
CREATE TABLE public.leadership_draft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  crawler_run_id uuid NOT NULL REFERENCES public.crawler_runs(id) ON DELETE CASCADE,
  crawler_run_item_id uuid NOT NULL REFERENCES public.crawler_run_items(id) ON DELETE CASCADE,
  role text NULL,
  person_name text NOT NULL,
  title text NULL,
  bio text NULL,
  photo_url text NULL,
  primary_evidence_id uuid NULL REFERENCES public.evidence_items(id),
  review_status text NOT NULL DEFAULT 'pending',
  publish_status text NOT NULL DEFAULT 'unpublished',
  trace_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_leadership_draft_university ON public.leadership_draft (university_id);
CREATE INDEX idx_leadership_draft_run ON public.leadership_draft (crawler_run_id);

ALTER TABLE public.leadership_draft ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leadership_draft_service_full" ON public.leadership_draft
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_leadership_draft_updated_at
  BEFORE UPDATE ON public.leadership_draft
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- L) media_draft
-- ============================================================
CREATE TABLE public.media_draft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  crawler_run_id uuid NOT NULL REFERENCES public.crawler_runs(id) ON DELETE CASCADE,
  crawler_run_item_id uuid NOT NULL REFERENCES public.crawler_run_items(id) ON DELETE CASCADE,
  entity_type text NULL,
  entity_draft_ref jsonb NULL,
  media_type text NULL,
  source_url text NOT NULL,
  storage_path text NULL,
  public_url text NULL,
  alt_text text NULL,
  caption text NULL,
  is_official boolean NOT NULL DEFAULT true,
  confidence_0_100 integer NULL CHECK (confidence_0_100 >= 0 AND confidence_0_100 <= 100),
  review_status text NOT NULL DEFAULT 'pending',
  publish_status text NOT NULL DEFAULT 'unpublished',
  trace_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_draft_university ON public.media_draft (university_id);
CREATE INDEX idx_media_draft_run ON public.media_draft (crawler_run_id);

ALTER TABLE public.media_draft ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media_draft_service_full" ON public.media_draft
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_media_draft_updated_at
  BEFORE UPDATE ON public.media_draft
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- M) orx_mapping_rules
-- Configurable fact_group → ORX signal_family mapping.
-- Populated manually / by admin; no auto-insert in this batch.
-- ============================================================
CREATE TABLE public.orx_mapping_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_group text NOT NULL,
  field_key text NOT NULL,
  evidence_pattern text NULL,
  orx_layer text NOT NULL CHECK (orx_layer IN ('country','university','program')),
  orx_signal_family text NOT NULL,
  confidence_boost integer NOT NULL DEFAULT 0,
  requires_manual_review boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NULL,
  approved_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orx_mapping_rules_fact ON public.orx_mapping_rules (fact_group, field_key);
CREATE INDEX idx_orx_mapping_rules_signal ON public.orx_mapping_rules (orx_layer, orx_signal_family);
CREATE INDEX idx_orx_mapping_rules_active ON public.orx_mapping_rules (active) WHERE active = true;

ALTER TABLE public.orx_mapping_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orx_mapping_rules_service_full" ON public.orx_mapping_rules
  FOR ALL USING (true) WITH CHECK (true);
