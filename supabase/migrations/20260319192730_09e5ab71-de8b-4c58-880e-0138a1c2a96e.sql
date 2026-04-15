-- Phase B: File Artifact Foundation
-- Table for tracking downloaded official files (brochures, fee sheets, guides)
CREATE TABLE public.crawl_file_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL,
  program_id uuid,
  job_id uuid,
  row_id uuid,
  trace_id text,
  
  -- Source provenance
  source_url text NOT NULL,
  source_page_url text,
  source_page_title text,
  
  -- File metadata
  file_name text,
  mime_type text,
  file_size_bytes bigint,
  artifact_type text NOT NULL DEFAULT 'unknown',
  -- artifact_type: brochure, fee_sheet, prospectus, application_form, guide, flyer, unknown
  
  -- Storage
  storage_bucket text NOT NULL DEFAULT 'university-assets',
  storage_path text,
  
  -- Parse status
  parse_status text NOT NULL DEFAULT 'pending',
  -- parse_status: pending, parsed, parse_failed, skipped, not_parseable
  parsed_text text,
  parsed_pages integer,
  parsed_language text,
  parse_error text,
  
  -- Evidence lineage
  evidence_snippet text,
  parser_version text,
  
  -- Timestamps
  fetched_at timestamptz,
  parsed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_crawl_file_artifacts_university ON public.crawl_file_artifacts(university_id);
CREATE INDEX idx_crawl_file_artifacts_program ON public.crawl_file_artifacts(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX idx_crawl_file_artifacts_parse_status ON public.crawl_file_artifacts(parse_status);
CREATE INDEX idx_crawl_file_artifacts_type ON public.crawl_file_artifacts(artifact_type);

-- RLS
ALTER TABLE public.crawl_file_artifacts ENABLE ROW LEVEL SECURITY;

-- Admin-only access (service role for worker)
CREATE POLICY "Service role full access on crawl_file_artifacts"
  ON public.crawl_file_artifacts
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Phase G: Leadership/staff extraction storage
-- Add columns to official_site_observations if not already there (fact_group already supports it)
-- Leadership facts will use fact_group = 'identity' with field_name like 'rector_name', 'rector_title', etc.

-- Phase H: Housing structured facts
-- Housing facts will use fact_group = 'housing' with structured field_names
-- No new table needed — observations + existing universities columns suffice

-- Update trigger for crawl_file_artifacts
CREATE TRIGGER update_crawl_file_artifacts_updated_at
  BEFORE UPDATE ON public.crawl_file_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();