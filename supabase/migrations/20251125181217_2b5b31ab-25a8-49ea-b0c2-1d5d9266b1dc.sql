-- إنشاء جدول web_chat_sessions لإدارة حالة الجلسة
CREATE TABLE IF NOT EXISTS web_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_conversation_id TEXT UNIQUE NOT NULL,
  stage TEXT NOT NULL DEFAULT 'initial' CHECK (stage IN ('initial', 'awaiting_phone', 'awaiting_otp', 'authenticated')),
  phone TEXT,
  normalized_phone TEXT,
  customer_id TEXT,
  locale TEXT DEFAULT 'ar',
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_web_chat_sessions_conv ON web_chat_sessions(external_conversation_id);

-- Trigger لتحديث updated_at
CREATE OR REPLACE FUNCTION update_web_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_web_chat_sessions_updated_at
  BEFORE UPDATE ON web_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_web_chat_sessions_updated_at();

-- RLS
ALTER TABLE web_chat_sessions ENABLE ROW LEVEL SECURITY;

-- السماح بالوصول الكامل من service role (Edge Functions)
CREATE POLICY "Service role full access" ON web_chat_sessions 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);