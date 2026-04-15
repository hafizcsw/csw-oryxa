import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SENDER_DOMAIN = "notify.cswworld.com";
const FROM_DOMAIN = "cswworld.com";
const SITE_NAME = "CSW";

Deno.serve(async (req) => {
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

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // User client to get current user
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
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
    const { email } = await req.json();
    
    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // Delete any existing OTP codes for this user
    await supabaseAdmin
      .from('email_otp_codes')
      .delete()
      .eq('user_id', user.id);

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    const { error: insertError } = await supabaseAdmin
      .from('email_otp_codes')
      .insert({
        user_id: user.id,
        email: normalizedEmail,
        code: otp,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ ok: false, error: 'database_error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email via Lovable transactional email queue
    const messageId = crypto.randomUUID();
    const htmlContent = `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1a1a2e; margin-bottom: 10px;">كود التحقق</h1>
          <p style="color: #666;">استخدم هذا الكود لربط بريدك الإلكتروني بحسابك</p>
        </div>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 20px 0;">
          <span style="font-size: 36px; font-weight: bold; color: white; letter-spacing: 8px;">${otp}</span>
        </div>
        
        <div style="text-align: center; color: #888; font-size: 14px;">
          <p>هذا الكود صالح لمدة <strong>10 دقائق</strong></p>
          <p>إذا لم تطلب هذا الكود، يمكنك تجاهل هذا الإيميل</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <div style="text-align: center; color: #aaa; font-size: 12px;">
          <p>CSW - خدمات الطلاب العالمية</p>
        </div>
      </div>
    `;

    // Ensure unsubscribe token exists (required for transactional queue sends)
    let unsubscribeToken: string;
    const { data: existingToken, error: tokenLookupError } = await supabaseAdmin
      .from('email_unsubscribe_tokens')
      .select('token, used_at')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (tokenLookupError) {
      console.error('Unsubscribe token lookup error:', tokenLookupError);
      return new Response(
        JSON.stringify({ ok: false, error: 'database_error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingToken && !existingToken.used_at) {
      unsubscribeToken = existingToken.token;
    } else {
      unsubscribeToken = crypto.randomUUID().replace(/-/g, '');
      const { error: tokenUpsertError } = await supabaseAdmin
        .from('email_unsubscribe_tokens')
        .upsert(
          { email: normalizedEmail, token: unsubscribeToken, used_at: null },
          { onConflict: 'email' }
        );

      if (tokenUpsertError) {
        console.error('Unsubscribe token upsert error:', tokenUpsertError);
        return new Response(
          JSON.stringify({ ok: false, error: 'database_error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: storedToken, error: tokenReReadError } = await supabaseAdmin
        .from('email_unsubscribe_tokens')
        .select('token')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (tokenReReadError || !storedToken?.token) {
        console.error('Unsubscribe token read-back error:', tokenReReadError);
        return new Response(
          JSON.stringify({ ok: false, error: 'database_error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      unsubscribeToken = storedToken.token;
    }

    // Log pending
    await supabaseAdmin.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'email_otp',
      recipient_email: normalizedEmail,
      status: 'pending',
    });

    const { error: enqueueError } = await supabaseAdmin.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        idempotency_key: `email_otp:${user.id}:${messageId}`,
        to: normalizedEmail,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: 'كود التحقق - CSW',
        html: htmlContent,
        text: `كود التحقق الخاص بك: ${otp}\n\nهذا الكود صالح لمدة 10 دقائق.`,
        purpose: 'transactional',
        label: 'email_otp',
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error('Email enqueue error:', enqueueError);
      return new Response(
        JSON.stringify({ ok: false, error: 'email_send_failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`OTP sent to ${normalizedEmail} for user ${user.id}`);
    console.log(`OTP enqueued with message_id: ${messageId}`);

    return new Response(
      JSON.stringify({ ok: true }),
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
