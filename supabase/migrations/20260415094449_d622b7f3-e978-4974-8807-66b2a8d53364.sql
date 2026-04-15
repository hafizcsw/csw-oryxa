
-- 1. Fix search_path on all 30 functions
ALTER FUNCTION public.rpc_map_city_universities SET search_path = public;
ALTER FUNCTION public.handle_updated_at SET search_path = public;
ALTER FUNCTION public.validate_program_publish_gate_insert SET search_path = public;
ALTER FUNCTION public.trigger_set_updated_at SET search_path = public;
ALTER FUNCTION public.enqueue_email SET search_path = public;
ALTER FUNCTION public.rpc_we_lock_batch SET search_path = public;
ALTER FUNCTION public.get_translation_price_config SET search_path = public;
ALTER FUNCTION public.map_subject_to_discipline_id SET search_path = public;
ALTER FUNCTION public.rpc_map_city_summary SET search_path = public;
ALTER FUNCTION public.set_claim_submitted_at SET search_path = public;
ALTER FUNCTION public.update_student_delivery_requests_v1_updated_at SET search_path = public;
ALTER FUNCTION public.to_payment_minor_units SET search_path = public;
ALTER FUNCTION public.map_degree_text_to_id SET search_path = public;
ALTER FUNCTION public.move_to_dlq SET search_path = public;
ALTER FUNCTION public.translation_source_hash SET search_path = public;
ALTER FUNCTION public.get_countries_with_stats SET search_path = public;
ALTER FUNCTION public.delete_email SET search_path = public;
ALTER FUNCTION public.update_portal_files_v1_updated_at SET search_path = public;
ALTER FUNCTION public.orx_scores_update_timestamp SET search_path = public;
ALTER FUNCTION public.rpc_map_country_universities SET search_path = public;
ALTER FUNCTION public.enrichment_facts_update_timestamp SET search_path = public;
ALTER FUNCTION public.rpc_door2_batch_progress SET search_path = public;
ALTER FUNCTION public.tg_portal_payments_set_receipt_no SET search_path = public;
ALTER FUNCTION public.kb_require_column SET search_path = public;
ALTER FUNCTION public.trg_orx_dim_facts_updated_at SET search_path = public;
ALTER FUNCTION public.kb_require_table SET search_path = public;
ALTER FUNCTION public.handle_staging_updated_at SET search_path = public;
ALTER FUNCTION public.read_email_batch SET search_path = public;
ALTER FUNCTION public.rpc_map_country_summary SET search_path = public;
ALTER FUNCTION public.validate_program_publish_gate SET search_path = public;

-- 2. Tighten RLS policies
DROP POLICY IF EXISTS "Service role inserts activity logs" ON public.page_activity_log;
CREATE POLICY "Authenticated inserts activity logs" ON public.page_activity_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service role inserts mutation history" ON public.page_mutation_history;
CREATE POLICY "Authenticated inserts mutation history" ON public.page_mutation_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert teacher notes" ON public.teacher_notes;
CREATE POLICY "Authenticated users insert teacher notes" ON public.teacher_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Move pg_trgm only (pg_net doesn't support SET SCHEMA)
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
