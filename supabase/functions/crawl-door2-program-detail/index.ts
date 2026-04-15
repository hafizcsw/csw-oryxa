import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * crawl-door2-program-detail: Stage 3 Program Detail Extraction
 * Fetches individual UniRanks program pages and extracts:
 * - tuition fees (amount, currency, period)
 * - degree, study level, main subject
 * - admission requirements (IELTS, TOEFL, GPA, documents)
 * - scholarships
 * - cost of living breakdown
 * - application dates
 * 
 * Stores results in program_draft with field_evidence_map.
 */

const FETCH_TIMEOUT_MS = 20_000;

Deno.serve(async (req) => {
  const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader !== `Bearer ${SRV_KEY}`) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const srv = createClient(SUPABASE_URL, SRV_KEY);
  const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY_1") || Deno.env.get("FIRECRAWL_API_KEY");

  try {
    const body = await req.json();
    const { limit = 48, trace_id, time_budget_ms = 60_000, university_ids } = body;
    const tid = trace_id || `d2-detail-${Date.now()}`;
    const startMs = Date.now();

    if (!FIRECRAWL_KEY) {
      return json({ ok: false, error: "FIRECRAWL_API_KEY not configured", trace_id: tid });
    }

    // Lock program URLs for extraction (optionally scoped to batch universities)
    const rpcParams: Record<string, any> = {
      p_limit: limit,
      p_locked_by: `d2-detail-${tid.slice(-8)}`,
    };
    if (university_ids && Array.isArray(university_ids) && university_ids.length > 0) {
      rpcParams.p_university_ids = university_ids;
    }
    const { data: urls, error: lockErr } = await srv.rpc("rpc_lock_door2_program_urls", rpcParams);

    if (lockErr) {
      console.error(`[d2-detail] Lock error:`, lockErr.message);
      return json({ ok: false, error: lockErr.message, trace_id: tid });
    }

    if (!urls?.length) {
      return json({ ok: true, processed: 0, message: "no_pending_urls", trace_id: tid });
    }

    let processed = 0;
    let failed = 0;
    let fetchOk = 0, fetchFailed = 0, extractOk = 0, extractFailed = 0, draftOk = 0, draftFailed = 0;
    const results: any[] = [];
    const telemetryRows: any[] = [];

    // Process in parallel batches of BATCH_SIZE with time budget
    const BATCH_SIZE = 8;
    let budgetExhausted = false;
    for (let i = 0; i < urls.length && !budgetExhausted; i += BATCH_SIZE) {
      // Check time budget before each batch (keep 5s margin)
      if (Date.now() - startMs > time_budget_ms - 5_000) {
        budgetExhausted = true;
        // Release remaining URLs
        for (let j = i; j < urls.length; j++) {
          await srv.from("program_urls").update({
            status: "pending", locked_by: null, lease_expires_at: null,
          }).eq("id", String(urls[j].id));
        }
        break;
      }

      const batch = urls.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (urlRow: any) => {
          const { id: urlId, url, university_id } = urlRow;
          try {
            // FETCH
            const md = await scrapeWithFirecrawl(FIRECRAWL_KEY, url);
            if (!md) {
              fetchFailed++;
              telemetryRows.push({ pipeline: "door2_detail", event_type: "detail_fetch_failed", metric: "fetch", value: 1, details_json: { url, reason: "empty_response", trace_id: tid } });
              await markUrlStatus(srv, urlId, "failed", "empty_response");
              return { ok: false };
            }
            fetchOk++;

            // SNAPSHOT
            const { data: snap } = await srv.from("uniranks_page_snapshots").insert({
              university_id,
              normalized_url: url,
              page_type: "program_detail",
              raw_markdown: md.slice(0, 100_000),
            }).select("id").single();

            // EXTRACT
            const extracted = extractProgramDetails(md, url);
            if (!extracted.title || extracted.title.length < 4) {
              extractFailed++;
              telemetryRows.push({ pipeline: "door2_detail", event_type: "detail_extract_failed", metric: "extract", value: 1, details_json: { url, reason: "no_title", trace_id: tid } });
              await markUrlStatus(srv, urlId, "extracted", "no_title");
              return { ok: false };
            }
            extractOk++;

            // WRITE DRAFT
            const programKey = generateProgramKey(university_id, extracted.title, extracted.degree);
            const draftData = {
              university_id,
              title: extracted.title,
              title_en: extracted.title,
              degree_level: extracted.degree || null,
              language: extracted.language || "English",
              duration_months: extracted.duration_months || null,
              tuition_fee: extracted.tuition_amount || null,
              currency: extracted.tuition_currency || null,
              currency_code: extracted.tuition_currency || null,
              source_url: url,
              source_program_url: url,
              tuition_source_url: extracted.tuition_amount ? url : null,
              admissions_source_url: url,
              status: "extracted",
              program_key: programKey,
              schema_version: "door2-detail-v1",
              extractor_version: "d2-detail-1.0",
              last_extracted_at: new Date().toISOString(),
              raw_page_id: snap?.id || null,
              extracted_json: { ...extracted, source_url: url, trace_id: tid },
              field_evidence_map: buildEvidenceMap(extracted, url),
              confidence_score: calculateConfidence(extracted),
              country_code: null as string | null,
            };

            const { data: uniRow } = await srv
              .from("universities").select("country_id").eq("id", university_id).single();
            if (uniRow?.country_id) {
              const { data: countryRow } = await srv
                .from("countries").select("country_code").eq("id", uniRow.country_id).single();
              if (countryRow) draftData.country_code = countryRow.country_code;
            }

            const { data: existing } = await srv
              .from("program_draft").select("id")
              .eq("program_key", programKey).eq("university_id", university_id).limit(1);

            let writeErr: any = null;
            if (existing?.length) {
              const { error } = await srv.from("program_draft").update(draftData).eq("id", existing[0].id);
              writeErr = error;
            } else {
              const { error } = await srv.from("program_draft").insert(draftData);
              writeErr = error;
            }

            if (writeErr) {
              draftFailed++;
              telemetryRows.push({ pipeline: "door2_detail", event_type: "detail_write_draft_failed", metric: "draft_write", value: 1, details_json: { url, reason: writeErr.message?.slice(0, 200), trace_id: tid } });
            } else {
              draftOk++;
            }

            const statusOk = await markUrlStatus(srv, urlId, "extracted", null);
            if (!statusOk) {
              telemetryRows.push({ pipeline: "door2_detail", event_type: "detail_status_update_failed", metric: "status_update", value: 1, details_json: { urlId: String(urlId), target_status: "extracted", trace_id: tid } });
            }
            return {
              ok: true,
              url,
              title: extracted.title,
              tuition: extracted.tuition_amount,
              degree: extracted.degree,
              fields_found: Object.keys(extracted).filter(k => (extracted as any)[k] != null).length,
            };
          } catch (e: any) {
            console.error(`[d2-detail] Error processing ${url}:`, e?.message);
            telemetryRows.push({ pipeline: "door2_detail", event_type: "detail_fetch_failed", metric: "fatal", value: 1, details_json: { url, reason: e?.message?.slice(0, 200), trace_id: tid } });
            await markUrlStatus(srv, urlId, "failed", e?.message?.slice(0, 200));
            return { ok: false };
          }
        })
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled" && r.value.ok) {
          processed++;
          results.push(r.value);
        } else {
          failed++;
        }
      }
    }

    // Log granular telemetry
    telemetryRows.push({
      pipeline: "door2_detail",
      event_type: "metric",
      metric: "programs_extracted",
      value: processed,
      details_json: {
        trace_id: tid, processed, failed, total: urls.length,
        fetch_ok: fetchOk, fetch_failed: fetchFailed,
        extract_ok: extractOk, extract_failed: extractFailed,
        draft_ok: draftOk, draft_failed: draftFailed,
        budget_exhausted: budgetExhausted,
        elapsed_ms: Date.now() - startMs,
      },
    });

    if (telemetryRows.length > 0) {
      await srv.from("pipeline_health_events").insert(telemetryRows);
    }

    return json({
      ok: true,
      trace_id: tid,
      processed,
      failed,
      total: urls.length,
      fetch_ok: fetchOk,
      fetch_failed: fetchFailed,
      extract_ok: extractOk,
      extract_failed: extractFailed,
      draft_ok: draftOk,
      draft_failed: draftFailed,
      budget_exhausted: budgetExhausted,
      elapsed_ms: Date.now() - startMs,
      results,
    });

  } catch (e: any) {
    console.error("[d2-detail] Fatal:", e);
    return json({ ok: false, error: e?.message }, 500);
  }
});

