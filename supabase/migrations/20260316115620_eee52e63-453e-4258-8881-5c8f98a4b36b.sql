-- Approve program-level ORX scores for programs belonging to beta_approved universities
-- Only approve programs with scored status, non-null score, and published facts
UPDATE orx_scores
SET exposure_status = 'beta_approved',
    calibration_passed = true,
    updated_at = now()
WHERE entity_type = 'program'
  AND entity_id IN ('6ef82ac4-8601-4261-a3eb-36d37405aa90', '0bc90c33-3224-4c33-b414-a08e3007e9de')
  AND status = 'scored'
  AND score IS NOT NULL;