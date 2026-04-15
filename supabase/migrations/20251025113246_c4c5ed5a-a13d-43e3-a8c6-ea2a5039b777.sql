-- Replace stub view with actual data mapping
CREATE OR REPLACE VIEW public.vw_university_catalog AS
SELECT
  u.id as university_id,
  u.name as university_name,
  UPPER(c.slug) as country_iso,
  p.id as program_id,
  p.title as program_name,
  COALESCE(d.slug, p.degree_level) as level,
  COALESCE(
    p.language,
    CASE 
      WHEN p.languages IS NOT NULL AND array_length(p.languages, 1) > 0 
      THEN p.languages[1]
      ELSE NULL
    END
  ) as study_language,
  p.tuition_yearly as tuition_per_year,
  p.duration_months as duration_semesters,
  CASE
    WHEN p.intake_months IS NULL THEN NULL
    WHEN array_length(p.intake_months, 1) > 0 
    THEN array_to_string(p.intake_months, ',')
    ELSE NULL
  END as intakes,
  CASE
    WHEN p.requirements IS NULL THEN NULL
    WHEN array_length(p.requirements, 1) > 0
    THEN array_to_string(p.requirements, ', ')
    ELSE NULL
  END as requirements
FROM public.programs p
JOIN public.universities u ON u.id = p.university_id
LEFT JOIN public.degrees d ON d.id = p.degree_id
LEFT JOIN public.countries c ON c.id = u.country_id
WHERE COALESCE(u.is_active, true) = true 
  AND COALESCE(p.is_active, true) = true;

-- Create materialized view for FTS if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_matviews 
    WHERE schemaname = 'public' 
    AND matviewname = 'mv_university_catalog_fts'
  ) THEN
    CREATE MATERIALIZED VIEW public.mv_university_catalog_fts AS
    SELECT
      c.program_id,
      c.university_id,
      to_tsvector('simple',
        COALESCE(c.university_name, '') || ' ' ||
        COALESCE(c.program_name, '') || ' ' ||
        COALESCE(c.level, '') || ' ' ||
        COALESCE(c.study_language, '')
      ) as tsv
    FROM public.vw_university_catalog c;

    CREATE INDEX IF NOT EXISTS ix_unicat_fts_gin
      ON public.mv_university_catalog_fts USING gin(tsv);
  END IF;
END $$;