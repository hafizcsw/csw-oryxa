-- Official-site crawl forensic audit pack
-- Scope: crawl rows, observations, artifacts, program_draft, programs, publish batches.
-- Usage:
--   psql "$DATABASE_URL" -f scripts/official_site_forensic_audit.sql
-- This script emits result sets in the same order as the requested audit.

\pset pager off
\timing on

WITH latest_crawl AS (
  SELECT DISTINCT ON (r.university_id)
    r.id AS row_id,
    r.job_id,
    r.university_id,
    r.university_name,
    r.country_code,
    r.website,
    r.crawl_status,
    r.error_message,
    r.pages_mapped,
    r.pages_scraped,
    r.reason_codes,
    r.coverage_result,
    r.extracted_summary,
    r.updated_at,
    j.status AS job_status,
    j.phase AS job_phase,
    j.completed_at AS job_completed_at,
    j.updated_at AS job_updated_at
  FROM official_site_crawl_rows r
  JOIN official_site_crawl_jobs j ON j.id = r.job_id
  ORDER BY r.university_id, COALESCE(j.completed_at, r.updated_at, j.updated_at) DESC, r.updated_at DESC, r.created_at DESC
),
latest_obs AS (
  SELECT
    o.university_id,
    COUNT(*) AS obs_total,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(o.value_raw), '') IS NOT NULL) AS obs_with_value,
    COUNT(*) FILTER (WHERE o.status = 'published') AS obs_published,
    COUNT(*) FILTER (WHERE o.status = 'verified') AS obs_verified,
    COUNT(*) FILTER (WHERE o.status NOT IN ('published','verified')) AS obs_unpublished,
    COUNT(DISTINCT o.source_url) FILTER (WHERE NULLIF(BTRIM(o.source_url), '') IS NOT NULL) AS obs_source_urls,
    COUNT(DISTINCT o.field_name) AS obs_fields,
    COUNT(*) FILTER (WHERE o.field_name ILIKE '%deadline%') AS deadline_obs,
    COUNT(*) FILTER (WHERE o.field_name ILIKE '%fee%' OR o.field_name ILIKE '%tuition%') AS fee_obs,
    COUNT(*) FILTER (WHERE o.field_name ILIKE '%language%' OR o.field_name ILIKE '%ielts%' OR o.field_name ILIKE '%toefl%') AS language_obs,
    COUNT(*) FILTER (WHERE o.entity_type = 'program') AS program_entity_obs,
    COUNT(DISTINCT o.entity_id) FILTER (WHERE o.entity_type = 'program' AND NULLIF(BTRIM(o.entity_id), '') IS NOT NULL) AS distinct_program_entities
  FROM official_site_observations o
  GROUP BY o.university_id
),
artifacts AS (
  SELECT
    a.university_id,
    COUNT(*) AS artifact_total,
    COUNT(*) FILTER (WHERE COALESCE(a.mime_type, '') ILIKE 'application/pdf%' OR COALESCE(a.file_name, '') ILIKE '%.pdf') AS pdf_total,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(a.parsed_text), '') IS NOT NULL) AS artifact_text_extracted,
    COUNT(*) FILTER (WHERE COALESCE(a.parse_status, '') NOT IN ('parsed','complete','done')) AS artifact_non_terminal,
    COUNT(*) FILTER (WHERE COALESCE(a.parse_status, '') IN ('error','failed')) AS artifact_errors
  FROM crawl_file_artifacts a
  GROUP BY a.university_id
),
drafts AS (
  SELECT
    d.university_id,
    COUNT(*) AS draft_total,
    COUNT(*) FILTER (WHERE d.review_status = 'published' OR d.published_program_id IS NOT NULL) AS draft_marked_published,
    COUNT(*) FILTER (WHERE d.review_status IS DISTINCT FROM 'published' AND d.published_program_id IS NULL) AS draft_unpublished,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(d.title), '') IS NOT NULL) AS title_present,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(d.degree_level), '') IS NOT NULL) AS degree_present,
    COUNT(*) FILTER (WHERE d.duration_months IS NOT NULL) AS duration_present,
    COUNT(*) FILTER (WHERE d.tuition_fee IS NOT NULL OR d.application_fee IS NOT NULL) AS fee_present,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(d.currency, d.currency_code)), '') IS NOT NULL) AS currency_present,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(d.language), '') IS NOT NULL) AS language_present,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(d.source_program_url), '') IS NOT NULL) AS source_program_url_present,
    COUNT(*) FILTER (WHERE COALESCE(jsonb_typeof(d.extracted_json), 'null') = 'object' AND jsonb_array_length(COALESCE(jsonb_path_query_array(d.extracted_json, '$.* ? (@ != null)'), '[]'::jsonb)) > 0) AS extracted_json_nonempty,
    COUNT(*) FILTER (
      WHERE (
        CASE WHEN NULLIF(BTRIM(d.title), '') IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN NULLIF(BTRIM(d.degree_level), '') IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN d.duration_months IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN d.tuition_fee IS NOT NULL OR d.application_fee IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN NULLIF(BTRIM(COALESCE(d.currency, d.currency_code)), '') IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN NULLIF(BTRIM(d.language), '') IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN NULLIF(BTRIM(d.source_program_url), '') IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN d.extracted_json IS NOT NULL AND d.extracted_json <> '{}'::jsonb THEN 1 ELSE 0 END
      ) >= 5
    ) AS strong_draft_count
  FROM program_draft d
  GROUP BY d.university_id
),
draft_statuses AS (
  SELECT
    COALESCE(status, 'NULL') AS status,
    COALESCE(review_status, 'NULL') AS review_status,
    COALESCE(approval_tier, 'NULL') AS approval_tier,
    COUNT(*) AS rows
  FROM program_draft
  WHERE review_status IS DISTINCT FROM 'published' AND published_program_id IS NULL
  GROUP BY 1,2,3
),
published AS (
  SELECT
    p.university_id,
    COUNT(*) FILTER (WHERE COALESCE(p.published, false) = true OR p.publish_status = 'published') AS published_total,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(p.title), '') IS NOT NULL) AS title_present,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(p.degree_level), '') IS NOT NULL) AS degree_present,
    COUNT(*) FILTER (WHERE p.duration_months IS NOT NULL) AS duration_present,
    COUNT(*) FILTER (WHERE p.tuition_yearly IS NOT NULL OR p.tuition_usd_min IS NOT NULL OR p.tuition_usd_max IS NOT NULL OR p.tuition_local_min IS NOT NULL OR p.tuition_local_max IS NOT NULL OR p.application_fee IS NOT NULL) AS fee_present,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(p.currency_code), '') IS NOT NULL OR NULLIF(BTRIM(p.application_fee_currency), '') IS NOT NULL) AS currency_present,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(p.language, p.teaching_language)), '') IS NOT NULL OR COALESCE(array_length(p.languages,1),0) > 0) AS language_present,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(p.apply_url), '') IS NOT NULL) AS apply_url_present,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(p.source_program_url), '') IS NOT NULL) AS source_program_url_present,
    COUNT(*) FILTER (WHERE p.deadlines IS NOT NULL OR p.application_deadline IS NOT NULL) AS deadlines_present,
    COUNT(*) FILTER (WHERE p.ielts_required IS NOT NULL OR p.ielts_min_overall IS NOT NULL OR p.toefl_required IS NOT NULL OR p.toefl_min IS NOT NULL OR p.duolingo_min IS NOT NULL OR p.pte_min IS NOT NULL OR p.cefr_level IS NOT NULL) AS language_req_present,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(p.description), '') IS NOT NULL) AS description_present,
    COUNT(*) FILTER (
      WHERE (
        CASE WHEN NULLIF(BTRIM(p.title), '') IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN NULLIF(BTRIM(p.degree_level), '') IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN p.duration_months IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN p.tuition_yearly IS NOT NULL OR p.tuition_usd_min IS NOT NULL OR p.tuition_usd_max IS NOT NULL OR p.tuition_local_min IS NOT NULL OR p.tuition_local_max IS NOT NULL OR p.application_fee IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN NULLIF(BTRIM(p.currency_code), '') IS NOT NULL OR NULLIF(BTRIM(p.application_fee_currency), '') IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN NULLIF(BTRIM(COALESCE(p.language, p.teaching_language)), '') IS NOT NULL OR COALESCE(array_length(p.languages,1),0) > 0 THEN 1 ELSE 0 END +
        CASE WHEN NULLIF(BTRIM(p.apply_url), '') IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN NULLIF(BTRIM(p.source_program_url), '') IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN p.deadlines IS NOT NULL OR p.application_deadline IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN p.ielts_required IS NOT NULL OR p.ielts_min_overall IS NOT NULL OR p.toefl_required IS NOT NULL OR p.toefl_min IS NOT NULL OR p.duolingo_min IS NOT NULL OR p.pte_min IS NOT NULL OR p.cefr_level IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN NULLIF(BTRIM(p.description), '') IS NOT NULL THEN 1 ELSE 0 END
      ) <= 3
    ) AS weak_published_count
  FROM programs p
  WHERE COALESCE(p.published, false) = true OR p.publish_status = 'published'
  GROUP BY p.university_id
),
publish_batches AS (
  SELECT
    pb.job_id,
    COUNT(*) AS batch_count,
    SUM(pb.applied_items) AS applied_items,
    SUM(pb.skipped_items) AS skipped_items,
    SUM(pb.failed_items) AS failed_items
  FROM official_site_publish_batches pb
  GROUP BY pb.job_id
),
unis AS (
  SELECT id AS university_id, name AS university_name, country_code
  FROM universities
),
joined AS (
  SELECT
    lc.university_id,
    COALESCE(u.university_name, lc.university_name) AS university_name,
    COALESCE(u.country_code, lc.country_code) AS country,
    lc.row_id,
    lc.job_id,
    lc.crawl_status,
    lc.job_status,
    lc.job_phase,
    lc.error_message,
    lc.pages_mapped,
    lc.pages_scraped,
    lc.reason_codes,
    lc.coverage_result,
    lc.extracted_summary,
    COALESCE(lo.obs_total, 0) AS obs_total,
    COALESCE(lo.obs_with_value, 0) AS obs_with_value,
    COALESCE(lo.obs_published, 0) AS obs_published,
    COALESCE(lo.obs_verified, 0) AS obs_verified,
    COALESCE(lo.obs_unpublished, 0) AS obs_unpublished,
    COALESCE(lo.obs_source_urls, 0) AS obs_source_urls,
    COALESCE(lo.obs_fields, 0) AS obs_fields,
    COALESCE(lo.deadline_obs, 0) AS deadline_obs,
    COALESCE(lo.fee_obs, 0) AS fee_obs,
    COALESCE(lo.language_obs, 0) AS language_obs,
    COALESCE(lo.program_entity_obs, 0) AS program_entity_obs,
    COALESCE(lo.distinct_program_entities, 0) AS distinct_program_entities,
    COALESCE(a.artifact_total, 0) AS artifact_total,
    COALESCE(a.pdf_total, 0) AS pdf_total,
    COALESCE(a.artifact_text_extracted, 0) AS artifact_text_extracted,
    COALESCE(a.artifact_non_terminal, 0) AS artifact_non_terminal,
    COALESCE(a.artifact_errors, 0) AS artifact_errors,
    COALESCE(d.draft_total, 0) AS draft_total,
    COALESCE(d.draft_marked_published, 0) AS draft_marked_published,
    COALESCE(d.draft_unpublished, 0) AS draft_unpublished,
    COALESCE(d.strong_draft_count, 0) AS strong_draft_count,
    COALESCE(p.published_total, 0) AS published_total,
    COALESCE(p.weak_published_count, 0) AS weak_published_count,
    COALESCE(pb.batch_count, 0) AS publish_batch_count,
    COALESCE(pb.applied_items, 0) AS publish_applied_items,
    COALESCE(pb.skipped_items, 0) AS publish_skipped_items,
    COALESCE(pb.failed_items, 0) AS publish_failed_items
  FROM latest_crawl lc
  LEFT JOIN unis u ON u.university_id = lc.university_id
  LEFT JOIN latest_obs lo ON lo.university_id = lc.university_id
  LEFT JOIN artifacts a ON a.university_id = lc.university_id
  LEFT JOIN drafts d ON d.university_id = lc.university_id
  LEFT JOIN published p ON p.university_id = lc.university_id
  LEFT JOIN publish_batches pb ON pb.job_id = lc.job_id
)
SELECT 'EXECUTIVE SNAPSHOT' AS section, *
FROM (
  SELECT 'latest_crawl_universities' AS bucket, COUNT(*)::text AS count, 'latest row per university in official_site_crawl_rows' AS evidence FROM joined
  UNION ALL
  SELECT 'crawl_rows_but_zero_drafts', COUNT(*)::text, 'joined.draft_total = 0' FROM joined WHERE draft_total = 0
  UNION ALL
  SELECT 'drafts_but_zero_published', COUNT(*)::text, 'joined.draft_total > 0 AND joined.published_total = 0' FROM joined WHERE draft_total > 0 AND published_total = 0
  UNION ALL
  SELECT 'published_but_weak_coverage', COUNT(*)::text, 'joined.published_total > 0 AND joined.weak_published_count = joined.published_total' FROM joined WHERE published_total > 0 AND weak_published_count = published_total
  UNION ALL
  SELECT 'latest_finished_but_no_useful_output', COUNT(*)::text, 'crawl done/finished but no drafts, no published, no observations with value' FROM joined WHERE crawl_status IN ('done','finished','completed','published','verified') AND draft_total = 0 AND published_total = 0 AND obs_with_value = 0
  UNION ALL
  SELECT 'pdfs_but_no_useful_output', COUNT(*)::text, 'pdf_total > 0 and no drafts and no fee/language/deadline observations' FROM joined WHERE pdf_total > 0 AND draft_total = 0 AND fee_obs = 0 AND language_obs = 0 AND deadline_obs = 0
  UNION ALL
  SELECT 'nonterminal_rows', COUNT(*)::text, 'crawl_status not in terminal set' FROM joined WHERE crawl_status NOT IN ('done','finished','completed','published','verified','failed','error','skipped','quarantined')
) s;

