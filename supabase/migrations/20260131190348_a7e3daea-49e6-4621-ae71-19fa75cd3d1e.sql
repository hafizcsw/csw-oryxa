-- Drop and recreate the view to add hero_image_url and main_image_url
DROP VIEW IF EXISTS public.vw_university_details;

CREATE VIEW public.vw_university_details AS
SELECT 
    u.id AS university_id,
    u.name AS university_name,
    u.city,
    u.logo_url,
    u.hero_image_url,
    u.main_image_url,
    u.ranking,
    u.annual_fees,
    u.monthly_living,
    u.description,
    c.id AS country_id,
    c.name_ar AS country_name,
    c.slug AS country_slug,
    c.currency_code,
    count(p.id) AS programs_count,
    min(p.ielts_required) AS min_program_ielts,
    min(p.next_intake_date) AS next_program_intake
FROM universities u
JOIN countries c ON c.id = u.country_id
LEFT JOIN programs p ON p.university_id = u.id AND COALESCE(p.is_active, true) = true
GROUP BY u.id, c.id;