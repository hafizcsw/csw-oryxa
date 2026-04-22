-- Persistent portal notifications with per-user cap (50 newest)
CREATE TABLE IF NOT EXISTS public.portal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('identity','support','message','system')),
  title text NOT NULL,
  preview text,
  link_path text,
  source_key text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS portal_notifications_source_uniq
  ON public.portal_notifications (user_id, source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS portal_notifications_user_created_idx
  ON public.portal_notifications (user_id, created_at DESC);

ALTER TABLE public.portal_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.portal_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.portal_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own notifications"
  ON public.portal_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
  ON public.portal_notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Cap: keep only 50 most recent per user
CREATE OR REPLACE FUNCTION public.portal_notifications_enforce_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.portal_notifications
  WHERE user_id = NEW.user_id
    AND id IN (
      SELECT id FROM public.portal_notifications
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      OFFSET 50
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS portal_notifications_cap_trg ON public.portal_notifications;
CREATE TRIGGER portal_notifications_cap_trg
  AFTER INSERT ON public.portal_notifications
  FOR EACH ROW EXECUTE FUNCTION public.portal_notifications_enforce_cap();