SELECT 'QUANTIFIED_STATE' AS section, bucket, count, evidence
FROM (
  SELECT 'universities with crawl rows but zero program_draft' AS bucket, COUNT(*)::bigint AS count, 'joined.draft_total = 0' AS evidence FROM joined WHERE draft_total = 0
  UNION ALL
  SELECT 'universities with program_draft but zero published programs', COUNT(*)::bigint, 'joined.draft_total > 0 AND joined.published_total = 0' FROM joined WHERE draft_total > 0 AND published_total = 0
  UNION ALL
  SELECT 'universities with published programs but very weak coverage', COUNT(*)::bigint, 'joined.published_total > 0 AND joined.weak_published_count = joined.published_total' FROM joined WHERE published_total > 0 AND weak_published_count = published_total
  UNION ALL
  SELECT 'crawl rows stuck in non-terminal states', COUNT(*)::bigint, 'latest crawl_status not in terminal state set' FROM joined WHERE crawl_status NOT IN ('done','finished','completed','published','verified','failed','error','skipped','quarantined')
  UNION ALL
  SELECT 'universities whose latest crawl finished but produced no useful output', COUNT(*)::bigint, 'done/finished/completed and no drafts/published/obs_with_value' FROM joined WHERE crawl_status IN ('done','finished','completed','published','verified') AND draft_total = 0 AND published_total = 0 AND obs_with_value = 0
  UNION ALL
  SELECT 'universities where PDFs/artifacts exist but did not turn into useful extracted facts', COUNT(*)::bigint, 'pdf_total > 0 and no drafts and no fee/language/deadline observations' FROM joined WHERE pdf_total > 0 AND draft_total = 0 AND fee_obs = 0 AND language_obs = 0 AND deadline_obs = 0
) q
ORDER BY bucket;

