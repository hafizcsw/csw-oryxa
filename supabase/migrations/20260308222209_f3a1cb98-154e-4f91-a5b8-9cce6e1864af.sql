
-- Drop old functions with old parameter names, then recreate
DROP FUNCTION IF EXISTS public.resolve_locale(text,text,text,text,text,integer);
DROP FUNCTION IF EXISTS public.resolve_locale_batch(text,text,text[],text,text,integer);

-- 1. resolve_locale — single field
CREATE FUNCTION public.resolve_locale(
  _entity_type text,
  _entity_id text,
  _field_name text,
  _locale text,
  _fallback_locale text DEFAULT 'en',
  _max_quality_tier int DEFAULT 3
)
RETURNS TABLE(
  translated_text text,
  locale_served text,
  quality_tier int,
  fallback_used boolean,
  review_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    et.translated_text,
    et.locale AS locale_served,
    et.quality_tier,
    (et.locale != _locale) AS fallback_used,
    et.review_status
  FROM entity_translations et
  WHERE et.entity_type = _entity_type
    AND et.entity_id = _entity_id
    AND et.field_name = _field_name
    AND et.locale IN (_locale, _fallback_locale)
    AND et.quality_tier <= _max_quality_tier
    AND et.review_status IN ('approved', 'pending')
  ORDER BY
    CASE WHEN et.locale = _locale THEN 0 ELSE 1 END,
    CASE WHEN et.review_status = 'approved' THEN 0 ELSE 1 END,
    et.quality_tier ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_locale IS 
'Quality tiers: 1=human reviewed (best), 2=machine+glossary, 3=raw machine (worst).
Review states served: approved > pending. Stale and rejected never served.
_max_quality_tier filters out tiers worse than threshold.';

-- 2. resolve_locale_batch — multiple fields
CREATE FUNCTION public.resolve_locale_batch(
  _entity_type text,
  _entity_id text,
  _field_names text[],
  _locale text,
  _fallback_locale text DEFAULT 'en',
  _max_quality_tier int DEFAULT 3
)
RETURNS TABLE(
  field_name text,
  translated_text text,
  locale_served text,
  quality_tier int,
  fallback_used boolean,
  review_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (fn)
    fn AS field_name,
    et.translated_text,
    et.locale AS locale_served,
    et.quality_tier,
    (et.locale != _locale) AS fallback_used,
    et.review_status
  FROM unnest(_field_names) AS fn
  LEFT JOIN entity_translations et
    ON et.entity_type = _entity_type
    AND et.entity_id = _entity_id
    AND et.field_name = fn
    AND et.locale IN (_locale, _fallback_locale)
    AND et.quality_tier <= _max_quality_tier
    AND et.review_status IN ('approved', 'pending')
  ORDER BY
    fn,
    CASE WHEN et.locale = _locale THEN 0 ELSE 1 END,
    CASE WHEN et.review_status = 'approved' THEN 0 ELSE 1 END,
    et.quality_tier ASC;
$$;

COMMENT ON FUNCTION public.resolve_locale_batch IS 
'Batch resolve. Quality tiers: 1=best, 3=worst. _max_quality_tier filters worse tiers.';
