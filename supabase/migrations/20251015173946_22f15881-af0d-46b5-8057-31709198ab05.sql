-- LAV #15.E1: Feature Flag for Voice Bot
INSERT INTO feature_flags(key, enabled, payload) VALUES
  ('feature.voice_bot_enabled', false, '{"description":"Voice bot STT->intent->search->TTS"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  enabled = EXCLUDED.enabled,
  payload = EXCLUDED.payload,
  updated_at = now();