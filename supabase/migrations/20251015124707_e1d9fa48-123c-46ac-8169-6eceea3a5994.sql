-- Create RPC function to query country top universities (workaround for view typing)
create or replace function get_country_top_universities(p_country_slug text)
returns table (
  university_id uuid,
  university_name text,
  country_slug text,
  ranking int,
  annual_fees numeric,
  monthly_living numeric,
  logo_url text,
  city text
)
language sql
stable
as $$
  select
    u.id as university_id,
    u.name as university_name,
    c.slug as country_slug,
    u.ranking,
    u.annual_fees,
    u.monthly_living,
    u.logo_url,
    u.city
  from universities u
  join countries c on c.id = u.country_id
  where c.slug = p_country_slug
    and coalesce(u.is_active, true)
  order by u.ranking nulls last, u.name
  limit 8;
$$;