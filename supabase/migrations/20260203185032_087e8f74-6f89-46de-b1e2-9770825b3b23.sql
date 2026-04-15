-- Add delivery columns to notarized_translation_orders
ALTER TABLE notarized_translation_orders 
ADD COLUMN IF NOT EXISTS delivery_destination TEXT CHECK (delivery_destination IN ('university', 'dormitory', 'embassy', 'digital'));

ALTER TABLE notarized_translation_orders 
ADD COLUMN IF NOT EXISTS delivery_address JSONB DEFAULT NULL;

ALTER TABLE notarized_translation_orders 
ADD COLUMN IF NOT EXISTS estimated_completion_at TIMESTAMPTZ DEFAULT NULL;

-- Add notification preferences column
ALTER TABLE notarized_translation_orders 
ADD COLUMN IF NOT EXISTS notification_channels TEXT[] DEFAULT ARRAY['email']::TEXT[];