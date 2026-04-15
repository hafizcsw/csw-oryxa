-- Update the entry_type check constraint to include payment_received
ALTER TABLE public.notarized_ledger DROP CONSTRAINT notarized_ledger_entry_type_check;

ALTER TABLE public.notarized_ledger ADD CONSTRAINT notarized_ledger_entry_type_check 
CHECK (entry_type = ANY (ARRAY['charge'::text, 'refund'::text, 'adjustment'::text, 'fee'::text, 'payment_received'::text]));