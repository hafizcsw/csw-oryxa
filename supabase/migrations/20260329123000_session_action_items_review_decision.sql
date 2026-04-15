-- Add academic review outcome fields for session action items
ALTER TABLE public.session_action_items
  ADD COLUMN IF NOT EXISTS review_decision text CHECK (review_decision IN ('pass', 'revise', 'reteach')),
  ADD COLUMN IF NOT EXISTS score numeric;

CREATE INDEX IF NOT EXISTS idx_session_actions_review_decision
  ON public.session_action_items(review_decision);
