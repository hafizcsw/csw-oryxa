import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/adminGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


function generateTraceId(): string {
  return crypto.randomUUID();
}

async function insertIngestError(supabase: any, payload: Record<string, unknown>) {
  // Normalize: always use details_json
  const details = payload.details_json ?? payload.details ?? {};
  const { details: _, ...rest } = payload;
  await supabase.from("ingest_errors").insert({ ...rest, details_json: details });
}

interface VerifyRequest {
  action: "verify_local" | "verify_arbiter" | "publish_batch";
  batch_id: string;
  limit?: number;
  mode?: "auto_only" | "auto_plus_quick";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // SECURITY: Require admin authentication
    const adminCheck = await requireAdmin(req);
    if (!adminCheck.ok) {
      return new Response(
        JSON.stringify({ error: adminCheck.error }),
        { status: adminCheck.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const supabase = adminCheck.srv;
    const lovableApiKey = Deno.env.get("OPENAI_API_KEY")!;

    const body: VerifyRequest = await req.json();
    console.log(`[crawl-verify-publish] Action: ${body.action}, Batch: ${body.batch_id}, User: ${adminCheck.user.id}`);

    switch (body.action) {
      case "verify_local":
        return await verifyLocal(supabase, body);
      case "verify_arbiter":
        return await verifyArbiter(supabase, lovableApiKey, body);
      case "publish_batch":
        return await publishBatch(supabase, body);
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("[crawl-verify-publish] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function verifyLocal(supabase: any, body: VerifyRequest) {
  const { batch_id, limit = 100 } = body;

  // Get drafts that need verification
  const { data: drafts, error } = await supabase
    .from("program_draft")
    .select(`
      id, title, degree_level, language, duration_months, currency,
      extracted_json, missing_fields, flags, university_id,
      source_evidence(field, text_snippet, confidence, tuition_basis, tuition_scope, is_primary)
    `)
    .eq("batch_id", batch_id)
    .is("approval_tier", null)
    .limit(limit);

  if (error) throw new Error(`Failed to fetch drafts: ${error.message}`);

  const results = { auto: 0, quick: 0, deep: 0, rejected: 0, flagged: 0 };

  for (const draft of drafts || []) {
    const verification = await runVerificationLayers(supabase, draft);

    // Update draft with verification results
    await supabase
      .from("program_draft")
      .update({
        verification_result: verification.result,
        flags: verification.flags,
        final_confidence: verification.confidence,
        approval_tier: verification.tier,
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", draft.id);

    results[verification.tier as keyof typeof results]++;
    if (verification.flags.length > 0) results.flagged++;
  }

  // Update batch status
  await supabase
    .from("crawl_batches")
    .update({
      status: "verifying",
      programs_auto_ready: results.auto,
      programs_quick_review: results.quick,
      programs_deep_review: results.deep,
    })
    .eq("id", batch_id);

  return new Response(
    JSON.stringify(results),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

interface VerificationResult {
  tier: "auto" | "quick" | "deep" | "rejected";
  confidence: number;
  flags: string[];
  result: Record<string, any>;
}

async function runVerificationLayers(supabase: any, draft: any): Promise<VerificationResult> {
  const flags: string[] = [];
  let confidence = 0.8;
  const result: Record<string, any> = {};

  const extracted = draft.extracted_json || {};
  const evidence = draft.source_evidence || [];
  const missingFields = draft.missing_fields || [];

  // Layer 1: Evidence Check
  const tuitionEvidence = evidence.find((e: any) => e.field === "tuition" && e.is_primary);
  const languageEvidence = evidence.find((e: any) => e.field === "language");
  
  if (!tuitionEvidence?.text_snippet && extracted.tuition?.amount) {
    flags.push("TUITION_NO_EVIDENCE");
    confidence -= 0.2;
  }
  
  if (!languageEvidence?.text_snippet && extracted.languages?.length > 0) {
    flags.push("LANGUAGE_NO_EVIDENCE");
    confidence -= 0.1;
  }

  // Layer 2: Format Validation
  if (extracted.requirements?.ielts_overall) {
    const ielts = extracted.requirements.ielts_overall;
    if (ielts < 0 || ielts > 9) {
      flags.push("IELTS_INVALID_RANGE");
      result.ielts_original = ielts;
      confidence -= 0.15;
    }
  }

  if (extracted.tuition?.amount) {
    const amount = extracted.tuition.amount;
    if (amount < 0 || amount > 500000) {
      flags.push("TUITION_INVALID_RANGE");
      confidence -= 0.2;
    }
  }

  if (draft.duration_months && (draft.duration_months < 1 || draft.duration_months > 120)) {
    flags.push("DURATION_INVALID_RANGE");
    confidence -= 0.1;
  }

  // Layer 3: Discipline Mapping
  const disciplineKeywords = extracted.discipline_keywords || [];
  const disciplineId = await mapDiscipline(supabase, disciplineKeywords);
  result.discipline_id = disciplineId;
  
  if (!disciplineId && disciplineKeywords.length > 0) {
    flags.push("DISCIPLINE_NOT_MAPPED");
    confidence -= 0.05;
  }

  // Layer 4: Tuition Validation - FIXED: use tuition_basis/tuition_scope from evidence
  if (extracted.tuition && !extracted.tuition.is_free) {
    const { basis, scope, amount } = extracted.tuition;
    const evidenceBasis = tuitionEvidence?.tuition_basis;
    const evidenceScope = tuitionEvidence?.tuition_scope;
    
    // Use evidence values if available, else extracted
    const finalBasis = evidenceBasis || basis;
    const finalScope = evidenceScope || scope;
    
    if (!finalBasis || finalBasis === "unknown") {
      flags.push("TUITION_BASIS_UNKNOWN");
      result.tuition_invalid = true;
      confidence -= 0.2;
    }
    
    if (!finalScope || finalScope === "unknown") {
      flags.push("TUITION_SCOPE_UNKNOWN");
      result.tuition_invalid = true;
      confidence -= 0.2;
    }

    if (finalBasis === "per_credit") {
      flags.push("TUITION_NOT_COMPARABLE");
    }

    if (!amount) {
      flags.push("TUITION_AMOUNT_MISSING");
    }
    
    // Store resolved basis/scope
    result.tuition_basis = finalBasis;
    result.tuition_scope = finalScope;
  }

  // Layer 5: Outlier Detection (simplified - would need peer data)
  if (extracted.tuition?.amount && extracted.tuition.basis === "per_year") {
    const amount = extracted.tuition.amount;
    if (amount > 80000) {
      flags.push("TUITION_VERY_HIGH");
    } else if (amount < 1000 && !extracted.tuition.is_free) {
      flags.push("TUITION_VERY_LOW");
    }
  }

  // Layer 6: Check for conflicts
  if (flags.includes("TUITION_NO_EVIDENCE") && flags.includes("TUITION_VERY_HIGH")) {
    flags.push("TUITION_CONFLICT");
  }

  // Layer 7: Determine tier
  let tier: "auto" | "quick" | "deep" | "rejected" = "auto";

  // Rejection criteria
  if (!draft.title || !draft.degree_level) {
    tier = "rejected";
  } else if (!draft.duration_months && missingFields.includes("duration")) {
    tier = "rejected";
  }

  // Deep review criteria
  if (tier !== "rejected") {
    if (flags.includes("TUITION_CONFLICT") || 
        flags.includes("TUITION_BASIS_UNKNOWN") ||
        flags.includes("TUITION_SCOPE_UNKNOWN") ||
        missingFields.includes("tuition") ||
        missingFields.includes("language")) {
      tier = "deep";
    }
  }

  // Quick review criteria
  if (tier !== "rejected" && tier !== "deep") {
    if (flags.includes("TUITION_VERY_HIGH") ||
        flags.includes("TUITION_VERY_LOW") ||
        flags.includes("DISCIPLINE_NOT_MAPPED") ||
        flags.includes("TUITION_NOT_COMPARABLE")) {
      tier = "quick";
    }
  }

  // Auto criteria
  if (tier !== "rejected" && tier !== "deep" && tier !== "quick") {
    // Check all required fields are present with evidence
    const hasTitle = !!draft.title;
    const hasDegree = !!draft.degree_level;
    const hasDuration = !!draft.duration_months;
    const hasLanguage = !!draft.language || (extracted.languages?.length > 0);
    
    const hasTuition = extracted.tuition?.is_free || 
      (extracted.tuition?.amount && 
       extracted.tuition?.basis !== "unknown" && 
       extracted.tuition?.scope !== "unknown" &&
       tuitionEvidence?.text_snippet);

    const noConflictFlags = !flags.some(f => 
      f.includes("CONFLICT") || f.includes("UNKNOWN") || f.includes("INVALID")
    );

    if (hasTitle && hasDegree && hasDuration && hasLanguage && hasTuition && noConflictFlags) {
      tier = "auto";
    } else {
      tier = "quick";
    }
  }

  confidence = Math.max(0, Math.min(1, confidence));

  return { tier, confidence, flags, result };
}

async function mapDiscipline(supabase: any, keywords: string[]): Promise<string | null> {
  if (!keywords || keywords.length === 0) return null;

  // Try to match keywords against discipline aliases
  const { data: disciplines } = await supabase
    .from("disciplines")
    .select("id, name, slug, aliases_en");

  for (const discipline of disciplines || []) {
    const allNames = [
      discipline.name?.toLowerCase(),
      discipline.slug?.toLowerCase(),
      ...(discipline.aliases_en || []).map((a: string) => a.toLowerCase()),
    ].filter(Boolean);

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (allNames.some(name => name.includes(lowerKeyword) || lowerKeyword.includes(name))) {
        return discipline.id;
      }
    }
  }

  return null;
}

async function verifyArbiter(supabase: any, apiKey: string, body: VerifyRequest) {
  const { batch_id, limit = 50 } = body;

  // Get drafts that need arbiter review
  const { data: drafts, error } = await supabase
    .from("program_draft")
    .select(`
      id, title, extracted_json, flags, verification_result,
      source_evidence(field, text_snippet, source_url, confidence, tuition_basis, tuition_scope)
    `)
    .eq("batch_id", batch_id)
    .overlaps("flags", ["TUITION_CONFLICT", "TUITION_BASIS_UNKNOWN", "TUITION_SCOPE_UNKNOWN"])
    .is("gpt5_reasoning", null)
    .limit(limit);

  if (error) throw new Error(`Failed to fetch drafts: ${error.message}`);

  const decisions = { accept: 0, correct: 0, unknown: 0 };

  for (const draft of drafts || []) {
    try {
      const arbiterResult = await callArbiter(apiKey, draft);

      await supabase
        .from("program_draft")
        .update({
          gpt5_reasoning: arbiterResult.reasoning,
          // Only update if arbiter provides correction with evidence
          ...(arbiterResult.decision === "correct" && arbiterResult.correction ? {
            extracted_json: {
              ...draft.extracted_json,
              ...arbiterResult.correction,
            },
          } : {}),
        })
        .eq("id", draft.id);

      decisions[arbiterResult.decision as keyof typeof decisions]++;
    } catch (error) {
      console.error(`Arbiter error for draft ${draft.id}:`, error);
    }
  }

  return new Response(
    JSON.stringify({ decisions }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function callArbiter(apiKey: string, draft: any): Promise<{ decision: string; reasoning: string; correction?: any }> {
  const systemPrompt = `You are a data quality arbiter for university program information. Your job is to resolve conflicts and ambiguities in extracted data.

RULES:
1. You can ONLY accept or correct values if there is clear evidence provided
2. If evidence is contradictory or unclear, your decision must be "unknown"
3. Never make up values - only use values that appear in the evidence
4. For tuition, you MUST determine basis (per_year/per_semester/per_credit/total) and scope (international/domestic/all)

Return JSON:
{
  "decision": "accept|correct|unknown",
  "reasoning": "2-3 sentences explaining your decision",
  "correction": { only if decision is "correct" - include the corrected fields }
}`;

  const evidenceText = (draft.source_evidence || [])
    .map((e: any) => `Field: ${e.field}\nSource: ${e.source_url}\nSnippet: ${e.text_snippet}`)
    .join("\n\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `Program: ${draft.title}
Flags: ${(draft.flags || []).join(", ")}
Current extracted data: ${JSON.stringify(draft.extracted_json, null, 2)}

Evidence:
${evidenceText}

Resolve the conflicts and determine the correct values.` 
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Arbiter API error: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    return { decision: "unknown", reasoning: "No response from arbiter" };
  }

  try {
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    return JSON.parse(jsonStr.trim());
  } catch {
    return { decision: "unknown", reasoning: content.substring(0, 200) };
  }
}

async function publishBatch(supabase: any, body: VerifyRequest) {
  const { batch_id, mode = "auto_only" } = body;

  // ============= TWO LANES ARCHITECTURE =============
  // Lane 1 (Harvest): rpc_publish_program_batch → writes ALL drafts as publish_status='draft'
  //   Already ran during extraction. Stores everything for Bot/observations.
  //
  // Lane 2 (Search): rpc_publish_program_batch_search → ONLY auto-tier verified → publish_status='published'
  //   This is what we call here. Only search-ready programs get published=true.

  // Pre-check: must have verified + auto-tier drafts
  const { count: autoVerifiedCount } = await supabase
    .from("program_draft")
    .select("id", { head: true, count: "exact" })
    .eq("batch_id", batch_id)
    .eq("status", "verified")
    .eq("approval_tier", "auto");

  const { count: totalDraftsCount } = await supabase
    .from("program_draft")
    .select("id", { head: true, count: "exact" })
    .eq("batch_id", batch_id);

  console.log(`[publish] Batch ${batch_id}: ${autoVerifiedCount} auto-verified of ${totalDraftsCount} total drafts`);

  if (!autoVerifiedCount || autoVerifiedCount === 0) {
    // No auto-tier drafts ready — report skip counts
    await insertIngestError(supabase, {
      pipeline: "crawl_pipeline", batch_id, entity_hint: "program",
      stage: "search_publish", reason: "no_auto_tier_drafts",
      details_json: { total_drafts: totalDraftsCount, auto_verified: 0 }
    });
    return new Response(
      JSON.stringify({
        published: 0,
        skipped: totalDraftsCount || 0,
        errors: 0,
        lane: "search",
        reason: "no_auto_tier_verified_drafts"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Call Search Lane RPC (tier-filtered, gate-enforced)
  const { data, error } = await supabase.rpc("rpc_publish_program_batch_search", {
    p_batch_id: batch_id,
  });

  if (error) {
    await insertIngestError(supabase, {
      pipeline: "crawl_pipeline", batch_id, entity_hint: "program",
      stage: "search_publish", reason: "db_error",
      details_json: { error: error.message }
    });
    throw new Error(`Search publish failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const published = row?.published_count ?? 0;
  const skipped = row?.skipped_count ?? 0;
  const errors = row?.error_count ?? 0;

  console.log(`[publish] Search Lane result: published=${published}, skipped=${skipped}, errors=${errors}`);

  // NOTE: rpc_publish_program_batch_search already updates crawl_batches atomically

  return new Response(
    JSON.stringify({ published, skipped, errors, lane: "search" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
