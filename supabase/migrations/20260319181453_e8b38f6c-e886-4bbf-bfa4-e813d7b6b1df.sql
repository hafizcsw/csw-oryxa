DROP VIEW IF EXISTS public.vw_program_details;

CREATE VIEW public.vw_program_details WITH (security_invoker = on) AS
SELECT p.id AS program_id,
    p.title AS program_name,
    p.title_ar AS program_name_ar,
    p.title AS program_name_en,
    p.duration_months,
    p.ielts_required,
    p.duolingo_min,
    p.pte_min,
    p.cefr_level,
    p.apply_url,
    p.application_deadline,
    p.next_intake_date,
    p.next_intake,
    p.description,
    p.languages,
    p.accepted_certificates,
    p.degree_id,
    d.name AS degree_name,
    d.name_ar AS degree_name_ar,
    d.name AS degree_name_en,
    d.slug AS degree_slug,
    u.id AS university_id,
    u.name AS university_name,
    u.name_ar AS university_name_ar,
    u.name_en AS university_name_en,
    u.city,
    u.logo_url,
    u.ranking,
    p.tuition_usd_min,
    p.tuition_usd_max,
    p.tuition_basis,
    p.currency_code AS program_currency,
    u.monthly_living AS university_monthly_living,
    c.id AS country_id,
    c.name_ar AS country_name,
    c.name_ar AS country_name_ar,
    c.name_en AS country_name_en,
    c.slug AS country_slug,
    c.currency_code
   FROM programs p
     JOIN universities u ON u.id = p.university_id
     JOIN countries c ON c.id = u.country_id
     LEFT JOIN degrees d ON d.id = p.degree_id
  WHERE COALESCE(p.is_active, true) AND COALESCE(u.is_active, true);

DROP VIEW IF EXISTS public.vw_program_search;

CREATE VIEW public.vw_program_search WITH (security_invoker = on) AS
SELECT p.id AS program_id,
    p.title AS program_name,
    p.description,
    p.duration_months,
    p.ielts_required,
    p.duolingo_min,
    p.pte_min,
    p.cefr_level,
    p.apply_url,
    p.application_deadline,
    p.languages,
    p.next_intake,
    p.next_intake_date,
    p.accepted_certificates,
    u.id AS university_id,
    u.name AS university_name,
    u.city,
    u.logo_url,
    u.main_image_url,
    p.tuition_usd_min,
    p.tuition_usd_max,
    p.tuition_basis,
    p.currency_code AS program_currency,
    u.monthly_living AS university_monthly_living,
    u.ranking,
    c.id AS country_id,
    c.slug AS country_slug,
    c.name_ar AS country_name,
    c.currency_code,
    p.degree_id,
    d.name AS degree_name,
    d.slug AS degree_slug
   FROM programs p
     JOIN universities u ON u.id = p.university_id
     JOIN countries c ON c.id = u.country_id
     LEFT JOIN degrees d ON d.id = p.degree_id
  WHERE COALESCE(p.is_active, true) = true AND COALESCE(u.is_active, true) = true;