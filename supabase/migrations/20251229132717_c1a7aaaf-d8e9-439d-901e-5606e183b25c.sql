-- Allow CRM stage 'guest' to be stored in local chat session cache
ALTER TABLE public.web_chat_sessions
  DROP CONSTRAINT IF EXISTS web_chat_sessions_stage_check;

ALTER TABLE public.web_chat_sessions
  ADD CONSTRAINT web_chat_sessions_stage_check
  CHECK (
    stage = ANY (
      ARRAY[
        'initial'::text,
        'guest'::text,
        'awaiting_phone'::text,
        'awaiting_otp'::text,
        'authenticated'::text
      ]
    )
  );
