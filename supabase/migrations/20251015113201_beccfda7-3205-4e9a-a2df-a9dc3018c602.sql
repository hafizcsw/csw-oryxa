-- إصلاح Security Definer View warning
-- إعادة إنشاء programs_view بدون SECURITY DEFINER
drop view if exists programs_view;

create view programs_view
with (security_invoker = true)
as
select
  p.id as program_id,
  p.title,
  d.slug as degree_slug,
  u.id as university_id,
  u.name as university_name,
  c.slug as country_slug,
  u.city,
  u.annual_fees,
  u.monthly_living,
  p.languages,
  p.next_intake,
  u.ranking,
  p.accepted_certificates,
  p.description
from programs p
join universities u on u.id = p.university_id and u.is_active = true
left join degrees d on d.id = p.degree_id
left join countries c on c.id = u.country_id
where p.is_active = true;