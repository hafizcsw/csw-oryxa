-- LAV #15.3: Feature Flags Setup

INSERT INTO feature_flags(key, enabled, payload) VALUES
  ('automation.portal_stage_move', false, '{"description":"Auto-move on portal submission"}'::jsonb),
  ('automation.payment_stage_move', false, '{"description":"Auto-move on payment success"}'::jsonb),
  ('automation.docs_stage_move', false, '{"description":"Auto-move on docs approval"}'::jsonb),
  ('automation.allow_stage_deadline', true, '{"description":"Enable deadline tracking per stage"}'::jsonb),
  ('automation.pilot_customer_ids', false, '{"customer_ids":[]}'::jsonb),
  ('bot.auto_move_cards', false, '{"description":"Bot auto-moves cards between stages"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  enabled = EXCLUDED.enabled,
  payload = EXCLUDED.payload,
  updated_at = now();