-- RPC to atomically mark a phase as done for a university
CREATE OR REPLACE FUNCTION public.rpc_d5_mark_phase_done(
  p_source_name text,
  p_external_id text,
  p_phase text
) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.university_external_ids
  SET 
    last_seen_at = now(),
    phases_done = CASE 
      WHEN p_phase = ANY(phases_done) THEN phases_done
      ELSE array_append(phases_done, p_phase)
    END
  WHERE source_name = p_source_name AND external_id = p_external_id;
$$;