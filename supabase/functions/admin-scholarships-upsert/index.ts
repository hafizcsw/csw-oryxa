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
    const body = await req.json();
    const { scholarship } = body;

    if (!scholarship || !scholarship.university_id || !scholarship.title) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate content hash for deduplication
    const contentHash = await generateHash(
      scholarship.title + 
      (scholarship.description || '') + 
      (scholarship.amount || '') +
      (scholarship.university_id || '')
    );

    scholarship.content_hash = contentHash;

    // Check if scholarship with same hash exists
    const { data: existing } = await srv
      .from('scholarships')
      .select('id')
      .eq('content_hash', contentHash)
      .single();

    let result;

    if (existing && existing.id && scholarship.id !== existing.id) {
      // Update existing
      const { data, error } = await srv
        .from('scholarships')
        .update({
          ...scholarship,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = { ok: true, action: 'updated', scholarship: data };
    } else if (scholarship.id) {
      // Update by ID
      const { data, error } = await srv
        .from('scholarships')
        .update({
          ...scholarship,
          updated_at: new Date().toISOString()
        })
        .eq('id', scholarship.id)
        .select()
        .single();

      if (error) throw error;
      result = { ok: true, action: 'updated', scholarship: data };
    } else {
      // Insert new
      const { data, error } = await srv
        .from('scholarships')
        .insert({
          ...scholarship,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      result = { ok: true, action: 'inserted', scholarship: data };
    }

    console.log(`[admin-scholarships-upsert] ${result.action} scholarship ${result.scholarship.id}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[admin-scholarships-upsert] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
