DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'crawler_runs','crawler_run_items','crawler_targets','crawler_locks','crawler_telemetry',
    'evidence_items','evidence_validation_rules','publish_audit_trail','program_curriculum_draft',
    'housing_draft','housing_price_draft','housing_media_draft','leadership_draft','media_draft',
    'orx_mapping_rules'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service_full', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service_only', t
    );
  END LOOP;
END $$;