-- =====================================================
-- P2: CSW Guidance Layer (Staff-Only)
-- =====================================================

-- CSW University Guidance: Partner tiers, stars, staff notes
CREATE TABLE public.csw_university_guidance (
  university_id UUID PRIMARY KEY REFERENCES public.universities(id) ON DELETE CASCADE,
  partner_tier TEXT CHECK (partner_tier IN ('platinum', 'gold', 'silver', 'bronze', 'none')),
  csw_star BOOLEAN DEFAULT false,
  do_not_offer BOOLEAN DEFAULT false,
  do_not_offer_reason TEXT,
  pitch_public_i18n JSONB DEFAULT '{}',
  pitch_staff_i18n JSONB DEFAULT '{}',
  selling_points TEXT[],
  objections TEXT[],
  internal_notes TEXT,
  priority_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- CSW Program Guidance: Program-level staff recommendations
CREATE TABLE public.csw_program_guidance (
  program_id UUID PRIMARY KEY REFERENCES public.programs(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  csw_recommended BOOLEAN DEFAULT false,
  do_not_offer BOOLEAN DEFAULT false,
  do_not_offer_reason TEXT,
  selling_points_i18n JSONB DEFAULT '{}',
  objections_i18n JSONB DEFAULT '{}',
  staff_notes TEXT,
  reason_codes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.csw_university_guidance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.csw_program_guidance ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Staff/Admin only for write, no public read
-- University Guidance - Admin read/write
CREATE POLICY "csw_uni_guidance_admin_select" ON public.csw_university_guidance
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "csw_uni_guidance_admin_insert" ON public.csw_university_guidance
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "csw_uni_guidance_admin_update" ON public.csw_university_guidance
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "csw_uni_guidance_admin_delete" ON public.csw_university_guidance
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Program Guidance - Admin read/write
CREATE POLICY "csw_prog_guidance_admin_select" ON public.csw_program_guidance
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "csw_prog_guidance_admin_insert" ON public.csw_program_guidance
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "csw_prog_guidance_admin_update" ON public.csw_program_guidance
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "csw_prog_guidance_admin_delete" ON public.csw_program_guidance
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for performance
CREATE INDEX idx_csw_uni_guidance_star ON public.csw_university_guidance(csw_star) WHERE csw_star = true;
CREATE INDEX idx_csw_uni_guidance_tier ON public.csw_university_guidance(partner_tier);
CREATE INDEX idx_csw_prog_guidance_recommended ON public.csw_program_guidance(csw_recommended) WHERE csw_recommended = true;
CREATE INDEX idx_csw_prog_guidance_priority ON public.csw_program_guidance(priority DESC);

-- Trigger for updated_at
CREATE TRIGGER set_csw_uni_guidance_updated_at
  BEFORE UPDATE ON public.csw_university_guidance
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER set_csw_prog_guidance_updated_at
  BEFORE UPDATE ON public.csw_program_guidance
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- =====================================================
-- P5: City Enrichment Table
-- =====================================================

CREATE TABLE public.city_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  living_cost_monthly_usd NUMERIC(10,2),
  rent_monthly_usd NUMERIC(10,2),
  safety_score INTEGER CHECK (safety_score BETWEEN 1 AND 10),
  climate_summary_i18n JSONB DEFAULT '{}',
  quality_of_life_score INTEGER CHECK (quality_of_life_score BETWEEN 1 AND 100),
  healthcare_score INTEGER CHECK (healthcare_score BETWEEN 1 AND 10),
  transport_score INTEGER CHECK (transport_score BETWEEN 1 AND 10),
  internet_speed_mbps INTEGER,
  data_source TEXT,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city_name, country_code)
);

-- Enable RLS
ALTER TABLE public.city_enrichment ENABLE ROW LEVEL SECURITY;

-- Public read for city data
CREATE POLICY "city_enrichment_public_read" ON public.city_enrichment
  FOR SELECT USING (true);

-- Admin write
CREATE POLICY "city_enrichment_admin_insert" ON public.city_enrichment
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "city_enrichment_admin_update" ON public.city_enrichment
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "city_enrichment_admin_delete" ON public.city_enrichment
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_city_enrichment_country ON public.city_enrichment(country_code);
CREATE INDEX idx_city_enrichment_name ON public.city_enrichment(city_name);

-- =====================================================
-- P3: Recommendations V2 RPC with Reason Codes
-- =====================================================

CREATE OR REPLACE FUNCTION public.compute_recommendations_v2(
  p_user_id UUID DEFAULT NULL,
  p_visitor_id TEXT DEFAULT NULL,
  p_filters JSONB DEFAULT '{}',
  p_audience TEXT DEFAULT 'public',
  p_limit INTEGER DEFAULT 24
)
RETURNS TABLE (
  program_id UUID,
  score NUMERIC,
  reason_codes TEXT[],
  guidance JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country_pref TEXT;
  v_budget_max NUMERIC;
  v_is_staff BOOLEAN := false;
BEGIN
  -- Check if caller is staff
  IF p_audience = 'staff' AND auth.uid() IS NOT NULL THEN
    v_is_staff := public.has_role(auth.uid(), 'admin');
  END IF;

  -- Get user preferences if available
  IF p_user_id IS NOT NULL THEN
    SELECT preferred_currency_code INTO v_country_pref
    FROM portal_user_prefs WHERE auth_user_id = p_user_id;
  END IF;

  -- Extract filters
  v_budget_max := (p_filters->>'max_tuition')::NUMERIC;

  RETURN QUERY
  WITH scored_programs AS (
    SELECT 
      ps.program_id,
      -- Base score from popularity + recency
      COALESCE(ps.popularity_score, 0) * 0.3 +
      -- CSW Star bonus
      CASE WHEN ug.csw_star THEN 20 ELSE 0 END +
      -- Partner tier bonus
      CASE ug.partner_tier
        WHEN 'platinum' THEN 15
        WHEN 'gold' THEN 10
        WHEN 'silver' THEN 5
        WHEN 'bronze' THEN 2
        ELSE 0
      END +
      -- CSW Recommended bonus
      CASE WHEN pg.csw_recommended THEN 15 ELSE 0 END +
      -- Budget fit bonus
      CASE WHEN v_budget_max IS NOT NULL AND ps.tuition_usd_min <= v_budget_max THEN 10 ELSE 0 END +
      -- Has dorm bonus
      CASE WHEN ps.has_dorm THEN 5 ELSE 0 END +
      -- Priority from guidance
      COALESCE(pg.priority, 0)
      AS total_score,
      
      -- Build reason codes array
      ARRAY_REMOVE(ARRAY[
        CASE WHEN ug.csw_star THEN 'CSW_STAR' END,
        CASE WHEN ug.partner_tier IN ('platinum', 'gold') THEN 'PARTNER_PRIORITY' END,
        CASE WHEN pg.csw_recommended THEN 'CSW_RECOMMENDED' END,
        CASE WHEN v_budget_max IS NOT NULL AND ps.tuition_usd_min <= v_budget_max THEN 'BUDGET_FIT' END,
        CASE WHEN ps.has_dorm THEN 'HAS_DORM' END,
        CASE WHEN ps.tuition_usd_min < 5000 THEN 'LOW_TUITION' END,
        CASE WHEN ps.tuition_usd_min BETWEEN 5000 AND 10000 THEN 'MID_TUITION' END
      ], NULL) AS reasons,
      
      -- Guidance for staff only
      CASE WHEN v_is_staff THEN
        jsonb_build_object(
          'partner_tier', ug.partner_tier,
          'csw_star', ug.csw_star,
          'selling_points', ug.selling_points,
          'staff_notes', pg.staff_notes,
          'pitch_staff', ug.pitch_staff_i18n
        )
      ELSE NULL
      END AS staff_guidance
      
    FROM vw_program_search_api ps
    LEFT JOIN csw_university_guidance ug ON ug.university_id = ps.university_id
    LEFT JOIN csw_program_guidance pg ON pg.program_id = ps.program_id
    WHERE 
      -- Exclude do_not_offer
      COALESCE(ug.do_not_offer, false) = false
      AND COALESCE(pg.do_not_offer, false) = false
      -- Apply budget filter if provided
      AND (v_budget_max IS NULL OR ps.tuition_usd_min <= v_budget_max)
  )
  SELECT 
    sp.program_id,
    sp.total_score AS score,
    sp.reasons AS reason_codes,
    sp.staff_guidance AS guidance
  FROM scored_programs sp
  ORDER BY sp.total_score DESC, sp.program_id
  LIMIT p_limit;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.compute_recommendations_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_recommendations_v2 TO anon;