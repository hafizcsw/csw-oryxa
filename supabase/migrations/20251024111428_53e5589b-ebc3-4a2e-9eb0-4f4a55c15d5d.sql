-- إصلاح مشاكل الحصاد: إضافة view لملخص الوظائف
create or replace view vw_harvest_job_summary as
select 
  hj.id as job_id,
  hj.kind,
  hj.country_code,
  hj.audience,
  hj.status as job_status,
  hj.created_at,
  hj.started_at,
  hj.finished_at,
  count(hr.id) as runs_count,
  sum(case when hr.state = 'done' then 1 else 0 end) as runs_done,
  sum(case when hr.state = 'error' then 1 else 0 end) as runs_error,
  sum(coalesce(hr.processed, 0)) as total_processed,
  sum(coalesce(hr.changed, 0)) as total_changed,
  sum(coalesce(hr.errors, 0)) as total_errors
from harvest_jobs hj
left join harvest_runs hr on hr.job_id = hj.id
group by hj.id, hj.kind, hj.country_code, hj.audience, hj.status, hj.created_at, hj.started_at, hj.finished_at;