// ===== Helpers =====

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function scrapeWithFirecrawl(apiKey: string, url: string): Promise<string | null> {
  try {
    const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: false,
        waitFor: 15000,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.warn(`[firecrawl] ${r.status} for ${url}: ${text.slice(0, 200)}`);
      return null;
    }

    const data = await r.json();
    return data?.data?.markdown || data?.markdown || null;
  } catch (e: any) {
    console.warn(`[firecrawl] Fetch error for ${url}:`, e?.message);
    return null;
  }
}

async function markUrlStatus(srv: any, urlId: number | bigint, status: string, error: string | null): Promise<boolean> {
  const update: Record<string, any> = { status, locked_by: null, lease_expires_at: null };
  if (error) update.fetch_error = error;
  
  const idStr = String(urlId);
  try {
    const { error: updateErr } = await srv
      .from("program_urls")
      .update(update)
      .eq("id", idStr);

    if (updateErr) {
      console.error(`[d2-detail] markUrlStatus FAILED id=${idStr} → ${status}:`, updateErr.message);
      return false;
    }
    return true;
  } catch (e: any) {
    console.error(`[d2-detail] markUrlStatus EXCEPTION id=${idStr} → ${status}:`, e?.message);
    return false;
  }
}

// ===== Extraction Logic =====

