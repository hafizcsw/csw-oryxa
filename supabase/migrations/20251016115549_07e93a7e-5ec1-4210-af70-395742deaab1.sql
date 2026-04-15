-- Add missing columns to integration_outbox for CRM/WhatsApp integration
ALTER TABLE integration_outbox 
  ADD COLUMN IF NOT EXISTS target text DEFAULT 'crm',
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_outbox_target_status 
  ON integration_outbox(target, status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_outbox_idempotency 
  ON integration_outbox(idempotency_key);

-- Add unique constraint to prevent duplicate idempotency keys
ALTER TABLE integration_outbox 
  ADD CONSTRAINT uq_outbox_idempotency UNIQUE (idempotency_key);