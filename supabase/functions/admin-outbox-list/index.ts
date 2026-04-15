import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("target") || "crm";

    const { data: items } = await supabase
      .from("integration_outbox")
      .select("id, status, created_at, event_type")
      .eq("target", target)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: allItems } = await supabase
      .from("integration_outbox")
      .select("status")
      .eq("target", target);

    const counts = { pending: 0, sent: 0, error: 0 };
    allItems?.forEach((item: any) => {
      if (item.status in counts) counts[item.status as keyof typeof counts]++;
    });

    return new Response(
      JSON.stringify({ items: items || [], counts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
