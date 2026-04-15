-- LAV #12: Recommendations system - Part 2 (Functions) - Fixed

-- 1) Function to compute recommendations
create or replace function compute_recommendations(
  p_user uuid default null, 
  p_visitor text default null, 
  p_limit int default 24
)
returns table(program_id uuid, score numeric, reason text)
language sql stable 
security definer
set search_path = public
as $$
  with
  last_filters as (
    select
      lower(coalesce(properties->>'country','')) as country,
      lower(coalesce(properties->>'degree','')) as degree,
      upper(coalesce(properties->>'language','')) as language,
      coalesce((properties->>'fees_max')::int, null) as fees_max
    from events
    where (visitor_id = p_visitor or (properties->>'user_id')::uuid = p_user)
      and name in ('assistant_processed','search_clicked','country_page_view')
    order by created_at desc
    limit 1
  ),
  favs as (
    select program_id from user_shortlists where user_id = p_user
  ),
  base as (
    select 
      p.id,
      0.0::numeric as base_score,
      (case when lf.country <> '' and c.slug = lf.country then 8 else 0 end) +
      (case when lf.degree <> '' and d.slug = lf.degree then 6 else 0 end) +
      (case when lf.language <> '' and lf.language = ANY(p.languages) then 4 else 0 end) +
      (case when lf.fees_max is not null and u.annual_fees is not null and u.annual_fees <= lf.fees_max then 5 else 0 end) +
      (case when p.id in (select program_id from favs) then 10 else 0 end) as score_parts
    from programs p
    join degrees d on d.id = p.degree_id
    join universities u on u.id = p.university_id
    join countries c on c.id = u.country_id
    cross join last_filters lf
    where coalesce(p.is_active, true) and coalesce(u.is_active, true)
  )
  select 
    id as program_id,
    (base_score + score_parts)::numeric as score,
    'filters_popularity_mix' as reason
  from base
  where (base_score + score_parts) > 0
  order by 2 desc
  limit p_limit
$$;