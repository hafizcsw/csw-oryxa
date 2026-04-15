-- 1) Backlinks table
CREATE TABLE IF NOT EXISTS seo_backlinks (
  id           bigserial PRIMARY KEY,
  source_url   text NOT NULL,
  target_url   text NOT NULL,
  anchor_text  text,
  rel          text,
  domain_auth  numeric(5,2),
  spam_score   numeric(5,2),
  first_seen   timestamptz,
  last_seen    timestamptz,
  source_domain text GENERATED ALWAYS AS (regexp_replace(source_url,'^https?://([^/]+)/?.*','\1')) STORED,
  notes        text,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_backlinks_target ON seo_backlinks(target_url);
CREATE INDEX IF NOT EXISTS idx_backlinks_domain ON seo_backlinks(source_domain);

-- 2) GSC snapshots
CREATE TABLE IF NOT EXISTS gsc_snapshots (
  id            bigserial PRIMARY KEY,
  captured_at   timestamptz DEFAULT now(),
  property      text NOT NULL,
  clicks        int,
  impressions   int,
  ctr           numeric(5,2),
  position      numeric(5,2),
  top_queries   jsonb,
  top_pages     jsonb
);

-- 3) Experiments
CREATE TABLE IF NOT EXISTS seo_experiments (
  id           bigserial PRIMARY KEY,
  slug         text UNIQUE,
  scope        text NOT NULL,
  metric       text NOT NULL,
  status       text NOT NULL DEFAULT 'draft',
  start_at     timestamptz,
  end_at       timestamptz,
  created_by   uuid,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_experiment_variants (
  id            bigserial PRIMARY KEY,
  experiment_id bigint REFERENCES seo_experiments(id) ON DELETE CASCADE,
  name          text,
  weight        int DEFAULT 50,
  title_override text,
  meta_desc_override text,
  h1_override   text,
  json_payload  jsonb,
  UNIQUE (experiment_id, name)
);

CREATE TABLE IF NOT EXISTS seo_experiment_metrics (
  id            bigserial PRIMARY KEY,
  experiment_id bigint REFERENCES seo_experiments(id) ON DELETE CASCADE,
  variant_id    bigint REFERENCES seo_experiment_variants(id) ON DELETE CASCADE,
  day           date NOT NULL,
  sessions      int DEFAULT 0,
  pageviews     int DEFAULT 0,
  clicks        int DEFAULT 0,
  impressions   int DEFAULT 0,
  ctr           numeric(5,2),
  conversions   int DEFAULT 0,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (experiment_id, variant_id, day)
);

-- RLS Policies
ALTER TABLE seo_backlinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsc_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_experiment_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_experiment_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY seo_admin_read_backlinks ON seo_backlinks FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY seo_admin_write_backlinks ON seo_backlinks FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY gsc_admin_read ON gsc_snapshots FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY gsc_admin_write ON gsc_snapshots FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY exp_admin_read ON seo_experiments FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY exp_admin_write ON seo_experiments FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY exp_var_read ON seo_experiment_variants FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY exp_var_write ON seo_experiment_variants FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY exp_met_read ON seo_experiment_metrics FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY exp_met_write ON seo_experiment_metrics FOR ALL USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));