SELECT 'UNPUBLISHED_DRAFT_STATUS' AS section, status, review_status, approval_tier, rows
FROM draft_statuses
ORDER BY rows DESC, status, review_status, approval_tier;

SELECT 'WORST_AFFECTED_UNIVERSITIES' AS section,
  j.university_id,
  j.university_name,
  j.country,
  j.crawl_status,
  COALESCE(j.pages_scraped, j.pages_mapped, 0) AS pages_reached,
  j.draft_total AS drafts,
  j.published_total AS published,
  j.pdf_total AS artifacts_pdf,
  CASE
    WHEN j.crawl_status NOT IN ('done','finished','completed','published','verified','failed','error','skipped','quarantined') THEN 'crawl stage'
    WHEN j.draft_total = 0 AND j.obs_with_value = 0 AND j.pdf_total = 0 THEN 'crawl coverage'
    WHEN j.draft_total = 0 AND (j.obs_with_value > 0 OR j.pdf_total > 0 OR j.program_entity_obs > 0) THEN 'extraction stage'
    WHEN j.draft_total > 0 AND j.strong_draft_count = 0 AND j.published_total = 0 THEN 'review stage / weak draft facts'
    WHEN j.strong_draft_count > 0 AND j.published_total = 0 THEN 'publish stage'
    WHEN j.draft_total > GREATEST(j.published_total,1) * 3 AND j.published_total <= 1 THEN 'matching/grouping stage'
    WHEN j.pdf_total > 0 AND j.draft_total = 0 THEN 'artifact extraction stage'
    ELSE 'source-limited or mixed'
  END AS failure_stage,
  jsonb_build_object(
    'row_id', j.row_id,
    'job_id', j.job_id,
    'obs_total', j.obs_total,
    'obs_with_value', j.obs_with_value,
    'obs_unpublished', j.obs_unpublished,
    'program_entity_obs', j.program_entity_obs,
    'distinct_program_entities', j.distinct_program_entities,
    'artifact_total', j.artifact_total,
    'publish_batches', j.publish_batch_count,
    'publish_applied_items', j.publish_applied_items,
    'publish_skipped_items', j.publish_skipped_items,
    'publish_failed_items', j.publish_failed_items,
    'reason_codes', j.reason_codes,
    'error_message', j.error_message
  ) AS evidence
