-- Feature flags for quick ingest
INSERT INTO feature_flags (key, enabled, payload) 
VALUES 
  ('unis_ingest_quick_enabled', true, '{"description": "Enable quick ingest from text/PDF"}'::jsonb),
  ('unis_dual_ai_enabled', false, '{"description": "Enable dual AI verification (Gemini + OpenAI)"}'::jsonb),
  ('unis_ingest_auto_apply_default', false, '{"description": "Auto-apply safe items by default"}'::jsonb)
ON CONFLICT (key) DO UPDATE 
  SET payload = EXCLUDED.payload, 
      updated_at = now();
