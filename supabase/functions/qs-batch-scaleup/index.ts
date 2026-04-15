/**
 * qs-batch-scaleup v2
 * 
 * Fixes:
 *  1) Seed logic: UPDATE existing rows (no ignoreDuplicates)
 *  2) Evidence bound to exact batch university_ids + trace_id
 *  3) Shell-title guardrails in evidence verdict
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SHELL_TITLES = [
  "university directory search", "search results",
  "qs world university rankings", "top universities",
  "find your perfect university", "compare universities",
  "university rankings",
];

function isShellTitle(title: string | null): boolean {
  if (!title || title.trim().length < 5) return true;
  const t = title.toLowerCase().trim();
  return SHELL_TITLES.some(s => t === s || t.startsWith(s));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Uses service role client for all DB ops — auth handled by Supabase JWT verify

  const srv = createClient(SUPABASE_URL, SRV_KEY);

  try {
    const body = await req.json();
    const {
      mode = "full",
      batch_size = 10,
      offset = 0,
      trace_id = `batch-${Date.now()}`,
    } = body;

    // Track exact university_ids processed in this batch
    let batchUniversityIds: string[] = [];

    const results: any = { trace_id, mode, batch_size, steps: {} };

    // ════════════════════════════════════════════
    // STEP 1: SEED — Find & force-update crawl_state
    // ════════════════════════════════════════════
    if (mode === "seed" || mode === "full") {
      const { data: candidates, error: seedErr } = await srv
        .from("qs_entity_profiles")
        .select("id, university_id, qs_slug, entity_type")
        .eq("entity_type", "university")
        .order("qs_slug", { ascending: true })
        .range(offset, offset + batch_size - 1);

      if (seedErr) {
        return json({ ok: false, error: `seed_error: ${seedErr.message}` }, 500);
      }

      let seeded = 0;
      let updated = 0;
      for (const c of (candidates || [])) {
        batchUniversityIds.push(c.university_id);
        const profileUrl = `https://www.topuniversities.com/universities/${c.qs_slug}`;

        // Check if row exists
        const { data: existing } = await srv
          .from("uniranks_crawl_state")
          .select("university_id, stage")
          .eq("university_id", c.university_id)
          .maybeSingle();

        if (existing) {
          // Force reset to profile_pending for this batch — never skip silently
          const { error: upErr } = await srv.from("uniranks_crawl_state").update({
            source: "qs",
            source_profile_url: profileUrl,
            entity_type: "university",
            stage: "profile_pending",
            locked_until: null,
            locked_by: null,
            updated_at: new Date().toISOString(),
          }).eq("university_id", c.university_id);
          if (!upErr) updated++;
          else console.warn(`[seed] update failed for ${c.university_id}: ${upErr.message}`);
        } else {
          // Insert new row with valid stage
          const { error: insErr } = await srv.from("uniranks_crawl_state").insert({
            university_id: c.university_id,
            source: "qs",
            source_profile_url: profileUrl,
            entity_type: "university",
            stage: "profile_pending",
          });
          if (!insErr) seeded++;
          else console.warn(`[seed] insert failed for ${c.university_id}: ${insErr.message}`);
        }
      }

      results.steps.seed = {
        candidates: candidates?.length || 0,
        new_seeded: seeded,
        existing_updated: updated,
        university_ids: batchUniversityIds,
        offset,
      };
    }

    // ════════════════════════════════════════════
    // STEP 2: PROFILE — Run profile worker on batch IDs only
    // ════════════════════════════════════════════
    if (mode === "profile" || mode === "full") {
      // Use exact batch IDs if available, otherwise pick from seeded
      let targetIds = batchUniversityIds;
      if (targetIds.length === 0) {
        const { data: pending } = await srv
          .from("uniranks_crawl_state")
          .select("university_id")
          .eq("source", "qs")
          .in("stage", ["profile_pending"])
          .is("locked_until", null)
          .limit(batch_size);
        targetIds = (pending || []).map(r => r.university_id);
        batchUniversityIds = targetIds;
      }

      // Get source_profile_url for each
      const { data: stateRows } = await srv
        .from("uniranks_crawl_state")
        .select("university_id, source_profile_url")
        .in("university_id", targetIds);

      let profileOk = 0, profileFail = 0;
      let guardrailFailCount = 0;
      const profileDetails: any[] = [];

      for (const row of (stateRows || [])) {
        try {
          const resp = await fetch(`${SUPABASE_URL}/functions/v1/crawl-qs-profile-worker`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SRV_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              university_id: row.university_id,
              source_profile_url: row.source_profile_url,
              trace_id,
            }),
            signal: AbortSignal.timeout(90_000),
          });
          const data = await resp.json();
          const isGuardrailFail = data.error?.startsWith("GUARDRAIL_") ||
            data.fetch_method !== "firecrawl";
          if (isGuardrailFail) guardrailFailCount++;

          if (data.ok) {
            profileOk++;
            profileDetails.push({
              university_id: row.university_id,
              status: "ok",
              sections_extracted: data.sections_extracted,
              program_links: data.program_links,
              fetch_method: data.fetch_method,
            });
          } else {
            profileFail++;
            profileDetails.push({
              university_id: row.university_id,
              status: "fail",
              error: data.error,
            });
          }
        } catch (e: any) {
          profileFail++;
          profileDetails.push({
            university_id: row.university_id,
            status: "fail",
            error: e?.message?.slice(0, 100),
          });
        }
      }

      results.steps.profile = {
        attempted: stateRows?.length || 0,
        ok: profileOk,
        fail: profileFail,
        guardrail_fail: guardrailFailCount,
        details: profileDetails,
      };
    }

    // ════════════════════════════════════════════
    // STEP 3: PROGRAMME — Run for batch university_ids only
    // ════════════════════════════════════════════
    if (mode === "programme" || mode === "full") {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/crawl-qs-programme-detail`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SRV_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            limit: batch_size * 5,
            trace_id,
            time_budget_ms: 120_000,
            university_ids: batchUniversityIds, // BOUND to this batch
          }),
          signal: AbortSignal.timeout(150_000),
        });
        const data = await resp.json();
        results.steps.programme = data;
      } catch (e: any) {
        results.steps.programme = { ok: false, error: e?.message };
      }
    }

    // ════════════════════════════════════════════
    // STEP 4: EVIDENCE — Bound to exact batch university_ids
    // ════════════════════════════════════════════
    if (mode === "evidence" || mode === "full") {
      // If no batch IDs tracked yet, accept from body
      if (batchUniversityIds.length === 0 && body.university_ids) {
        batchUniversityIds = body.university_ids;
      }

      if (batchUniversityIds.length === 0) {
        results.steps.evidence = { error: "no_university_ids_for_evidence" };
      } else {
        // Get entity_profile_ids for this exact batch
        const { data: batchProfiles } = await srv
          .from("qs_entity_profiles")
          .select("id, university_id, qs_slug, about_text, official_website, programme_count_qs")
          .in("university_id", batchUniversityIds);

        const uniEvidence: any[] = [];
        for (const up of (batchProfiles || [])) {
          const { data: rank } = await srv
            .from("qs_ranking_snapshots")
            .select("world_rank, overall_score")
            .eq("entity_profile_id", up.id)
            .order("ranking_year", { ascending: false })
            .limit(1)
            .single();

          const { data: col } = await srv
            .from("qs_cost_of_living")
            .select("accommodation_amount, food_amount, currency")
            .eq("entity_profile_id", up.id)
            .single();

          const { data: emp } = await srv
            .from("qs_employability")
            .select("career_services_text")
            .eq("entity_profile_id", up.id)
            .single();

          const rankIsYear = rank?.world_rank && rank.world_rank >= 2020 && rank.world_rank <= 2035;

          uniEvidence.push({
            qs_slug: up.qs_slug,
            university_id: up.university_id,
            about_text: up.about_text ? `${up.about_text.slice(0, 100)}...` : null,
            official_website: up.official_website,
            programme_count: up.programme_count_qs,
            world_rank: rank?.world_rank || null,
            overall_score: rank?.overall_score || null,
            cost_of_living: col ? {
              accommodation: col.accommodation_amount,
              food: col.food_amount,
              currency: col.currency,
            } : null,
            employability: emp?.career_services_text ? `${emp.career_services_text.slice(0, 100)}...` : null,
            guardrails: {
              rank_not_year: !rankIsYear,
              has_about: !!up.about_text,
            },
            verdict: rankIsYear ? "FAIL_RANK_YEAR" : "PASS",
          });
        }

        // Programme evidence — only for batch university_ids
        const batchEntityIds = (batchProfiles || []).map(p => p.id);
        const { data: progDetails } = batchEntityIds.length > 0
          ? await srv
              .from("qs_programme_details")
              .select("entity_profile_id, programme_url, title, degree, level, duration, study_mode, tuition_domestic, tuition_international, tuition_currency, start_months, deadline_raw, admission_requirements, subject_area")
              .in("entity_profile_id", batchEntityIds)
          : { data: [] };

        let progGuardrailFail = 0;
        const progEvidence = (progDetails || []).map((p: any) => {
          const shellTitle = isShellTitle(p.title);
          const titleNull = !p.title;
          const inconsistent = p.degree && !p.level;
          const failed = shellTitle || titleNull;
          if (failed) progGuardrailFail++;

          return {
            programme_url: p.programme_url,
            title: p.title,
            degree: p.degree,
            level: p.level,
            duration: p.duration,
            study_mode: p.study_mode,
            tuition_domestic: p.tuition_domestic,
            tuition_international: p.tuition_international,
            tuition_currency: p.tuition_currency,
            start_months: p.start_months,
            deadline_raw: p.deadline_raw,
            subject_area: p.subject_area,
            guardrails: {
              title_not_null: !titleNull,
              not_shell_title: !shellTitle,
              degree_level_consistent: !inconsistent,
            },
            verdict: failed ? (shellTitle ? "FAIL_SHELL_TITLE" : "FAIL_TITLE_NULL") : "PASS",
          };
        });

        results.steps.evidence = {
          bound_to: {
            trace_id,
            university_ids: batchUniversityIds,
            count: batchUniversityIds.length,
          },
          universities: uniEvidence,
          programmes: progEvidence,
          summary: {
            total_universities: uniEvidence.length,
            uni_pass: uniEvidence.filter(u => u.verdict === "PASS").length,
            uni_fail: uniEvidence.filter(u => u.verdict !== "PASS").length,
            total_programmes: progEvidence.length,
            prog_pass: progEvidence.filter(p => p.verdict === "PASS").length,
            prog_fail: progGuardrailFail,
            prog_guardrail_fail: progGuardrailFail,
          },
        };
      }
    }

    results.scale_plan = {
      current_batch: batch_size,
      next_steps: batch_size <= 10
        ? "Review evidence → run batch_size=50"
        : batch_size <= 50
        ? "Review evidence → run batch_size=200"
        : "Production scale reached",
    };

    return json(results);
  } catch (err: any) {
    console.error("[qs-batch-scaleup] Fatal:", err);
    return json({ ok: false, error: err?.message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
