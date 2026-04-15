import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireAdmin(req);
  if (!authResult.ok) {
    return new Response(
      JSON.stringify({ error: authResult.error }),
      { status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { srv } = authResult;

  try {
    const { ids, action } = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['publish', 'reject', 'archive'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updates: any = {};

    if (action === 'publish') {
      updates.status = 'published';
      updates.published_at = new Date().toISOString();
    } else if (action === 'reject') {
      updates.status = 'archived';
    } else if (action === 'archive') {
      updates.status = 'archived';
    }

    const { data, error } = await srv
      .from('scholarships')
      .update(updates)
      .in('id', ids)
      .select();

    if (error) throw error;

    console.log(`[admin-scholarships-publish] ${action} ${ids.length} scholarships`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        updated: data?.length || 0,
        action
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[admin-scholarships-publish] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
