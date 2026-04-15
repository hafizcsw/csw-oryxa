import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const srv = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await srv.rpc('check_is_admin', { check_user_id: userId });
  return data === true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('[contract-sign] Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ ok: false, error: 'unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user from JWT
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    
    if (authError || !user) {
      console.log('[contract-sign] Invalid JWT token:', authError?.message);
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[contract-sign] Authenticated user:', user.id);

    const body = await req.json();
    const { contract_id, method, signature_png_base64 } = body;

    if (!contract_id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'contract_id_required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch contract to validate ownership
    const { data: existingContract, error: contractError } = await srv
      .from('contracts')
      .select('id, student_user_id, status')
      .eq('id', contract_id)
      .single();

    if (contractError || !existingContract) {
      console.log('[contract-sign] Contract not found:', contract_id);
      return new Response(
        JSON.stringify({ ok: false, error: 'contract_not_found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate ownership: user can only sign their own contracts, or admin can sign for others
    const userIsAdmin = await isAdmin(user.id);
    if (user.id !== existingContract.student_user_id && !userIsAdmin) {
      console.log('[contract-sign] Forbidden: user', user.id, 'cannot sign contract for', existingContract.student_user_id);
      return new Response(
        JSON.stringify({ ok: false, error: 'forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if contract is already signed
    if (existingContract.status === 'signed') {
      return new Response(
        JSON.stringify({ ok: false, error: 'contract_already_signed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let signaturePath = null;

    // Handle drawn signature
    if (method === 'draw' && signature_png_base64) {
      const base64Data = signature_png_base64.split(',').pop() || '';
      const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const path = `signatures/${user.id}/${crypto.randomUUID()}.png`;
      
      await srv.storage
        .from('contracts')
        .upload(path, bytes, { contentType: 'image/png', upsert: true });
      
      signaturePath = path;
    }

    // Record signature - use authenticated user's ID, not from request body
    await srv.from('contract_signatures').insert({
      contract_id,
      signer_user_id: user.id,
      method: method || 'clickwrap',
      ip: req.headers.get('CF-Connecting-IP') || req.headers.get('x-forwarded-for') || '',
      user_agent: req.headers.get('user-agent') || '',
      signature_image_path: signaturePath
    });

    // Update contract status
    const { data: contract } = await srv
      .from('contracts')
      .update({ 
        status: 'signed', 
        signed_at: new Date().toISOString() 
      })
      .eq('id', contract_id)
      .select()
      .single();

    // Send to CRM integration
    await srv.from('integration_outbox').insert({
      target: 'crm',
      event_type: 'contract.signed',
      idempotency_key: `contract:${contract.id}`,
      payload: {
        student_user_id: contract.student_user_id,
        contract_id: contract.id,
        signed_at: contract.signed_at
      },
      status: 'pending',
      next_attempt_at: new Date().toISOString()
    });

    console.log('[contract-sign] Contract signed:', contract?.id, 'by user:', user.id);

    return new Response(
      JSON.stringify({ ok: true, contract }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[contract-sign] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
