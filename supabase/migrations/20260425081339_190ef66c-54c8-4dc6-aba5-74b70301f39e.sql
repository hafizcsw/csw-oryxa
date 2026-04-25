-- =====================================================================
-- COMM CALLS: Voice/Video/Screen-share over WebRTC P2P
-- =====================================================================

-- 1. Calls table
CREATE TABLE IF NOT EXISTS public.comm_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL,
  caller_id UUID NOT NULL,
  callee_id UUID NOT NULL,
  call_type TEXT NOT NULL CHECK (call_type IN ('audio','video')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','accepted','declined','missed','ended','failed','cancelled')),
  has_screen_share BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  recording_url TEXT,
  end_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_calls_thread ON public.comm_calls(thread_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_calls_caller ON public.comm_calls(caller_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_calls_callee ON public.comm_calls(callee_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_comm_calls_status ON public.comm_calls(status) WHERE status = 'ringing';

ALTER TABLE public.comm_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their calls"
  ON public.comm_calls FOR SELECT
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE POLICY "Caller can create calls"
  ON public.comm_calls FOR INSERT
  WITH CHECK (auth.uid() = caller_id);

CREATE POLICY "Participants can update their calls"
  ON public.comm_calls FOR UPDATE
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_comm_calls_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comm_calls_updated_at ON public.comm_calls;
CREATE TRIGGER trg_comm_calls_updated_at
  BEFORE UPDATE ON public.comm_calls
  FOR EACH ROW EXECUTE FUNCTION public.tg_comm_calls_set_updated_at();

-- 2. WebRTC signaling table
CREATE TABLE IF NOT EXISTS public.comm_call_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.comm_calls(id) ON DELETE CASCADE,
  from_user UUID NOT NULL,
  to_user UUID NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer','answer','ice','renegotiate','screen-start','screen-stop')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_signals_call ON public.comm_call_signals(call_id, created_at);
CREATE INDEX IF NOT EXISTS idx_call_signals_to ON public.comm_call_signals(to_user, created_at DESC);

ALTER TABLE public.comm_call_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read their signals"
  ON public.comm_call_signals FOR SELECT
  USING (auth.uid() = from_user OR auth.uid() = to_user);

CREATE POLICY "Participants can send signals"
  ON public.comm_call_signals FOR INSERT
  WITH CHECK (
    auth.uid() = from_user
    AND EXISTS (
      SELECT 1 FROM public.comm_calls c
      WHERE c.id = call_id
        AND (c.caller_id = auth.uid() OR c.callee_id = auth.uid())
    )
  );

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.comm_call_signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comm_calls;
ALTER TABLE public.comm_call_signals REPLICA IDENTITY FULL;
ALTER TABLE public.comm_calls REPLICA IDENTITY FULL;

-- 3. Storage bucket for call recordings
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Call participants can read recordings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'call-recordings'
    AND EXISTS (
      SELECT 1 FROM public.comm_calls c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.caller_id = auth.uid() OR c.callee_id = auth.uid())
    )
  );

CREATE POLICY "Call participants can upload recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'call-recordings'
    AND EXISTS (
      SELECT 1 FROM public.comm_calls c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.caller_id = auth.uid() OR c.callee_id = auth.uid())
    )
  );