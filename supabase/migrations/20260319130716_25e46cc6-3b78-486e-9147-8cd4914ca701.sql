
-- RPC: Country summaries for official site crawl review
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
  SELECT jsonb_build_object(
    'counters', (
      SELECT jsonb_build_object(
        'total', count(*),
        'queued', count(*) FILTER (WHERE r.crawl_status = 'queued'),
        'processing', count(*) FILTER (WHERE r.crawl_status IN ('extracting','fetching')),
        'verifying', count(*) FILTER (WHERE r.crawl_status = 'verifying'),
        'verified', count(*) FILTER (WHERE r.crawl_status = 'verified'),
        'published', count(*) FILTER (WHERE r.crawl_status IN ('published','published_partial')),
        'quarantined', count(*) FILTER (WHERE r.crawl_status = 'quarantined'),
        'failed', count(*) FILTER (WHERE r.crawl_status = 'failed'),
        'special', count(*) FILTER (WHERE r.crawl_status = 'special')
      )
      FROM official_site_crawl_rows r
    ),
    'countries', (
      SELECT coalesce(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.university_count DESC), '[]'::jsonb)
      FROM (
        SELECT
          r.country_code,
          c.name_ar,
          c.name_en,
          count(*) AS university_count,
          round(avg(r.completeness_score)::numeric, 1) AS avg_completeness,
          count(*) FILTER (WHERE r.crawl_status IN ('published','published_partial')) AS published_count,
          count(*) FILTER (WHERE r.crawl_status = 'verifying') AS verifying_count,
          count(*) FILTER (WHERE r.crawl_status = 'quarantined') AS quarantined_count
        FROM official_site_crawl_rows r
        LEFT JOIN countries c ON c.country_code = r.country_code
        WHERE
          (v_status IS NULL OR r.crawl_status = v_status)
          AND (v_search IS NULL OR r.university_name ILIKE '%' || v_search || '%')
        GROUP BY r.country_code, c.name_ar, c.name_en
      ) sub
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- RPC: University list for a country in official site crawl
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
  SELECT jsonb_build_object(
    'total', (
      SELECT count(*)
      FROM official_site_crawl_rows r
      WHERE r.country_code = p_country_code
        AND (v_status IS NULL OR r.crawl_status = v_status)
        AND (v_search IS NULL OR r.university_name ILIKE '%' || v_search || '%')
    ),
    'universities', (
      SELECT coalesce(jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.completeness_score DESC NULLS LAST), '[]'::jsonb)
      FROM (
        SELECT
          r.university_id,
          r.university_name,
          r.website,
          r.crawl_status,
          r.completeness_score,
          r.completeness_by_section,
          r.pages_scraped,
          r.pages_mapped,
          r.reason_codes,
          r.error_message,
          r.extracted_summary,
          r.updated_at
        FROM official_site_crawl_rows r
        WHERE r.country_code = p_country_code
          AND (v_status IS NULL OR r.crawl_status = v_status)
          AND (v_search IS NULL OR r.university_name ILIKE '%' || v_search || '%')
        ORDER BY r.completeness_score DESC NULLS LAST, r.updated_at DESC
        LIMIT p_limit OFFSET p_offset
      ) sub
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
