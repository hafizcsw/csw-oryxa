-- فهارس أداء
CREATE INDEX IF NOT EXISTS ix_harvest_jobs_started ON harvest_jobs(started_at DESC);
CREATE INDEX IF NOT EXISTS ix_harvest_results_job_id ON harvest_results(job_id);
CREATE INDEX IF NOT EXISTS ix_harvest_results_flags ON harvest_results(has_official_fees);

-- ڤيو مختصر للداشبورد
CREATE OR REPLACE VIEW vw_harvest_job_summary AS
SELECT
  j.id, j.country, j.locale, j.status, j.time_budget_min,
  j.started_at, j.finished_at,
  (j.stats->>'processed')::int AS processed,
  (j.stats->>'qualified')::int AS qualified,
  (j.stats->>'insertedPrograms')::int AS inserted_programs,
  COALESCE((SELECT count(*) FROM harvest_results r WHERE r.job_id=j.id AND r.has_official_fees),0) AS qualified_count
FROM harvest_jobs j;