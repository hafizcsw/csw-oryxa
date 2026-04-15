-- حذف وإعادة إنشاء view vw_university_search مع إضافة main_image_url
DROP VIEW IF EXISTS vw_university_search CASCADE;

CREATE VIEW vw_university_search AS
SELECT 
  u.id,
  u.name,
  u.city,
  u.logo_url,
  u.main_image_url as image_url,  -- إضافة صورة الجامعة الرئيسية
  u.annual_fees,
  u.monthly_living,
  u.ranking,
  u.description,
  u.website,
  u.is_active,
  c.id AS country_id,
  c.slug AS country_slug,
  c.name AS country_name
FROM universities u
JOIN countries c ON c.id = u.country_id
WHERE COALESCE(u.is_active, true) = true;