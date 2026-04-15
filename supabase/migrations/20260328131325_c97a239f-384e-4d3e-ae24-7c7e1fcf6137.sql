
UPDATE geo_cache 
SET normalized_query_key = lower(trim(regexp_replace(normalized_query_key, '\s+', ' ', 'g')))
WHERE normalized_query_key != lower(trim(regexp_replace(normalized_query_key, '\s+', ' ', 'g')));
