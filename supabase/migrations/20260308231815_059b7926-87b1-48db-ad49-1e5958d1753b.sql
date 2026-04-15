DROP VIEW IF EXISTS public.vw_program_details;
CREATE VIEW public.vw_program_details AS
SELECT p.id AS program_id,
    p.title AS program_name,
    p.duration_months,
    p.ielts_required,
    p.next_intake_date,
    p.next_intake,
    p.description,
    p.languages,
    p.accepted_certificates,
    p.degree_id,
    d.name AS degree_name,
    d.slug AS degree_slug,
    u.id AS university_id,
    u.name AS university_name,
    u.name_ar AS university_name_ar,
    u.name_en AS university_name_en,
    u.city,
    u.logo_url,
    u.ranking,
    u.annual_fees AS fees_yearly,
    u.monthly_living,
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