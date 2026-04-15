import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const preflightResponse = handleCorsPreflight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // جلب المقترحات مع معلومات الجامعة والـsnapshots
    const { data: proposals, error } = await supabase
      .from("tuition_change_proposals")
      .select(`
        *,
        university:universities(id, name, country_code),
        old_snapshot:tuition_snapshots!tuition_change_proposals_old_snapshot_fkey(amount, currency, academic_year, source_url),
        new_snapshot:tuition_snapshots!tuition_change_proposals_new_snapshot_fkey(amount, currency, academic_year, source_url)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const formatted = proposals?.map((p: any) => ({
      id: p.id,
      university_id: p.university?.id,
      university_name: p.university?.name,
      country_code: p.university?.country_code,
      old_amount: p.old_snapshot?.amount,
      old_currency: p.old_snapshot?.currency,
      old_year: p.old_snapshot?.academic_year,
      new_amount: p.new_snapshot?.amount,
      new_currency: p.new_snapshot?.currency,
      new_year: p.new_snapshot?.academic_year,
      new_source_url: p.new_snapshot?.source_url,
      diff_percent: p.diff_percent,
      reason: p.reason,
      status: p.status,
      created_at: p.created_at
    })) || [];

    return new Response(
      JSON.stringify({ ok: true, proposals: formatted }),
      {
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("[admin-tuition-proposals-list] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" }
      }
    );
  }
});
