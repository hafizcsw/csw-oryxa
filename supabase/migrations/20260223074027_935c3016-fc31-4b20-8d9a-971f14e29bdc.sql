DROP VIEW IF EXISTS vw_program_search CASCADE;

CREATE VIEW vw_program_search AS
SELECT p.id AS program_id,
    p.title AS program_name,
    p.description,
    p.duration_months,
    p.ielts_required,
    p.languages,
    p.next_intake,
    p.next_intake_date,
    p.accepted_certificates,
    u.id AS university_id,
    u.name AS university_name,
    u.city,
    u.logo_url,
    u.main_image_url,
    u.annual_fees AS fees_yearly,
    u.monthly_living,
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