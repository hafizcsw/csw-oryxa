-- D1 counters by job
select id as job_id, created_at, programs_discovered, programs_valid, programs_saved, programs_rejected
from uniranks_enrich_jobs
order by created_at desc
limit 20;

-- D2 error accounting
select pipeline, reason, count(*) as total
from ingest_errors
group by 1,2
order by total desc
limit 20;

-- D8/D10 coverage snapshot
select * from program_quality_v3
order by ready_to_publish_count desc
limit 20;

-- Evidence sample for unified_v2 drafts
select
  id,
  title,
  extracted_json->'tuition'->>'basis' as tuition_basis,
  extracted_json->'tuition'->>'scope' as tuition_scope,
  field_evidence_map->'tuition.basis'->>'quote' as tuition_basis_quote,
  field_evidence_map->'tuition.scope'->>'quote' as tuition_scope_quote
from program_draft
where schema_version = 'unified_v2'
order by last_extracted_at desc nulls last
limit 5;
