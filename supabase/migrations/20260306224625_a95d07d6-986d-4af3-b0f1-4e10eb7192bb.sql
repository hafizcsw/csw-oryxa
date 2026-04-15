
CREATE OR REPLACE FUNCTION public.get_countries_with_stats()
 RETURNS TABLE(country_id uuid, universities_count bigint, programs_count bigint, ranked_universities_count bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT 
    u.country_id,
    COUNT(DISTINCT u.id) as universities_count,
    COUNT(DISTINCT CASE WHEN p.publish_status = 'published' THEN p.id END) as programs_count,
    COUNT(DISTINCT CASE WHEN u.ranking IS NOT NULL THEN u.id END) as ranked_universities_count
  FROM universities u
  LEFT JOIN programs p ON p.university_id = u.id
  WHERE u.country_id IS NOT NULL
  GROUP BY u.country_id
$function$;
