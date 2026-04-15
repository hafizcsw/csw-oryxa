CREATE OR REPLACE VIEW public.vw_university_card AS
SELECT u.id,
    u.name,
    u.city,
    u.logo_url,
    COALESCE(
      u.main_image_url,
      u.hero_image_url,
      (SELECT COALESCE(um.public_url, um.source_url) FROM university_media um 
       WHERE um.university_id = u.id AND um.image_type = 'gallery' 
       ORDER BY um.is_primary DESC NULLS LAST, um.sort_order ASC NULLS LAST, um.created_at ASC 
       LIMIT 1)
    ) AS image_url,
    u.annual_fees,
    u.monthly_living,
    u.description,
    u.acceptance_rate,
    u.enrolled_students,
    u.has_dorm,
    u.dorm_price_monthly_local,
    u.university_type,
    qs.world_rank AS qs_world_rank,
    qs.national_rank AS qs_national_rank,
    ur.world_rank AS uniranks_national_rank,
    COALESCE(qs.world_rank, ur.world_rank) AS world_rank,
    c.id AS country_id,
    c.slug AS country_slug,
    c.name_ar AS country_name,
    COALESCE(c.currency_code, 'USD'::bpchar) AS currency_code,
    s.min_duration_months,
    s.min_ielts_required,
    s.next_intake_date,
    s.degree_ids,
    s.program_count,
    s.tuition_usd_min,
    s.tuition_usd_max
   FROM universities u
     JOIN countries c ON c.id = u.country_id
     LEFT JOIN vw_university_program_signals s ON s.university_id = u.id
     LEFT JOIN institution_rankings qs ON qs.institution_id = u.id AND qs.ranking_system = 'qs'::text AND qs.is_primary = true
     LEFT JOIN institution_rankings ur ON ur.institution_id = u.id AND ur.ranking_system = 'uniranks'::text AND ur.is_primary = true
  WHERE COALESCE(u.is_active, true) = true;