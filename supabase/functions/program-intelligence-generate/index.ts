import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflight, handleError, generateTraceId } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("origin");
  const tid = generateTraceId();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { program_id, force, university_id } = await req.json();
    if (!program_id) throw new Error("Missing program_id");

    // ── Ownership gate: verify the caller's university_id matches the program ──
    const { data: program } = await supabase
      .from("vw_program_details")
      .select("*")
      .eq("program_id", program_id)
      .single();

    if (!program) throw new Error("Program not found");

    // If university_id is provided, verify it matches
    if (university_id && program.university_id !== university_id) {
      throw new Error("UNIVERSITY_MISMATCH");
    }

    // Check for existing current snapshot (TTL = 7 days)
    if (!force) {
      const { data: existing } = await supabase
        .from("program_ai_snapshots")
        .select("id, generated_at")
        .eq("program_id", program_id)
        .eq("is_current", true)
        .single();

      if (existing) {
        const age = Date.now() - new Date(existing.generated_at).getTime();
        const maxAge = 7 * 24 * 60 * 60 * 1000;
        if (age < maxAge) {
          return new Response(JSON.stringify({ ok: true, tid, status: "cached", snapshot_id: existing.id }), {
            status: 200, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" }
          });
        }
      }
    }

    // Fetch offers for additional context
    const { data: offers } = await supabase
      .from("program_offers")
      .select("*")
      .eq("program_id", program_id)
      .eq("offer_status", "active");

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const contextStr = JSON.stringify({
      program_name: program.program_name,
      university_name: program.university_name,
      country: program.country_name,
      degree: program.degree_name,
      discipline: program.discipline_name || program.subject_area,
      duration_months: program.duration_months,
      tuition: program.tuition_yearly,
      language: program.teaching_language || program.language,
      study_mode: program.study_mode,
      has_internship: program.has_internship,
      employment_rate: program.employment_rate,
      enrolled_students: program.enrolled_students,
      offers: (offers || []).map((o: any) => ({
        intake: `${o.intake_term} ${o.intake_year}`,
        seats: o.seats_available,
        tuition: o.tuition_amount,
      })),
    });

    const systemPrompt = `You are an expert education analyst. Generate an intelligence snapshot for a university program.
Return JSON with these fields:
- summary: 2-3 sentence overview of the program's value proposition
- future_outlook: assessment of the field's future (growing, stable, declining) with reasoning
- strengths: array of 3-5 specific strengths
- weaknesses: array of 2-3 specific weaknesses or limitations
- practical_assessment: "highly_practical", "balanced", "theoretical", or "research_focused"
- career_paths: array of objects with {title, demand_level, avg_salary_range}
- best_fit_profile: description of ideal student for this program
- confidence: 0-1 score of your overall confidence in this analysis
- orx_scores: {labs_score, internship_score, capstone_score, tooling_score, industry_links_score, curriculum_modernity, practical_intensity, employability_relevance, discipline_future_strength} each 1-10
- orx_evidence: brief evidence for each score

Be factual and evidence-based. If you lack data, lower your confidence score.`;

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate intelligence snapshot for this program:\n${contextStr}` },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) throw new Error(`AI gateway error: ${aiResponse.status}`);

    const aiData = await aiResponse.json();
    const snapshot = JSON.parse(aiData.choices[0].message.content);

    const sourceHash = Array.from(new TextEncoder().encode(contextStr)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 64);

    // Mark old snapshots as not current
    await supabase
      .from("program_ai_snapshots")
      .update({ is_current: false })
      .eq("program_id", program_id)
      .eq("is_current", true);

    // Insert new snapshot
    const { data: newSnapshot, error: insertErr } = await supabase
      .from("program_ai_snapshots")
      .insert({
        program_id,
        summary: snapshot.summary,
        future_outlook: snapshot.future_outlook,
        strengths: snapshot.strengths,
        weaknesses: snapshot.weaknesses,
        practical_assessment: snapshot.practical_assessment,
        career_paths: snapshot.career_paths,
        best_fit_profile: snapshot.best_fit_profile,
        confidence: snapshot.confidence || 0.7,
        model_version: "gpt-4o-mini",
        source_hash: sourceHash,
        is_current: true,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (insertErr) throw insertErr;

    // Also generate/update ORX signals from the same response
    const orxScores = snapshot.orx_scores;
    let orxData: any = null;
    if (orxScores) {
      const execScores = [
        orxScores.labs_score, orxScores.internship_score, orxScores.capstone_score,
        orxScores.tooling_score, orxScores.industry_links_score, orxScores.curriculum_modernity,
        orxScores.practical_intensity, orxScores.employability_relevance,
      ].filter((s: any) => s != null);

      const overallExecution = execScores.length > 0
        ? execScores.reduce((a: number, b: number) => a + b, 0) / execScores.length
        : null;

      await supabase
        .from("program_orx_signals")
        .update({ is_current: false })
        .eq("program_id", program_id)
        .eq("is_current", true);

      const { error: orxErr } = await supabase
        .from("program_orx_signals")
        .insert({
          program_id,
          labs_score: orxScores.labs_score,
          internship_score: orxScores.internship_score,
          capstone_score: orxScores.capstone_score,
          tooling_score: orxScores.tooling_score,
          industry_links_score: orxScores.industry_links_score,
          curriculum_modernity: orxScores.curriculum_modernity,
          practical_intensity: orxScores.practical_intensity,
          employability_relevance: orxScores.employability_relevance,
          discipline_future_strength: orxScores.discipline_future_strength,
          overall_execution_score: overallExecution,
          evidence: snapshot.orx_evidence || orxScores,
          model_version: "gpt-4o-mini",
          is_current: true,
        });

      if (!orxErr) orxData = orxScores;
    }

    return new Response(JSON.stringify({
      ok: true,
      tid,
      snapshot_id: newSnapshot?.id,
      orx_generated: !!orxData,
    }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
    });

  } catch (e) {
    return handleError(e, tid, origin);
  }
});