FROM joined j
WHERE (
  j.draft_total = 0 OR
  j.published_total = 0 OR
  j.weak_published_count = j.published_total OR
  (j.draft_total > GREATEST(j.published_total,1) * 3 AND j.published_total <= 1) OR
  (j.pdf_total > 0 AND j.draft_total = 0)
)
ORDER BY
  (CASE WHEN j.strong_draft_count > 0 AND j.published_total = 0 THEN 100 ELSE 0 END +
   CASE WHEN j.draft_total = 0 AND (j.obs_with_value > 0 OR j.pdf_total > 0) THEN 90 ELSE 0 END +
   CASE WHEN j.draft_total > GREATEST(j.published_total,1) * 3 AND j.published_total <= 1 THEN 80 ELSE 0 END +
   CASE WHEN j.published_total > 0 AND j.weak_published_count = j.published_total THEN 70 ELSE 0 END +
   LEAST(j.draft_total, 50) + LEAST(j.obs_total, 50) + LEAST(j.pdf_total, 20)) DESC,
  j.university_name
LIMIT 100;

WITH draft_rows AS (
  SELECT university_id, 'program_draft' AS table_name, 'title' AS field, COUNT(*) FILTER (WHERE NULLIF(BTRIM(title), '') IS NULL) AS missing_count, COUNT(*) AS total_rows FROM program_draft GROUP BY university_id
  UNION ALL SELECT university_id, 'program_draft', 'degree_level', COUNT(*) FILTER (WHERE NULLIF(BTRIM(degree_level), '') IS NULL), COUNT(*) FROM program_draft GROUP BY university_id
  UNION ALL SELECT university_id, 'program_draft', 'duration_months', COUNT(*) FILTER (WHERE duration_months IS NULL), COUNT(*) FROM program_draft GROUP BY university_id
  UNION ALL SELECT university_id, 'program_draft', 'tuition_fee_or_application_fee', COUNT(*) FILTER (WHERE tuition_fee IS NULL AND application_fee IS NULL), COUNT(*) FROM program_draft GROUP BY university_id
  UNION ALL SELECT university_id, 'program_draft', 'currency', COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(currency, currency_code)), '') IS NULL), COUNT(*) FROM program_draft GROUP BY university_id
  UNION ALL SELECT university_id, 'program_draft', 'language', COUNT(*) FILTER (WHERE NULLIF(BTRIM(language), '') IS NULL), COUNT(*) FROM program_draft GROUP BY university_id
  UNION ALL SELECT university_id, 'program_draft', 'source_program_url', COUNT(*) FILTER (WHERE NULLIF(BTRIM(source_program_url), '') IS NULL), COUNT(*) FROM program_draft GROUP BY university_id
  UNION ALL SELECT university_id, 'program_draft', 'description_or_summary_json', COUNT(*) FILTER (WHERE COALESCE(NULLIF(BTRIM(gpt5_reasoning), ''), NULLIF(BTRIM(extracted_json->>'description'), ''), NULLIF(BTRIM(extracted_json->>'summary'), '')) IS NULL), COUNT(*) FROM program_draft GROUP BY university_id
  UNION ALL SELECT university_id, 'program_draft', 'deadlines_json', COUNT(*) FILTER (WHERE NULLIF(BTRIM(extracted_json->>'deadlines'), '') IS NULL), COUNT(*) FROM program_draft GROUP BY university_id
  UNION ALL SELECT university_id, 'program_draft', 'ielts_or_language_requirement_json', COUNT(*) FILTER (WHERE NULLIF(BTRIM(extracted_json->>'ielts'), '') IS NULL AND NULLIF(BTRIM(extracted_json->>'language_requirement'), '') IS NULL), COUNT(*) FROM program_draft GROUP BY university_id
),
published_rows AS (
  SELECT university_id, 'programs' AS table_name, 'title' AS field, COUNT(*) FILTER (WHERE NULLIF(BTRIM(title), '') IS NULL) AS missing_count, COUNT(*) AS total_rows FROM programs WHERE COALESCE(published,false) = true OR publish_status = 'published' GROUP BY university_id
  UNION ALL SELECT university_id, 'programs', 'degree_level', COUNT(*) FILTER (WHERE NULLIF(BTRIM(degree_level), '') IS NULL), COUNT(*) FROM programs WHERE COALESCE(published,false) = true OR publish_status = 'published' GROUP BY university_id
  UNION ALL SELECT university_id, 'programs', 'duration_months', COUNT(*) FILTER (WHERE duration_months IS NULL), COUNT(*) FROM programs WHERE COALESCE(published,false) = true OR publish_status = 'published' GROUP BY university_id
  UNION ALL SELECT university_id, 'programs', 'tuition_fee_or_application_fee', COUNT(*) FILTER (WHERE tuition_yearly IS NULL AND tuition_usd_min IS NULL AND tuition_usd_max IS NULL AND tuition_local_min IS NULL AND tuition_local_max IS NULL AND application_fee IS NULL), COUNT(*) FROM programs WHERE COALESCE(published,false) = true OR publish_status = 'published' GROUP BY university_id
  UNION ALL SELECT university_id, 'programs', 'currency', COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(currency_code, application_fee_currency)), '') IS NULL), COUNT(*) FROM programs WHERE COALESCE(published,false) = true OR publish_status = 'published' GROUP BY university_id
  UNION ALL SELECT university_id, 'programs', 'language', COUNT(*) FILTER (WHERE NULLIF(BTRIM(COALESCE(language, teaching_language)), '') IS NULL AND COALESCE(array_length(languages,1),0) = 0), COUNT(*) FROM programs WHERE COALESCE(published,false) = true OR publish_status = 'published' GROUP BY university_id
  UNION ALL SELECT university_id, 'programs', 'apply_url', COUNT(*) FILTER (WHERE NULLIF(BTRIM(apply_url), '') IS NULL), COUNT(*) FROM programs WHERE COALESCE(published,false) = true OR publish_status = 'published' GROUP BY university_id
  UNION ALL SELECT university_id, 'programs', 'source_program_url', COUNT(*) FILTER (WHERE NULLIF(BTRIM(source_program_url), '') IS NULL), COUNT(*) FROM programs WHERE COALESCE(published,false) = true OR publish_status = 'published' GROUP BY university_id
  UNION ALL SELECT university_id, 'programs', 'deadlines', COUNT(*) FILTER (WHERE deadlines IS NULL AND application_deadline IS NULL), COUNT(*) FROM programs WHERE COALESCE(published,false) = true OR publish_status = 'published' GROUP BY university_id
  UNION ALL SELECT university_id, 'programs', 'ielts_or_language_requirement', COUNT(*) FILTER (WHERE ielts_required IS NULL AND ielts_min_overall IS NULL AND toefl_required IS NULL AND toefl_min IS NULL AND duolingo_min IS NULL AND pte_min IS NULL AND cefr_level IS NULL), COUNT(*) FROM programs WHERE COALESCE(published,false) = true OR publish_status = 'published' GROUP BY university_id
  UNION ALL SELECT university_id, 'programs', 'description', COUNT(*) FILTER (WHERE NULLIF(BTRIM(description), '') IS NULL), COUNT(*) FROM programs WHERE COALESCE(published,false) = true OR publish_status = 'published' GROUP BY university_id
),
field_loss AS (
  SELECT * FROM draft_rows
  UNION ALL
  SELECT * FROM published_rows
),
field_loss_global AS (
  SELECT table_name, field, SUM(missing_count) AS missing_count, SUM(total_rows) AS total_rows
  FROM field_loss
  GROUP BY table_name, field
)
SELECT 'CRITICAL_MISSING_FIELDS' AS section,
  table_name,
  field,
  missing_count,
  ROUND((missing_count::numeric / NULLIF(total_rows,0)) * 100, 2) AS missing_pct,
  total_rows,
  'global missing rate' AS evidence
