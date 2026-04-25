
WITH ins_job AS (
  INSERT INTO public.official_site_crawl_jobs (
    id, status, phase, mode, country_codes,
    max_universities, max_pages_per_uni, source_policy,
    kill_switch, total_universities, trace_id, stats_json, started_at
  )
  VALUES (
    gen_random_uuid(),
    'crawling', 'crawl', 'targeted', ARRAY['DE'],
    1, 15, 'official_only',
    false, 1,
    'OSC-PROBE-TUM-' || to_char(now(),'YYYYMMDDHH24MISS'),
    jsonb_build_object('purpose','forensic_probe','target','tum.de'),
    now()
  )
  RETURNING id, trace_id
)
INSERT INTO public.official_site_crawl_rows (
  id, job_id, university_id, university_name, website,
  crawl_status, country_code
)
SELECT gen_random_uuid(), ij.id,
  '5c1a889c-704b-41b1-bc71-d59389046aa7'::uuid,
  'Technical University of Munich',
  'https://www.tum.de/en/',
  'queued', 'DE'
FROM ins_job ij
RETURNING id, job_id, university_id, website, crawl_status;
