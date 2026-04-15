
create or replace function public.rpc_reset_uniranks_university(
  p_university_id uuid,
  p_trace_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_deleted int := 0;
begin
  if not public.is_admin(v_user_id) then
    return jsonb_build_object('error','forbidden');
  end if;

  -- Delete program drafts from uniranks extraction
  delete from program_draft
  where university_id = p_university_id
    and coalesce(extractor_version,'') ilike 'uniranks%';
  get diagnostics v_deleted = row_count;

  -- Reset all uniranks-related fields on the university
  update universities
  set
    crawl_status = 'pending',
    uniranks_verified = null,
    uniranks_recognized = null,
    uniranks_badges = null,
    uniranks_top_buckets = null,
    uniranks_rank = null,
    uniranks_score = null,
    uniranks_country_rank = null,
    uniranks_region_rank = null,
    uniranks_world_rank = null,
    uniranks_region_label = null,
    uniranks_sections_present = null,
    uniranks_snapshot = null,
    uniranks_snapshot_at = null,
    uniranks_snapshot_hash = null,
    uniranks_snapshot_trace_id = null,
    uniranks_last_trace_id = null,
    uniranks_program_pages_done = 0,
    uniranks_program_pages_total = null,
    uniranks_data_quality = null,
    uniranks_last_reviewed_at = null,
    uniranks_last_reviewed_by = null
  where id = p_university_id;

  -- Telemetry
  insert into pipeline_health_events(pipeline, event_type, details_json)
  values ('crawl_review','reset_uniranks_university',
    jsonb_build_object(
      'trace_id', p_trace_id,
      'university_id', p_university_id,
      'deleted_program_drafts', v_deleted,
      'actor_id', v_user_id
    )
  );

  return jsonb_build_object('ok', true, 'deleted_program_drafts', v_deleted);
end;
$$;
