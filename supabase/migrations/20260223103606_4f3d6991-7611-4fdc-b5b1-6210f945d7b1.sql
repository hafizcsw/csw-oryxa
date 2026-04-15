
-- Step 1: Deduplicate price_observations (keep newest row per natural key)
DELETE FROM public.price_observations a
USING public.price_observations b
WHERE a.university_id = b.university_id
  AND a.source_url = b.source_url
  AND a.price_type = b.price_type
  AND a.period IS NOT DISTINCT FROM b.period
  AND a.amount IS NOT DISTINCT FROM b.amount
  AND a.program_id IS NOT DISTINCT FROM b.program_id
  AND a.id < b.id;

-- Step 2: Deduplicate admissions_observations
DELETE FROM public.admissions_observations a
USING public.admissions_observations b
WHERE a.university_id = b.university_id
  AND a.source_url = b.source_url
  AND a.degree_level IS NOT DISTINCT FROM b.degree_level
  AND a.audience IS NOT DISTINCT FROM b.audience
  AND a.program_id IS NOT DISTINCT FROM b.program_id
  AND a.id < b.id;

-- Step 3: Create unique indexes
CREATE UNIQUE INDEX uq_price_obs_uni_source_type 
ON public.price_observations (university_id, source_url, price_type, period, amount)
WHERE program_id IS NULL;

CREATE UNIQUE INDEX uq_price_obs_prog_source_type 
ON public.price_observations (program_id, source_url, price_type, period, amount)
WHERE program_id IS NOT NULL;

CREATE UNIQUE INDEX uq_adm_obs_uni_source_degree 
ON public.admissions_observations (university_id, source_url, degree_level, audience)
WHERE program_id IS NULL;
