
CREATE OR REPLACE FUNCTION public.rpc_admin_osc_review_countries(
  p_filters jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := p_filters->>'search';
  v_status text := p_filters->>'status';
  v_result jsonb;
BEGIN
  WITH deduped AS (
    SELECT DISTINCT ON (university_id)
      university_id, university_name, country_code, crawl_status, completeness_score
    FROM official_site_crawl_rows
    ORDER BY university_id, updated_at DESC NULLS LAST
  )
  SELECT jsonb_build_object(
    'counters', (
      SELECT jsonb_build_object(
        'total', count(*),
        'queued', count(*) FILTER (WHERE d.crawl_status = 'queued'),
        'processing', count(*) FILTER (WHERE d.crawl_status IN ('extracting','fetching')),
        'verifying', count(*) FILTER (WHERE d.crawl_status = 'verifying'),
        'verified', count(*) FILTER (WHERE d.crawl_status = 'verified'),
        'published', count(*) FILTER (WHERE d.crawl_status IN ('published','published_partial')),
        'quarantined', count(*) FILTER (WHERE d.crawl_status = 'quarantined'),
        'failed', count(*) FILTER (WHERE d.crawl_status = 'failed'),
        'special', count(*) FILTER (WHERE d.crawl_status = 'special')
      )
      FROM deduped d
    ),
    'countries', (
      SELECT coalesce(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.university_count DESC), '[]'::jsonb)
      FROM (
        SELECT
          d.country_code,
          c.name_ar,
          c.name_en,
          count(*) AS university_count,
          round(avg(d.completeness_score)::numeric, 1) AS avg_completeness,
          count(*) FILTER (WHERE d.crawl_status IN ('published','published_partial')) AS published_count,
          count(*) FILTER (WHERE d.crawl_status = 'verifying') AS verifying_count,
          count(*) FILTER (WHERE d.crawl_status = 'quarantined') AS quarantined_count
        FROM deduped d
        LEFT JOIN countries c ON c.country_code = d.country_code
        WHERE
          (v_status IS NULL OR d.crawl_status = v_status)
          AND (v_search IS NULL OR d.university_name ILIKE '%' || v_search || '%')
        GROUP BY d.country_code, c.name_ar, c.name_en
      ) sub
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_admin_osc_review_universities(
  p_country_code text,
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := p_filters->>'search';
  v_status text := p_filters->>'status';
  v_result jsonb;
BEGIN
  WITH deduped AS (
    SELECT DISTINCT ON (university_id)
      university_id, university_name, website, crawl_status,
      completeness_score, completeness_by_section, pages_scraped, pages_mapped,
      reason_codes, error_message, extracted_summary, updated_at, country_code
    FROM official_site_crawl_rows
    ORDER BY university_id, updated_at DESC NULLS LAST
  )
  SELECT jsonb_build_object(
    'total', (
      SELECT count(*)
      FROM deduped d
      WHERE d.country_code = p_country_code
        AND (v_status IS NULL OR d.crawl_status = v_status)
        AND (v_search IS NULL OR d.university_name ILIKE '%' || v_search || '%')
    ),
    'universities', (
      SELECT coalesce(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.completeness_score DESC NULLS LAST), '[]'::jsonb)
      FROM (
        SELECT
          d.university_id,
          d.university_name,
          d.website,
          d.crawl_status,
          d.completeness_score,
          d.completeness_by_section,
          d.pages_scraped,
          d.pages_mapped,
          d.reason_codes,
          d.error_message,
          d.extracted_summary,
          d.updated_at
        FROM deduped d
        WHERE d.country_code = p_country_code
          AND (v_status IS NULL OR d.crawl_status = v_status)
          AND (v_search IS NULL OR d.university_name ILIKE '%' || v_search || '%')
        ORDER BY d.completeness_score DESC NULLS LAST, d.updated_at DESC
        LIMIT p_limit OFFSET p_offset
      ) sub
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
