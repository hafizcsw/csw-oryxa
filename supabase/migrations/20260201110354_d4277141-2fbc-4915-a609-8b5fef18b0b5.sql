-- Create email OTP codes table for email verification
CREATE TABLE public.email_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  attempts INT DEFAULT 0
);

-- Create index for faster lookups
CREATE INDEX idx_email_otp_codes_user_id ON public.email_otp_codes(user_id);
CREATE INDEX idx_email_otp_codes_expires_at ON public.email_otp_codes(expires_at);

-- Enable Row Level Security
ALTER TABLE public.email_otp_codes ENABLE ROW LEVEL SECURITY;

-- Users can only view their own OTP codes (for frontend status checking)
CREATE POLICY "Users can view own codes" 
ON public.email_otp_codes 
FOR SELECT 
USING (auth.uid() = user_id);

-- Cleanup function to delete expired codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM public.email_otp_codes WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;