import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // User client to get current user
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    // Get current user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('User auth error:', userError);
      return new Response(
        JSON.stringify({ ok: false, error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { code } = await req.json();
    
    if (!code || code.length !== 6) {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Get OTP record
    const { data: otpRecord, error: selectError } = await supabaseAdmin
      .from('email_otp_codes')
      .select('*')
      .eq('user_id', user.id)
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (selectError || !otpRecord) {
      console.log('OTP validation failed:', selectError);
      
      // Increment attempts counter if record exists
      await supabaseAdmin
        .from('email_otp_codes')
        .update({ attempts: supabaseAdmin.rpc('increment_attempts') })
        .eq('user_id', user.id);
      
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_or_expired_code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if too many attempts
    if (otpRecord.attempts >= 3) {
      // Delete the OTP record
      await supabaseAdmin
        .from('email_otp_codes')
        .delete()
        .eq('id', otpRecord.id);
        
      return new Response(
        JSON.stringify({ ok: false, error: 'too_many_attempts' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update user email using admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      {
        email: otpRecord.email,
        email_confirm: true,
      }
    );

    if (updateError) {
      console.error('User update error:', updateError);
      return new Response(
        JSON.stringify({ ok: false, error: 'update_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete the used OTP code
    await supabaseAdmin
      .from('email_otp_codes')
      .delete()
      .eq('id', otpRecord.id);

    console.log(`Email ${otpRecord.email} linked to user ${user.id}`);

    return new Response(
      JSON.stringify({ ok: true, email: otpRecord.email }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: 'unexpected_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