interface ProgramDetails {
  title: string | null;
  degree: string | null;
  study_level: string | null;
  main_subject: string | null;
  language: string | null;
  duration_months: number | null;
  tuition_amount: number | null;
  tuition_currency: string | null;
  tuition_period: string | null;
  tuition_total: number | null;
  application_fee: number | null;
  ielts_min: number | null;
  toefl_min: number | null;
  gpa_min: number | null;
  required_documents: string[];
  additional_requirements: string[];
  application_start_date: string | null;
  application_end_date: string | null;
  semester_start_date: string | null;
  scholarships: ScholarshipInfo[];
  cost_of_living: Record<string, number>;
  admissions_source_type: "source_template" | "source_specific" | "unknown";
}

interface ScholarshipInfo {
  type: string;
  coverage_pct: number | null;
  international_acceptance_pct: number | null;
  description: string | null;
}

function extractProgramDetails(md: string, sourceUrl: string): ProgramDetails {
  const result: ProgramDetails = {
    title: null,
    degree: null,
    study_level: null,
    main_subject: null,
    language: null,
    duration_months: null,
    tuition_amount: null,
    tuition_currency: null,
    tuition_period: null,
    tuition_total: null,
    application_fee: null,
    ielts_min: null,
    toefl_min: null,
    gpa_min: null,
    required_documents: [],
    additional_requirements: [],
    application_start_date: null,
    application_end_date: null,
    semester_start_date: null,
    scholarships: [],
    cost_of_living: {},
    admissions_source_type: "unknown",
  };

  const lines = md.split("\n").map(l => l.trim());

  // Title: first H1
  const h1Match = md.match(/^# (.+)$/m);
  if (h1Match) {
    const raw = h1Match[1].trim();
    // Skip generic titles
    if (raw.length >= 4 && !/^(UNIRANKS|Loading|Error)/i.test(raw)) {
      result.title = raw;
    }
  }

  // Program overview section
  const overviewSection = extractSection(md, "Program overview", "Admission");

  if (overviewSection) {
    // Main Subject
    const subjectMatch = overviewSection.match(/Main Subject\s*\n+(.+)/i);
    if (subjectMatch) result.main_subject = subjectMatch[1].trim();

    // Degree
    const degreeMatch = overviewSection.match(/Degree\s*\n+(.+)/i);
    if (degreeMatch) result.degree = degreeMatch[1].trim();

    // Study Level (source always "NA" on UniRanks — infer from degree)
    const levelMatch = overviewSection.match(/Study Level\s*\n+(.+)/i);
    if (levelMatch && levelMatch[1].trim() !== "NA") {
      result.study_level = levelMatch[1].trim();
    }
  }

  // Infer study_level from degree if source was NA
  if (!result.study_level && result.degree) {
    const d = result.degree.toLowerCase();
    if (/\b(ph\.?d|doctor|dphil)\b/.test(d)) result.study_level = "Doctoral";
    else if (/\b(m\.?a\.?|m\.?s\.?|m\.?sc|m\.?eng|master|mba|m\.?ed|m\.?phil|llm)\b/.test(d)) result.study_level = "Master";
    else if (/\b(b\.?a\.?|b\.?s\.?|b\.?sc|b\.?eng|bachelor|bba|b\.?ed|llb)\b/.test(d)) result.study_level = "Bachelor";
    else if (/\b(diploma|associate|certificate|foundation)\b/.test(d)) result.study_level = "Diploma";
  }

  // === TUITION GUARD: Extract headline tuition ONLY from the top area ===
  // The headline tuition appears before "Program overview" and supports $, €, £
  const headlineArea = md.split(/### Program overview/i)[0] || "";
  const CURRENCY_MAP: Record<string, string> = { "$": "USD", "€": "EUR", "£": "GBP" };

  // Match patterns like "$43,821/Year", "€39,196/Year", "£28,000/Year"
  const tuitionHeaderMatch = headlineArea.match(/([$€£])([0-9,]+)\/(Year|Semester|Month)/i);
  if (tuitionHeaderMatch) {
    result.tuition_amount = parseFloat(tuitionHeaderMatch[2].replace(/,/g, ""));
    result.tuition_currency = CURRENCY_MAP[tuitionHeaderMatch[1]] || tuitionHeaderMatch[1];
    result.tuition_period = tuitionHeaderMatch[3].toLowerCase();
  }

  // Tuition from "Average Cost of Attendance" section (excludes Scholarships)
  const costSection = extractSection(md, "Average Cost of Attendance", "Scholarships");
  if (costSection) {
    const tuitionMatch = costSection.match(/Tuition Fees\s*\n+\*\*([$€£])([0-9,]+)\*\*/i);
    if (tuitionMatch) {
      const totalVal = parseFloat(tuitionMatch[2].replace(/,/g, ""));
      // Skip $NaN values UniRanks sometimes shows
      if (Number.isFinite(totalVal) && totalVal > 0) {
        result.tuition_total = totalVal;
        if (!result.tuition_amount) {
          result.tuition_amount = totalVal;
          result.tuition_currency = CURRENCY_MAP[tuitionMatch[1]] || tuitionMatch[1];
          result.tuition_period = "total";
        }
      }
    }

    const appFeeMatch = costSection.match(/Registration.*?Fees\s*\n+\*\*([$€£])([0-9,]+)\*\*/i);
    if (appFeeMatch) {
      const feeVal = parseFloat(appFeeMatch[2].replace(/,/g, ""));
      if (Number.isFinite(feeVal) && feeVal > 0) {
        result.application_fee = feeVal;
      }
    }
  }

  // === SCHOLARSHIP CONTAMINATION GUARD ===
  // If tuition_amount matches a scholarship amount, it's contaminated → null it out
  if (result.tuition_amount) {
    const scholarshipSection = extractSection(md, "Scholarships & Financial Aid", "Cost of Living") || "";
    // Find all dollar amounts in scholarship section
    const scholarshipAmounts = [...scholarshipSection.matchAll(/([$€£])([0-9,]+)/g)]
      .map(m => parseFloat(m[2].replace(/,/g, "")))
      .filter(v => Number.isFinite(v) && v > 0);

    if (scholarshipAmounts.includes(result.tuition_amount)) {
      console.warn(`[d2-detail] SCHOLARSHIP_CONTAMINATION: tuition=${result.tuition_amount} matches scholarship amount. Nulling tuition.`);
      result.tuition_amount = null;
      result.tuition_currency = null;
      result.tuition_period = null;

      // Re-attempt from headline only (already extracted above, but if it was from scholarship, try header again)
      if (tuitionHeaderMatch) {
        result.tuition_amount = parseFloat(tuitionHeaderMatch[2].replace(/,/g, ""));
        result.tuition_currency = CURRENCY_MAP[tuitionHeaderMatch[1]] || tuitionHeaderMatch[1];
        result.tuition_period = tuitionHeaderMatch[3].toLowerCase();
        // Double check the re-attempted value isn't also a scholarship amount
        if (scholarshipAmounts.includes(result.tuition_amount!)) {
          result.tuition_amount = null;
          result.tuition_currency = null;
          result.tuition_period = null;
        }
      }
    }
  }

  // Admission Requirements
  const admSection = extractSection(md, "Admission Requirements", "Tuition Fees");

  if (admSection) {
    // IELTS
    const ieltsMatch = admSection.match(/IELTS\s*\n+([0-9.]+)/i);
    if (ieltsMatch) result.ielts_min = parseFloat(ieltsMatch[1]);

    // TOEFL iBT
    const toeflMatch = admSection.match(/TOEFL iBT\s*\n+([0-9]+)/i);
    if (toeflMatch) result.toefl_min = parseInt(toeflMatch[1]);

    // GPA
    const gpaMatch = admSection.match(/Minimum GPA:\s*([0-9.]+)/i);
    if (gpaMatch) result.gpa_min = parseFloat(gpaMatch[1]);

    // Required Documents
    const docLines = admSection.match(/- (Post Graduate|Under Graduate|Higher Secondary|Visa|Passport|Heath Document|Finance Document|Recommendation|CV|SOP|Statement)/gi);
    if (docLines) {
      result.required_documents = docLines.map(d => d.replace(/^- /, "").trim());
    }

    // Additional Requirements
    const addReqLines = admSection.match(/#### Additional Requirements\n([\s\S]*?)(?=####|###|$)/);
    if (addReqLines) {
      const items = addReqLines[1].match(/- (.+)/g);
      if (items) {
        result.additional_requirements = items.map(i => i.replace(/^- /, "").trim());
      }
    }

    // Dates
    const startDateMatch = admSection.match(/Application Start Date:\s*(\d{4}-\d{2}-\d{2})/);
    if (startDateMatch) result.application_start_date = startDateMatch[1];

    const endDateMatch = admSection.match(/Application End Date:\s*(\d{4}-\d{2}-\d{2})/);
    if (endDateMatch) result.application_end_date = endDateMatch[1];

    const semStartMatch = admSection.match(/Semester Start Date:\s*(\d{4}-\d{2}-\d{2})/);
    if (semStartMatch) result.semester_start_date = semStartMatch[1];
  }

  // === ADMISSIONS TEMPLATE DETECTION ===
  // UniRanks uses default values (IELTS=6, TOEFL=80, GPA=2.5) as template across programs
  if (result.ielts_min != null || result.toefl_min != null || result.gpa_min != null) {
    const isTemplate = result.ielts_min === 6 && result.toefl_min === 80 && result.gpa_min === 2.5;
    result.admissions_source_type = isTemplate ? "source_template" : "source_specific";
  }

  // Cost of Living
  const livingSection = extractSection(md, "Cost of Living", "Scholarships");
  if (livingSection) {
    const costPatterns: [string, string][] = [
      ["On-Campus Housing", "on_campus_housing"],
      ["Off-Campus Housing", "off_campus_housing"],
      ["Meals & Groceries", "meals"],
      ["Transportation", "transportation"],
      ["Health Insurance", "health_insurance"],
      ["Books & Supplies", "books"],
      ["Personal", "personal"],
      ["Visa Application", "visa"],
    ];

    for (const [label, key] of costPatterns) {
      const match = livingSection.match(new RegExp(`${label.replace(/[&]/g, ".")}[^]*?\\*\\*\\$([0-9,]+)\\*\\*`, "i"));
      if (match) {
        result.cost_of_living[key] = parseFloat(match[1].replace(/,/g, ""));
      }
    }
  }

  // Scholarships
  const scholarshipsSection = extractSection(md, "### Scholarships", "### More Programs");
  if (scholarshipsSection) {
    const scholarshipBlocks = scholarshipsSection.split(/\n(?=\w[\w-]+\n)/);
    for (const block of scholarshipBlocks) {
      const typeMatch = block.match(/^(.+)\n/);
      const coverageMatch = block.match(/Coverage:\s*(\d+)%/);
      const intlMatch = block.match(/International Acceptance:\s*(\d+)%/);

      if (typeMatch && coverageMatch) {
        result.scholarships.push({
          type: typeMatch[1].trim(),
          coverage_pct: parseInt(coverageMatch[1]),
          international_acceptance_pct: intlMatch ? parseInt(intlMatch[1]) : null,
          description: block.slice(0, 500),
        });
      }
    }
  }

  // Detect language from page content
  if (!result.language) {
    if (/taught in english|english/i.test(md)) result.language = "English";
  }

  return result;
}

function extractSection(md: string, startHeader: string, endHeader?: string): string | null {
  const startPattern = new RegExp(`### ${startHeader}[^\\n]*`, "i");
  const startMatch = md.match(startPattern);
  if (!startMatch || startMatch.index === undefined) return null;

  const start = startMatch.index;
  let end = md.length;

  if (endHeader) {
    const endPattern = new RegExp(`### ${endHeader}`, "i");
    const endMatch = md.slice(start + startMatch[0].length).match(endPattern);
    if (endMatch?.index !== undefined) {
      end = start + startMatch[0].length + endMatch.index;
    }
  }

  return md.slice(start, end);
}

function generateProgramKey(universityId: string, title: string | null, degree: string | null): string {
  const slug = (title || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const degreeSlug = (degree || "unknown").toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  return `${universityId.slice(0, 8)}::${degreeSlug}::${slug}`;
}

function buildEvidenceMap(extracted: ProgramDetails, sourceUrl: string): Record<string, any> {
  const map: Record<string, any> = {};
  const fields = [
    "tuition_amount", "degree", "main_subject", "ielts_min", "toefl_min",
    "gpa_min", "application_start_date", "application_end_date",
  ];

  for (const f of fields) {
    if ((extracted as any)[f] != null) {
      map[f] = { source: "uniranks_program_page", url: sourceUrl, extracted_at: new Date().toISOString() };
    }
  }

  if (extracted.required_documents.length > 0) {
    map["required_documents"] = { source: "uniranks_program_page", url: sourceUrl, count: extracted.required_documents.length };
  }

  if (Object.keys(extracted.cost_of_living).length > 0) {
    map["cost_of_living"] = { source: "uniranks_program_page", url: sourceUrl, fields: Object.keys(extracted.cost_of_living) };
  }

  if (extracted.scholarships.length > 0) {
    map["scholarships"] = { source: "uniranks_program_page", url: sourceUrl, count: extracted.scholarships.length };
  }

  return map;
}

function calculateConfidence(extracted: ProgramDetails): number {
  let score = 0;
  const weights: [keyof ProgramDetails, number][] = [
    ["title", 20],
    ["degree", 15],
    ["tuition_amount", 20],
    ["main_subject", 10],
    ["ielts_min", 5],
    ["toefl_min", 5],
    ["gpa_min", 5],
    ["application_start_date", 5],
  ];

  for (const [field, weight] of weights) {
    if (extracted[field] != null) score += weight;
  }

  if (extracted.required_documents.length > 0) score += 5;
  if (Object.keys(extracted.cost_of_living).length > 0) score += 5;
  if (extracted.scholarships.length > 0) score += 5;

  return Math.min(score, 100);
}
