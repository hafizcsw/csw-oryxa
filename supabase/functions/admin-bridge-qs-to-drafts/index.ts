import { handleCorsPreflight, getCorsHeaders, generateTraceId, slog } from "../_shared/cors.ts";
import { requireAdmin } from "../_shared/adminGuard.ts";

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  const tid = req.headers.get("x-client-trace-id") || generateTraceId();

  const auth = await requireAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ ok: false, error: auth.error, trace_id: tid }),
      { status: auth.status, headers: { "Content-Type": "application/json", ...cors } });
  }

  try {
    const srv = auth.srv;

    // Get existing source_urls from program_draft that came from QS
    // Get existing bridged URLs in multiple pages to beat the 1000 row limit
    const existingUrls = new Set<string>();
    let offset = 0;
    while (true) {
      const { data: batch } = await srv
        .from("program_draft")
        .select("source_url")
        .eq("schema_version", "qs_bridge_v1")
        .not("source_url", "is", null)
        .range(offset, offset + 999);
      if (!batch || batch.length === 0) break;
      for (const d of batch) existingUrls.add(d.source_url);
      if (batch.length < 1000) break;
      offset += 1000;
    }

    // Get QS programmes in multiple pages
    const allProgrammes: any[] = [];
    let pOffset = 0;
    while (true) {
      const { data: batch, error: fetchErr } = await srv
        .from("qs_programme_details")
        .select(`
          id, title, degree, level, subject_area, school_name,
          duration, study_mode, tuition_domestic, tuition_international,
          tuition_currency, admission_requirements, deadline_raw,
          start_months, programme_url, entity_profile_id
        `)
        .not("title", "is", null)
        .range(pOffset, pOffset + 999);
      if (fetchErr) throw fetchErr;
      if (!batch || batch.length === 0) break;
      allProgrammes.push(...batch);
      if (batch.length < 1000) break;
      pOffset += 1000;
    }

    const programmes = allProgrammes;

    if (!programmes || programmes.length === 0) {
      return new Response(JSON.stringify({ ok: true, msg: "no programmes to bridge" }), {
        headers: { "Content-Type": "application/json", ...cors } });
    }
    // Get entity profiles for university mapping
    const profileIds = [...new Set((programmes || []).map(p => p.entity_profile_id).filter(Boolean))];
    
    const { data: profiles } = await srv
      .from("qs_entity_profiles")
      .select("id, university_id, name, qs_slug, country")
      .in("id", profileIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    // Get university country info
    const uniIds = [...new Set((profiles || []).map(p => p.university_id).filter(Boolean))];
    
    const { data: unis } = await srv
      .from("universities")
      .select("id, country_id, name")
      .in("id", uniIds);

    const uniMap = new Map((unis || []).map(u => [u.id, u]));

    // Get country codes
    const countryIds = [...new Set((unis || []).map(u => u.country_id).filter(Boolean))];
    
    const { data: countries } = await srv
      .from("countries")
      .select("id, country_code")
      .in("id", countryIds);

    const countryMap = new Map((countries || []).map(c => [c.id, c.country_code]));

    // existingUrls already populated above

    // Build drafts
    const drafts: any[] = [];
    let skipped = 0;

    for (const prog of (programmes || [])) {
      if (!prog.title || !prog.programme_url) { skipped++; continue; }
      if (existingUrls.has(prog.programme_url)) { skipped++; continue; }

      const profile = profileMap.get(prog.entity_profile_id);
      const uni = profile?.university_id ? uniMap.get(profile.university_id) : null;
      const countryCode = uni?.country_id ? countryMap.get(uni.country_id) : null;

      // Map level to degree_level
      let degreeLevel = "bachelor";
      if (prog.level === "Masters" || prog.level === "masters") degreeLevel = "master";
      else if (prog.level === "PhD" || prog.level === "phd" || prog.level === "Doctorate") degreeLevel = "phd";
      else if (prog.level === "Undergraduate" || prog.level === "undergraduate") degreeLevel = "bachelor";

      // Parse duration to months
      let durationMonths: number | null = null;
      if (prog.duration) {
        const yearMatch = prog.duration.match(/(\d+)\s*year/i);
        const monthMatch = prog.duration.match(/(\d+)\s*month/i);
        if (yearMatch) durationMonths = parseInt(yearMatch[1]) * 12;
        if (monthMatch) durationMonths = (durationMonths || 0) + parseInt(monthMatch[1]);
      }

      drafts.push({
        university_id: profile?.university_id || null,
        university_name: profile?.name || null,
        title: prog.title,
        title_en: prog.title,
        degree_level: degreeLevel,
        language: "English",
        duration_months: durationMonths,
        tuition_fee: prog.tuition_international || prog.tuition_domestic || null,
        currency: prog.tuition_currency || null,
        source_url: prog.programme_url,
        country_code: countryCode || null,
        status: "extracted",
        confidence_score: 0.7,
        schema_version: "qs_bridge_v1",
        extractor_version: "qs_bridge_v1",
        field_evidence_map: {
          title: "extracted_from_qs",
          degree: prog.degree ? "extracted_from_qs" : "not_provided",
          tuition: prog.tuition_international ? "extracted_from_qs" : "not_provided",
          duration: prog.duration ? "extracted_from_qs" : "not_provided",
        },
        extracted_json: {
          qs_programme_detail_id: prog.id,
          degree: prog.degree,
          subject_area: prog.subject_area,
          school_name: prog.school_name,
          study_mode: prog.study_mode,
          tuition_domestic: prog.tuition_domestic,
          admission_requirements: prog.admission_requirements,
          deadline_raw: prog.deadline_raw,
          start_months: prog.start_months,
        },
      });
    }

    // Insert in batches of 100
    let inserted = 0;
    let errors = 0;
    for (let i = 0; i < drafts.length; i += 100) {
      const batch = drafts.slice(i, i + 100);
      const { error: insertErr, count } = await srv
        .from("program_draft")
        .insert(batch);
      
      if (insertErr) {
        slog({ tid, level: "warn", msg: `Batch insert error at ${i}`, error: String(insertErr) });
        errors++;
      } else {
        inserted += batch.length;
      }
    }

    const result = {
      ok: true,
      trace_id: tid,
      total_qs_programmes: (programmes || []).length,
      already_in_drafts: skipped,
      inserted_to_drafts: inserted,
      batch_errors: errors,
    };

    slog({ tid, level: "info", action: "qs_bridge_done", ...result });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors },
    });
  } catch (err) {
    slog({ tid, level: "error", error: String(err) });
    return new Response(JSON.stringify({ ok: false, error: String(err), trace_id: tid }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors } });
  }
});
