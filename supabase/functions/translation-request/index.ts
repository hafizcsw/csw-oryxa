import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const srv = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Require admin access
  const guard = await requireAdmin(req);
  if (!guard.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: guard.error }),
      { status: guard.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const {
      student_user_id,
      doc_kind,
      input_path,
      source_lang = 'ar',
      target_lang = 'en',
      provider = 'simple_bot'
    } = body;

    const { data, error } = await srv
      .from('translation_requests')
      .insert({
        student_user_id,
        doc_kind,
        input_path,
        source_lang,
        target_lang,
        provider,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ ok: false, error: String(error) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, request_id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
