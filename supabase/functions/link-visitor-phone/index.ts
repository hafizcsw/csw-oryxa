import { corsHeaders } from '../_shared/auth.ts';
import { getSupabaseAdmin } from '../_shared/supabase.ts';

function normalizePhone(phone: string): string {
  // Remove spaces, convert 00 to +
  let normalized = phone.replace(/\s+/g, '').replace(/^00/, '+');
  // Ensure E.164 format (starts with +)
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }
  return normalized;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { visitor_id, phone } = await req.json();

    if (!visitor_id || !phone) {
      return new Response(
        JSON.stringify({ error: 'visitor_id and phone are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseAdmin();
    const normalizedPhone = normalizePhone(phone);

    // Upsert phone identity
    const { error } = await supabase
      .from('phone_identities')
      .upsert([{ phone: normalizedPhone, visitor_id }], { onConflict: 'phone' });

    if (error) {
      console.error('Error upserting phone identity:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, phone: normalizedPhone }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('link-visitor-phone error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