FROM field_loss_global
ORDER BY table_name, missing_pct DESC, field;

SELECT 'TOP_AFFECTED_UNIVERSITIES_BY_FIELD' AS section,
  fl.table_name,
  fl.field,
  u.name AS university_name,
  u.country_code AS country,
  fl.missing_count,
  fl.total_rows,
  ROUND((fl.missing_count::numeric / NULLIF(fl.total_rows,0)) * 100, 2) AS missing_pct
FROM field_loss fl
JOIN universities u ON u.id = fl.university_id
WHERE fl.total_rows >= 3
ORDER BY fl.field, missing_pct DESC, fl.missing_count DESC, university_name
LIMIT 200;

SELECT 'CRAWLED_BUT_NOT_PUBLISHED_TRUTH' AS section,
  university_id,
  university_name,
  country,
  crawl_status,
  draft_total,
  strong_draft_count,
  draft_unpublished,
  published_total,
  obs_total,
  obs_unpublished,
  pdf_total,
  publish_batch_count,
  publish_applied_items,
  publish_skipped_items,
  publish_failed_items,
  CASE
    WHEN draft_total = 0 AND obs_with_value = 0 AND pdf_total = 0 THEN 'nothing was ever extracted'
    WHEN draft_total > 0 AND strong_draft_count = 0 AND published_total = 0 THEN 'extracted but too weak'
    WHEN strong_draft_count > 0 AND published_total = 0 THEN 'extracted and strong enough but never published'
    WHEN strong_draft_count > 0 AND publish_skipped_items > 0 THEN 'published path filtered/skipped'
    WHEN strong_draft_count > 0 AND publish_failed_items > 0 THEN 'publish failed'
    WHEN draft_total > published_total AND published_total > 0 THEN 'partial publish / matching-grouping gap'
    ELSE 'mixed / inspect row evidence'
  END AS truth_bucket,
  jsonb_build_object(
    'row_id', row_id,
    'job_id', job_id,
    'obs_with_value', obs_with_value,
    'obs_fields', obs_fields,
    'program_entity_obs', program_entity_obs,
    'distinct_program_entities', distinct_program_entities,
    'reason_codes', reason_codes,
    'error_message', error_message
  ) AS evidence
