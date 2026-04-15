-- Fix compute_recommendations_v2: Staff check from DB ONLY, ignore p_audience for security
CREATE OR REPLACE FUNCTION public.compute_recommendations_v2(
  p_user_id uuid DEFAULT NULL,
  p_visitor_id text DEFAULT NULL,
  p_filters jsonb DEFAULT '{}'::jsonb,
  p_audience text DEFAULT 'public',
  p_limit integer DEFAULT 24
)
RETURNS TABLE(program_id uuid, score numeric, reason_codes text[], guidance jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_country_pref TEXT;
  v_budget_max NUMERIC;
  v_is_staff BOOLEAN := false;
  v_auth_uid UUID;
BEGIN
  -- SECURITY: Get auth.uid() once and compute staff status from DB ONLY
  -- NEVER trust p_audience for security decisions
  v_auth_uid := auth.uid();
  
  IF v_auth_uid IS NOT NULL THEN
    -- Staff = admin role in user_roles table
    v_is_staff := COALESCE(public.has_role(v_auth_uid, 'admin'), false);
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
      -- Base score from CSW priority + tuition tier
      CASE WHEN ug.csw_star THEN 25 ELSE 0 END +
      CASE ug.partner_tier
        WHEN 'platinum' THEN 20
        WHEN 'gold' THEN 15
        WHEN 'silver' THEN 10
        WHEN 'bronze' THEN 5
        ELSE 0
      END +
      CASE WHEN pg.csw_recommended THEN 18 ELSE 0 END +
      CASE WHEN v_budget_max IS NOT NULL AND ps.tuition_usd_min <= v_budget_max THEN 12 ELSE 0 END +
      CASE WHEN ps.has_dorm THEN 8 ELSE 0 END +
      CASE WHEN ps.tuition_usd_min < 3000 THEN 10
           WHEN ps.tuition_usd_min < 6000 THEN 5
           ELSE 0 END +
      COALESCE(pg.priority, 0)
      AS total_score,
      
      -- Build reason codes array (public-safe)
      ARRAY_REMOVE(ARRAY[
        CASE WHEN ug.csw_star THEN 'CSW_STAR' END,
        CASE WHEN ug.partner_tier IN ('platinum', 'gold') THEN 'PARTNER_PRIORITY' END,
        CASE WHEN pg.csw_recommended THEN 'CSW_RECOMMENDED' END,
        CASE WHEN v_budget_max IS NOT NULL AND ps.tuition_usd_min <= v_budget_max THEN 'BUDGET_FIT' END,
        CASE WHEN ps.has_dorm THEN 'HAS_DORM' END,
        CASE WHEN ps.tuition_usd_min < 3000 THEN 'LOW_TUITION' END,
        CASE WHEN ps.tuition_usd_min BETWEEN 3000 AND 6000 THEN 'MID_TUITION' END,
        CASE WHEN ps.ranking IS NOT NULL AND ps.ranking <= 500 THEN 'HIGH_QUALITY' END
      ], NULL) AS reasons,
      
      -- SECURITY: Only return guidance if caller is VERIFIED staff from DB
      CASE WHEN v_is_staff THEN
        jsonb_build_object(
          'partner_tier', ug.partner_tier,
          'csw_star', ug.csw_star,
          'selling_points', ug.selling_points,
          'staff_notes', pg.staff_notes,
          'pitch_staff', ug.pitch_staff_i18n,
          'do_not_offer_reason', CASE WHEN ug.do_not_offer THEN ug.do_not_offer_reason END
        )
      ELSE NULL
      END AS staff_guidance
      
    FROM vw_program_search_api ps
    LEFT JOIN csw_university_guidance ug ON ug.university_id = ps.university_id
    LEFT JOIN csw_program_guidance pg ON pg.program_id = ps.program_id
    WHERE 
      -- Filter out do_not_offer programs
      COALESCE(ug.do_not_offer, false) = false
      AND COALESCE(pg.do_not_offer, false) = false
      -- Only published active programs
      AND ps.publish_status = 'published'
      AND COALESCE(ps.is_active, true) = true
      -- Apply budget filter if provided
      AND (v_budget_max IS NULL OR ps.tuition_usd_min IS NULL OR ps.tuition_usd_min <= v_budget_max)
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