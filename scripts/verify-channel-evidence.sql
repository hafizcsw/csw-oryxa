-- Verify portal channel guard evidence (run in CRM DB)
-- Expected acceptance:
--   Q2 rows = []
--   Q4 rows = []
--   Q5 may contain rejections/warnings, but telemetry_channel must not be web/unknown/rejected

select public.rpc_channel_guard_evidence(5) as evidence;

-- Flatten checks
with ev as (
  select public.rpc_channel_guard_evidence(5) as j
)
select
  coalesce(jsonb_array_length(j->'query_2'->'rows'), 0) as q2_count,
  coalesce(jsonb_array_length(j->'query_4'->'rows'), 0) as q4_count,
  coalesce(jsonb_array_length(j->'query_5'->'rows'), 0) as q5_count
from ev;

-- Q5 pollution check: should return 0 rows
with ev as (
  select public.rpc_channel_guard_evidence(5) as j
), q5 as (
  select jsonb_array_elements(coalesce(j->'query_5'->'rows','[]'::jsonb)) as row
  from ev
)
select row
from q5
where coalesce(row->>'telemetry_channel','') in ('web','unknown','rejected');
