import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const preflightResponse = handleCorsPreflight(req);
  if (preflightResponse) return preflightResponse;

  try {
    const { proposal_id, action } = await req.json();
    
    if (!["approve", "reject"].includes(action)) {
      throw new Error("Invalid action. Must be 'approve' or 'reject'");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // جلب المقترح
    const { data: proposal, error: propError } = await supabase
      .from("tuition_change_proposals")
      .select("*")
      .eq("id", proposal_id)
      .single();

    if (propError) throw propError;
    if (!proposal) throw new Error("Proposal not found");

    if (action === "approve") {
      // تحديث consensus
      await supabase
        .from("tuition_consensus")
        .upsert({
          university_id: proposal.university_id,
          snapshot_id: proposal.new_snapshot,
          updated_at: new Date().toISOString()
        });

      // تحديث حالة المقترح
      await supabase
        .from("tuition_change_proposals")
        .update({
          status: "approved",
          decided_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq("id", proposal_id);

      // Telemetry
      await supabase.from("events").insert({
        name: "tuition_proposal_approved",
        properties: { proposal_id, university_id: proposal.university_id }
      });
    } else {
      // رفض
      await supabase
        .from("tuition_change_proposals")
        .update({
          status: "rejected",
          decided_by: (await supabase.auth.getUser()).data.user?.id
        })
        .eq("id", proposal_id);

      // Telemetry
      await supabase.from("events").insert({
        name: "tuition_proposal_rejected",
        properties: { proposal_id, university_id: proposal.university_id }
      });
    }

    return new Response(
      JSON.stringify({ ok: true, action }),
      {
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    console.error("[admin-tuition-proposal-approve] Error:", error);
    return new Response(
      JSON.stringify({ ok: false, error: String(error) }),
      {
        status: 500,
        headers: { ...getCorsHeaders(req.headers.get("origin")), "Content-Type": "application/json" }
      }
    );
  }
});
