
-- Persistent geo cache table
CREATE TABLE public.geo_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,         -- 'city', 'university', 'poi'
  entity_id text,                     -- university_id or null for city-level
  country_code text,
  country_name text,
  city_name text,
  university_name text,
  normalized_query_key text NOT NULL, -- lowercase deterministic key
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  source text NOT NULL,               -- 'city_coordinates', 'nominatim', 'manual', etc.
  confidence double precision NOT NULL DEFAULT 0.5,
  resolution_level text NOT NULL,     -- 'university_verified','university_stored','city_resolved','poi_exact','unresolved'
  bbox jsonb,                         -- optional bounding box
  last_resolved_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(normalized_query_key)
);

-- Index for fast lookups
CREATE INDEX idx_geo_cache_query_key ON public.geo_cache(normalized_query_key);
CREATE INDEX idx_geo_cache_entity ON public.geo_cache(entity_type, entity_id);
CREATE INDEX idx_geo_cache_country_city ON public.geo_cache(country_code, city_name);

-- RLS: public read, service-role write
ALTER TABLE public.geo_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geo_cache_public_read" ON public.geo_cache FOR SELECT TO anon, authenticated USING (true);

-- Seed from existing city_coordinates table
INSERT INTO public.geo_cache (entity_type, country_code, city_name, normalized_query_key, lat, lon, source, confidence, resolution_level)
SELECT 
  'city',
  country_code,
  city_name,
  LOWER(country_code || ':' || city_name),
  lat,
  lon,
  'city_coordinates',
  0.8,
  'city_resolved'
FROM public.city_coordinates
ON CONFLICT(normalized_query_key) DO NOTHING;

-- Seed from universities that have stored coordinates  
INSERT INTO public.geo_cache (entity_type, entity_id, country_code, city_name, university_name, normalized_query_key, lat, lon, source, confidence, resolution_level)
SELECT 
  'university',
  u.id::text,
  u.country_code,
  u.city,
  u.name,
  'uni:' || u.id::text,
  u.geo_lat,
  u.geo_lon,
  COALESCE(u.geo_source, 'database'),
  CASE WHEN u.geo_source ILIKE '%verified%' OR u.geo_source ILIKE '%osm%' THEN 0.9 ELSE 0.6 END,
  CASE WHEN u.geo_source ILIKE '%verified%' OR u.geo_source ILIKE '%osm%' THEN 'university_verified' ELSE 'university_stored' END
FROM public.universities u
WHERE u.geo_lat IS NOT NULL AND u.geo_lon IS NOT NULL
ON CONFLICT(normalized_query_key) DO NOTHING;

-- RPC to lookup geo cache (batch)
CREATE OR REPLACE FUNCTION public.rpc_geo_cache_lookup(p_keys text[])
RETURNS TABLE(
  normalized_query_key text,
  entity_type text,
  entity_id text,
  lat double precision,
  lon double precision,
  source text,
  confidence double precision,
  resolution_level text,
  bbox jsonb,
  city_name text,
  country_code text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update last_used_at for requested keys
  UPDATE geo_cache gc SET last_used_at = now()
  WHERE gc.normalized_query_key = ANY(p_keys);
  
  RETURN QUERY
  SELECT 
    gc.normalized_query_key,
    gc.entity_type,
    gc.entity_id,
    gc.lat,
    gc.lon,
    gc.source,
    gc.confidence,
    gc.resolution_level,
    gc.bbox,
    gc.city_name,
    gc.country_code
  FROM geo_cache gc
  WHERE gc.normalized_query_key = ANY(p_keys);
END;
$$;

-- RPC to upsert geo cache entries (from edge function / resolver)
CREATE OR REPLACE FUNCTION public.rpc_geo_cache_upsert(
  p_entries jsonb
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_entry jsonb;
BEGIN
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    INSERT INTO geo_cache (
      entity_type, entity_id, country_code, country_name, city_name, university_name,
      normalized_query_key, lat, lon, source, confidence, resolution_level, bbox
    ) VALUES (
      v_entry->>'entity_type',
      v_entry->>'entity_id',
      v_entry->>'country_code',
      v_entry->>'country_name',
      v_entry->>'city_name',
      v_entry->>'university_name',
      v_entry->>'normalized_query_key',
      (v_entry->>'lat')::double precision,
      (v_entry->>'lon')::double precision,
      v_entry->>'source',
      COALESCE((v_entry->>'confidence')::double precision, 0.5),
      v_entry->>'resolution_level',
      v_entry->'bbox'
    )
    ON CONFLICT(normalized_query_key) DO UPDATE SET
      lat = EXCLUDED.lat,
      lon = EXCLUDED.lon,
      source = EXCLUDED.source,
      confidence = EXCLUDED.confidence,
      resolution_level = EXCLUDED.resolution_level,
      bbox = EXCLUDED.bbox,
      last_resolved_at = now(),
      last_used_at = now();
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
