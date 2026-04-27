-- ============================================================
-- Order 1C: Crawler v2 — Page Candidates Table
--
-- Stores candidate pages discovered by the page planner for
-- a given crawler_run_item. Each candidate URL is unique per
-- run item. Status tracks the fetch/extract lifecycle.
-- ============================================================

CREATE TABLE public.crawler_page_candidates (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  crawler_run_item_id    uuid        NOT NULL REFERENCES public.crawler_run_items(id)  ON DELETE CASCADE,
  crawler_run_id         uuid        NOT NULL REFERENCES public.crawler_runs(id)        ON DELETE CASCADE,
  university_id          uuid        NOT NULL REFERENCES public.universities(id)        ON DELETE CASCADE,
  candidate_url          text        NOT NULL,
  candidate_type         text        NOT NULL DEFAULT 'other' CHECK (candidate_type IN (
    'homepage','program_list','program_detail','tuition','admissions',
    'housing','contact','media','leadership','scholarship','about','sitemap','other'
  )),
  discovery_method       text        NOT NULL DEFAULT 'homepage_anchor' CHECK (discovery_method IN (
    'homepage_anchor','sitemap_xml','robots_txt','common_path','manual'
  )),
  priority               integer     NOT NULL DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  status                 text        NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','fetched','extracted','skipped','failed'
  )),
  raw_page_id            bigint      NULL REFERENCES public.raw_pages(id),
  fetch_error            text        NULL,
  trace_id               text        NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_crawler_page_candidates_item_url UNIQUE (crawler_run_item_id, candidate_url)
);

CREATE INDEX idx_crawler_page_cands_item   ON public.crawler_page_candidates (crawler_run_item_id, status);
CREATE INDEX idx_crawler_page_cands_run    ON public.crawler_page_candidates (crawler_run_id);
CREATE INDEX idx_crawler_page_cands_type   ON public.crawler_page_candidates (candidate_type, priority DESC);
CREATE INDEX idx_crawler_page_cands_url    ON public.crawler_page_candidates (candidate_url);
CREATE INDEX idx_crawler_page_cands_trace  ON public.crawler_page_candidates (trace_id);

ALTER TABLE public.crawler_page_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crawler_page_candidates_service_full" ON public.crawler_page_candidates
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_crawler_page_candidates_updated_at
  BEFORE UPDATE ON public.crawler_page_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
