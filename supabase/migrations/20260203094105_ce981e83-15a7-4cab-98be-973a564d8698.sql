-- Fix permissions for conversion function
GRANT EXECUTE ON FUNCTION public.to_payment_minor_units(TEXT, NUMERIC) TO anon;
GRANT EXECUTE ON FUNCTION public.to_payment_minor_units(TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.to_payment_minor_units(TEXT, NUMERIC) TO service_role;