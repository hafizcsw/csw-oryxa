-- Create function to get countries statistics
-- This avoids the 1000 row limit by doing server-side aggregation
CREATE OR REPLACE FUNCTION get_countries_with_stats()
RETURNS TABLE (
  country_id UUID,
  universities_count BIGINT,
  programs_count BIGINT,
  ranked_universities_count BIGINT
) AS $$
  SELECT 
    u.country_id,
    COUNT(DISTINCT u.id) as universities_count,
    COUNT(DISTINCT p.id) as programs_count,
    COUNT(DISTINCT CASE WHEN u.ranking IS NOT NULL THEN u.id END) as ranked_universities_count
  FROM universities u
  LEFT JOIN programs p ON p.university_id = u.id
  WHERE u.country_id IS NOT NULL
  GROUP BY u.country_id
$$ LANGUAGE sql STABLE;