FROM joined
WHERE draft_total > published_total OR obs_unpublished > 0 OR (pdf_total > 0 AND draft_total = 0)
ORDER BY strong_draft_count DESC, draft_unpublished DESC, obs_unpublished DESC, pdf_total DESC
LIMIT 100;

SELECT 'ONE_PROGRAM_ONLY_CHECK' AS section,
  university_id,
  university_name,
  country,
  crawl_status,
  COALESCE(pages_scraped, pages_mapped, 0) AS pages_reached,
  obs_source_urls,
  distinct_program_entities,
  draft_total,
  published_total,
  pdf_total,
  CASE
    WHEN published_total <= 1 AND draft_total >= 5 THEN 'many drafts but only one/few published'
    WHEN published_total <= 1 AND distinct_program_entities >= 5 THEN 'many program entities observed but one/few published'
    WHEN published_total <= 1 AND obs_source_urls >= 10 THEN 'broad source coverage but one/few published'
    ELSE 'inspect manually'
  END AS reason,
  jsonb_build_object('row_id', row_id, 'job_id', job_id, 'publish_skipped_items', publish_skipped_items, 'publish_failed_items', publish_failed_items) AS evidence
FROM joined
WHERE published_total <= 1
  AND (draft_total >= 5 OR distinct_program_entities >= 5 OR obs_source_urls >= 10)
ORDER BY GREATEST(draft_total, distinct_program_entities, obs_source_urls) DESC, university_name
LIMIT 100;
