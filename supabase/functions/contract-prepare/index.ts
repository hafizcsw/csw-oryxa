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

function replaceTokens(template: string, data: any): string {
  return template.replace(/\{\{\s*([\w\.]+)\s*\}\}/g, (_, key) => {
    const value = key.split('.').reduce((obj: any, k: string) => obj?.[k], data);
    return value ?? '';
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('[contract-prepare] Missing or invalid Authorization header');
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
      console.log('[contract-prepare] Invalid JWT token:', authError?.message);
      return new Response(
        JSON.stringify({ ok: false, error: 'invalid_token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[contract-prepare] Authenticated user:', user.id);

    const body = await req.json();
    const { student_user_id, template_id, program, payment, policy, company } = body;

    // Validate ownership: user can only create contracts for themselves, or admin can create for others
    const targetUserId = student_user_id || user.id;
    const userIsAdmin = await isAdmin(user.id);
    
    if (user.id !== targetUserId && !userIsAdmin) {
      console.log('[contract-prepare] Forbidden: user', user.id, 'cannot create contract for', targetUserId);
      return new Response(
        JSON.stringify({ ok: false, error: 'forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active template
    let templateId = template_id;
    let templateHtml = '';

    if (!templateId) {
      const { data: template } = await srv
        .from('contract_templates')
        .select('id, body_html')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .single();
      
      templateId = template?.id;
      templateHtml = template?.body_html || '';
    } else {
      const { data: template } = await srv
        .from('contract_templates')
        .select('body_html')
        .eq('id', templateId)
        .single();
      templateHtml = template?.body_html || '';
    }

    // Get student data
    const { data: student } = await srv
      .from('profiles')
      .select('full_name, email, phone')
      .eq('user_id', targetUserId)
      .single();

    const today = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const model = {
      student: student || { full_name: 'الطالب', email: '', phone: '' },
      program: program || { name: '', country: '' },
      payment: payment || { amount: '', currency: '' },
      policy: policy || { refund: 'حسب السياسة المعتمدة' },
      company: company || { name: 'المؤسسة التعليمية' },
      today
    };

    const html = replaceTokens(templateHtml, model);

    // Create contract
    const { data: contract } = await srv
      .from('contracts')
      .insert({
        student_user_id: targetUserId,
        template_id: templateId,
        data: model,
        html_render: html,
        status: 'draft'
      })
      .select()
      .single();

    console.log('[contract-prepare] Contract created:', contract?.id, 'for user:', targetUserId);

    return new Response(
      JSON.stringify({ ok: true, contract_id: contract.id, html }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[contract-prepare] Error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: 'internal_error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
