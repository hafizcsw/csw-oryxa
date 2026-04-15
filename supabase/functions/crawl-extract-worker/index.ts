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


function normalizeEvidenceMap(extracted: any, sourceUrl: string): Record<string, { quote: string; url?: string }> {
  const ev = extracted?.evidence || {};
  const map: Record<string, { quote: string; url?: string }> = {};
  if (ev.tuition_snippet) {
    map["tuition.usd_min"] = { quote: ev.tuition_snippet, url: sourceUrl };
    if (extracted?.tuition?.basis) map["tuition.basis"] = { quote: ev.tuition_snippet, url: sourceUrl };
    if (extracted?.tuition?.scope) map["tuition.scope"] = { quote: ev.tuition_snippet, url: sourceUrl };
  }
  if (ev.requirements_snippet) {
    if (extracted?.requirements?.ielts_overall != null) map["requirements.ielts_min_overall"] = { quote: ev.requirements_snippet, url: sourceUrl };
    if (extracted?.requirements?.toefl != null) map["requirements.toefl_min"] = { quote: ev.requirements_snippet, url: sourceUrl };
    if (extracted?.requirements?.gpa != null) map["requirements.gpa_min"] = { quote: ev.requirements_snippet, url: sourceUrl };
  }
  if (ev.duration_snippet) map["duration.months"] = { quote: ev.duration_snippet, url: sourceUrl };
  if (ev.description_snippet) map["description"] = { quote: ev.description_snippet, url: sourceUrl };
  return map;
}

function buildUnifiedExtracted(extracted: any, sourceUrl: string, contentHash: string, evidenceMap: Record<string, { quote: string; url?: string }>) {
  return {
    name: extracted.program_name || null,
    degree: {
      raw: extracted.degree_level || null,
      level: extracted.degree_level || null,
    },
    discipline_hint: Array.isArray(extracted.discipline_keywords) ? extracted.discipline_keywords.join(', ') : null,
    tuition: {
      usd_min: extracted.tuition?.amount ?? null,
      usd_max: extracted.tuition?.amount ?? null,
      basis: extracted.tuition?.basis ?? null,
      scope: extracted.tuition?.scope ?? null,
      currency: extracted.tuition?.currency ?? null,
    },
    duration: {
      months: (() => {
        const raw = Number(extracted.duration?.value);
        if (!Number.isFinite(raw) || raw <= 0) return null;
        if (extracted.duration?.unit === 'years') return raw * 12;
        if (extracted.duration?.unit === 'months') return raw;
        return null;
      })(),
    },
    languages: Array.isArray(extracted.languages) ? extracted.languages : [],
    study_mode: extracted.study_mode ?? null,
    intake_months: Array.isArray(extracted.intake_months) ? extracted.intake_months : [],
    requirements: {
      ielts_min_overall: extracted.requirements?.ielts_overall ?? null,
      toefl_min: extracted.requirements?.toefl ?? null,
      gpa_min: extracted.requirements?.gpa ?? null,
    },
    scholarship: {
      available: extracted.scholarship?.has_scholarship ?? null,
      type: extracted.scholarship?.type ?? null,
    },
    description: evidenceMap['description'] ? extracted.description ?? null : null,
    evidence: evidenceMap,
    source: {
      url: sourceUrl,
      content_hash: contentHash,
    },
  };
}


async function hashText(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function computeProgramKey(sourceUrl: string, title: string, degree: string | null): Promise<string> {
  return hashText(`${(sourceUrl || "").toLowerCase()}|${(title || "").toLowerCase().trim()}|${(degree || "").toLowerCase().trim()}`);
}

interface ExtractRequest {
  action: "extract_programs" | "link_fees_pages" | "target_missing" | "extract_university";
  batch_id: string;
  limit?: number;
  fields?: string[];
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

    const body: ExtractRequest = await req.json();
    console.log(`[crawl-extract-worker] Action: ${body.action}, Batch: ${body.batch_id}, User: ${adminCheck.user.id}`);

    switch (body.action) {
      case "extract_programs":
        return await extractPrograms(supabase, lovableApiKey, body);
      case "link_fees_pages":
        return await linkFeesPages(supabase, body);
      case "target_missing":
        return await targetMissing(supabase, lovableApiKey, body);
      case "extract_university":
        return await extractUniversity(supabase, lovableApiKey, body);
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("[crawl-extract-worker] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function extractPrograms(supabase: any, apiKey: string, body: ExtractRequest) {
  const { batch_id, limit = 20 } = body;

  // FIXED: Use RPC with SKIP LOCKED to prevent race conditions
  const { data: urls, error } = await supabase.rpc("rpc_lock_urls_for_extraction", {
    p_batch_id: batch_id,
    p_limit: limit,
  });

  if (error) throw new Error(`Failed to lock URLs for extraction: ${error.message}`);

  if (!urls || urls.length === 0) {
    return new Response(
      JSON.stringify({ drafts_created: 0, evidence_rows: 0, message: "No URLs to process" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let draftsCreated = 0;
  let evidenceRows = 0;

  for (const urlRecord of urls) {
    if (!urlRecord.text_content) continue;

    try {
      // Call Lovable AI for extraction
      const extracted = await callAIForExtraction(apiKey, urlRecord.text_content);

      if (!extracted || !extracted.program_name) {
        console.log(`No program found in URL ID ${urlRecord.url_id}`);
        await insertIngestError(supabase, { pipeline: "crawl_pipeline", batch_id, entity_hint: "program", source_url: urlRecord.url, stage: "extract", reason: "no_programs_extracted", details: { url_id: urlRecord.url_id } });
        await supabase.from("program_urls").update({ locked_at: null, locked_by: null }).eq("id", urlRecord.url_id);
        continue;
      }

      // FIXED: Don't default language to 'en' - leave null if unknown
      // FIXED: Don't convert semesters to months with arbitrary 6 multiplier
      let durationMonths: number | null = null;
      if (extracted.duration) {
        if (extracted.duration.unit === "months") {
          durationMonths = extracted.duration.value;
        } else if (extracted.duration.unit === "years") {
          durationMonths = extracted.duration.value * 12;
        }
        // semesters → leave null unless we have evidence of months per semester
      }

      const unifiedEvidence = normalizeEvidenceMap(extracted, urlRecord.url);
      const contentHash = await hashText(urlRecord.text_content || "");
      const programKey = await computeProgramKey(urlRecord.url, extracted.program_name || "", extracted.degree_level || null);
      const unifiedExtracted = buildUnifiedExtracted(extracted, urlRecord.url, contentHash, unifiedEvidence);

      // Create program draft with enhanced extracted data
      const { data: draft, error: draftError } = await supabase
        .from("program_draft")
        .upsert({
          batch_id,
          university_id: urlRecord.university_id,
          raw_page_id: urlRecord.raw_page_id,
          source_program_url: urlRecord.url,
          title: extracted.program_name,
          degree_level: extracted.degree_level,
          language: extracted.languages?.[0] || null,  // FIXED: null instead of 'en'
          duration_months: durationMonths,
          currency: extracted.tuition?.currency,
          tuition_fee: extracted.tuition?.amount || null,
          application_fee: extracted.application_fee?.amount || null,
          intake_months: extracted.intake_months?.length > 0 ? extracted.intake_months : null,
          requirements: extracted.requirements?.documents || null,
          schema_version: "unified_v2",
          program_key: programKey,
          content_hash: contentHash,
          last_extracted_at: new Date().toISOString(),
          field_evidence_map: unifiedEvidence,
          extracted_json: unifiedExtracted,  // Unified v2 payload for publish mapping
          missing_fields: calculateMissingFields(extracted),
          flags: [],
          approval_tier: null,
          status: "extracted",
        }, {
          onConflict: "program_key",
        })
        .select()
        .single();

      if (draftError) {
        console.error(`Failed to create draft for URL ID ${urlRecord.url_id}:`, draftError);
        await insertIngestError(supabase, { pipeline: "crawl_pipeline", batch_id, entity_hint: "program", source_url: urlRecord.url, stage: "upsert", reason: "db_error", details: { url_id: urlRecord.url_id, error: draftError.message } });
        await supabase.from("program_urls").update({ locked_at: null, locked_by: null }).eq("id", urlRecord.url_id);
        continue;
      }

      draftsCreated++;

      // Store evidence for each field (ENHANCED: more fields)
      const evidenceFields = [
        { field: "tuition", snippet: extracted.evidence?.tuition_snippet },
        { field: "language", snippet: extracted.evidence?.language_snippet },
        { field: "requirements", snippet: extracted.evidence?.requirements_snippet },
        { field: "duration", snippet: extracted.evidence?.duration_snippet },
        { field: "intake", snippet: extracted.evidence?.intake_snippet },
        { field: "application_fee", snippet: extracted.evidence?.application_fee_snippet },
        { field: "scholarship", snippet: extracted.evidence?.scholarship_snippet },
      ];

      for (const ev of evidenceFields) {
        if (ev.snippet) {
          const { error: evError } = await supabase
            .from("source_evidence")
            .upsert({
              program_draft_id: draft.id,
              field: ev.field,
              source_url: urlRecord.url,
              text_snippet: ev.snippet,
              confidence: extracted.confidence || 0.7,
              tuition_basis: ev.field === "tuition" ? extracted.tuition?.basis : null,
              tuition_scope: ev.field === "tuition" ? extracted.tuition?.scope : null,
              is_primary: true,
              extractor: "gemini-flash",
            }, {
              onConflict: "program_draft_id,field,source_url",
            });

          if (!evError) evidenceRows++;
        }
      }

      // Unlock URL after successful processing
      await supabase.from("program_urls").update({ locked_at: null, locked_by: null, status: "extracted" }).eq("id", urlRecord.url_id);

    } catch (error: any) {
      console.error(`Error extracting URL ID ${urlRecord.url_id}:`, error);
      await insertIngestError(supabase, { pipeline: "crawl_pipeline", batch_id, entity_hint: "page", source_url: urlRecord.url, stage: "extract", reason: "db_error", details: { url_id: urlRecord.url_id, message: error?.message || "unknown" } });
      await supabase.from("program_urls").update({ locked_at: null, locked_by: null }).eq("id", urlRecord.url_id);
    }
  }

  // FIXED: Atomic increment (avoid race conditions under parallel workers)
  await supabase.rpc("rpc_increment_batch_programs_extracted", {
    p_batch_id: batch_id,
    p_delta: draftsCreated,
  });

  // Update batch status separately (do not touch counters here)
  await supabase
    .from("crawl_batches")
    .update({ status: "extracting" })
    .eq("id", batch_id);

  return new Response(
    JSON.stringify({ drafts_created: draftsCreated, evidence_rows: evidenceRows }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function callAIForExtraction(apiKey: string, textContent: string): Promise<any> {
  // PHASE 3: Raised from 15KB to 25KB to capture tuition/requirements at page bottom
  const maxLength = 25000;
  const truncatedText = textContent.length > maxLength 
    ? textContent.substring(0, maxLength) + "..." 
    : textContent;

  const systemPrompt = `You are a university program data extractor. Extract structured information about academic programs from university website content.

CRITICAL RULES:
1. Only extract data that is EXPLICITLY mentioned in the text
2. For each value you extract, you MUST provide the exact text snippet as evidence
3. If a field is not clearly mentioned, set it to null - NEVER GUESS
4. For tuition, ALWAYS specify basis (per_year, per_semester, per_credit, total) and scope (international, domestic, all)
5. Do NOT use default values - null is better than wrong
6. For intake_months: extract actual months (1-12) when applications are accepted or when the program starts
7. For application_fee: extract any mentioned application or registration fee

Return a JSON object with this exact structure:
{
  "program_name": "string or null",
  "degree_level": "bachelor|master|phd|diploma|certificate|null",
  "discipline_keywords": ["array of keywords for discipline matching"],
  "description": "short program description (max 500 chars) or null",
  "duration": { "value": number, "unit": "months|years|semesters" } or null,
  "study_mode": "on_campus|online|hybrid|null",
  "languages": ["en", "ar", etc] or [],
  "intake_months": [1-12 array of months when program starts] or [],
  "next_intake_date": "YYYY-MM-DD" or null,
  "tuition": {
    "amount": number or null,
    "currency": "USD|EUR|GBP|etc",
    "basis": "per_year|per_semester|per_credit|total|null",
    "scope": "international|domestic|all|null",
    "is_free": boolean
  },
  "application_fee": {
    "amount": number or null,
    "currency": "USD|EUR|GBP|etc"
  },
  "requirements": {
    "ielts_overall": number 0-9 or null,
    "ielts_each_section": number 0-9 or null,
    "toefl": number or null,
    "toefl_required": boolean or null,
    "gpa": number 0-4 or null,
    "prep_year_required": boolean or null,
    "foundation_required": boolean or null,
    "documents": ["list of required documents"] or []
  },
  "interview_required": boolean or null,
  "entrance_exam_required": boolean or null,
  "entrance_exam_types": ["list of exam types"] or [],
  "scholarship": {
    "has_scholarship": boolean,
    "type": "full|partial|merit|need-based|null",
    "coverage_percent": number or null,
    "amount_usd": number or null,
    "monthly_stipend_usd": number or null,
    "covers_housing": boolean or null,
    "covers_insurance": boolean or null
  },
  "evidence": {
    "tuition_snippet": "exact quote from text",
    "language_snippet": "exact quote from text",
    "requirements_snippet": "exact quote from text",
    "duration_snippet": "exact quote from text",
    "intake_snippet": "exact quote about application deadlines or start dates",
    "application_fee_snippet": "exact quote about application fee",
    "scholarship_snippet": "exact quote about scholarships",
    "interview_snippet": "exact quote about interview requirement",
    "exam_snippet": "exact quote about entrance exams"
  },
  "confidence": 0.0-1.0
}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract program information from this university page content:\n\n${truncatedText}` },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content in AI response");
  }

  // Parse JSON from response (handle markdown code blocks)
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    return JSON.parse(jsonStr.trim());
  } catch {
    console.error("Failed to parse AI response as JSON:", content);
    return null;
  }
}

function calculateMissingFields(extracted: any): string[] {
  const missing: string[] = [];

  // Core required fields
  if (!extracted.program_name) missing.push("TITLE");
  if (!extracted.degree_level) missing.push("DEGREE");
  if (!extracted.duration) missing.push("DURATION");
  if (!extracted.languages || extracted.languages.length === 0) missing.push("LANGUAGE");
  if (!extracted.study_mode || extracted.study_mode === "unknown") missing.push("STUDY_MODE");
  
  // Intake dates - critical for Publish Gate
  if (!extracted.intake_months || extracted.intake_months.length === 0) missing.push("INTAKE_MONTHS");
  if (!extracted.next_intake_date) missing.push("NEXT_INTAKE_DATE");

  // Tuition validation - stricter: basis and scope are REQUIRED
  const tuition = extracted.tuition;
  if (!tuition?.is_free) {
    if (!tuition?.amount || !tuition?.currency) {
      missing.push("TUITION_AMOUNT");
    }
    if (!tuition?.basis || tuition.basis === "unknown" || tuition.basis === null) {
      missing.push("TUITION_BASIS");
    }
    if (!tuition?.scope || tuition.scope === "unknown" || tuition.scope === null) {
      missing.push("TUITION_SCOPE");
    }
  }
  
  // Requirements - optional but tracked
  if (!extracted.requirements?.ielts_overall && !extracted.requirements?.toefl) {
    missing.push("ENGLISH_REQUIREMENT");
  }
  
  // Application fee - optional but tracked
  if (!extracted.application_fee?.amount) {
    missing.push("APP_FEE");
  }
  
  // Required documents - optional but tracked
  if (!extracted.requirements?.documents || extracted.requirements.documents.length === 0) {
    missing.push("REQUIRED_DOCS");
  }

  return missing;
}

async function linkFeesPages(supabase: any, body: ExtractRequest) {
  const { batch_id, limit = 50 } = body;

  // Get drafts and their related fees/admissions pages
  const { data: drafts, error } = await supabase
    .from("program_draft")
    .select("id, university_id, source_program_url")
    .eq("batch_id", batch_id)
    .limit(limit);

  if (error) throw new Error(`Failed to fetch drafts: ${error.message}`);

  let linksCreated = 0;

  for (const draft of drafts || []) {
    // Find fees and admissions pages for this university
    const { data: relatedUrls } = await supabase
      .from("program_urls")
      .select("id, url, kind")
      .eq("university_id", draft.university_id)
      .in("kind", ["fees", "admissions"])
      .eq("status", "fetched");

    for (const relUrl of relatedUrls || []) {
      const { error: linkError } = await supabase
        .from("program_related_urls")
        .upsert({
          program_draft_id: draft.id,
          program_url_id: relUrl.id,
          rel: relUrl.kind,
        }, {
          onConflict: "program_draft_id,program_url_id,rel",
          ignoreDuplicates: true,
        });

      if (!linkError) linksCreated++;
    }
  }

  return new Response(
    JSON.stringify({ links_created: linksCreated }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function targetMissing(supabase: any, apiKey: string, body: ExtractRequest) {
  const { batch_id, fields = ["tuition", "language"], limit = 50 } = body;

  // Get drafts with missing fields
  const { data: drafts, error } = await supabase
    .from("program_draft")
    .select(`
      id, university_id, source_program_url, missing_fields, extracted_json,
      program_related_urls(
        program_url_id,
        rel,
        program_urls(id, url, raw_page_id, raw_pages(text_content))
      )
    `)
    .eq("batch_id", batch_id)
    .overlaps("missing_fields", fields)
    .limit(limit);

  if (error) throw new Error(`Failed to fetch drafts: ${error.message}`);

  let draftsImproved = 0;
  let evidenceAdded = 0;

  for (const draft of drafts || []) {
    const missingFields = draft.missing_fields || [];
    let improved = false;

    // For each missing field, try to find it in related pages
    for (const field of missingFields) {
      if (!fields.includes(field)) continue;

      // Find relevant related pages
      const relatedPages = (draft.program_related_urls || [])
        .filter((rel: any) => {
          if (field === "tuition" || field === "tuition_metadata") {
            return rel.rel === "fees";
          }
          if (field === "language") {
            return rel.rel === "admissions" || rel.rel === "fees";
          }
          return false;
        })
        .map((rel: any) => rel.program_urls)
        .filter((page: any) => page?.raw_pages?.text_content);

      for (const page of relatedPages) {
        try {
          const extracted = await extractSpecificField(apiKey, page.raw_pages.text_content, field);

          if (extracted && extracted.value) {
            // Update draft with new data
            const updates: any = {};
            
            if (field === "tuition" && extracted.value.amount) {
              updates.extracted_json = {
                ...draft.extracted_json,
                tuition: extracted.value,
              };
            } else if (field === "language" && extracted.value.languages) {
              updates.extracted_json = {
                ...draft.extracted_json,
                languages: extracted.value.languages,
              };
              updates.language = extracted.value.languages[0];
            }

            if (Object.keys(updates).length > 0) {
              // Remove from missing fields
              updates.missing_fields = missingFields.filter((f: string) => f !== field);

              await supabase
                .from("program_draft")
                .update(updates)
                .eq("id", draft.id);

              // Add evidence
              if (extracted.snippet) {
                await supabase
                  .from("source_evidence")
                  .upsert({
                    program_draft_id: draft.id,
                    field,
                    source_url: page.url,
                    text_snippet: extracted.snippet,
                    confidence: 0.8,
                    tuition_basis: extracted.value.basis,
                    tuition_scope: extracted.value.scope,
                    is_primary: false, // Secondary source
                    extractor: "gemini-flash-targeted",
                  }, {
                    onConflict: "program_draft_id,field,source_url",
                  });

                evidenceAdded++;
              }

              improved = true;
              break; // Found the field, move to next
            }
          }
        } catch (error) {
          console.error(`Error extracting ${field} from ${page.url}:`, error);
        }
      }
    }

    if (improved) draftsImproved++;
  }

  return new Response(
    JSON.stringify({ drafts_improved: draftsImproved, evidence_added: evidenceAdded }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function extractSpecificField(apiKey: string, textContent: string, field: string): Promise<{ value: any; snippet: string } | null> {
  const maxLength = 8000;
  const truncatedText = textContent.length > maxLength 
    ? textContent.substring(0, maxLength) 
    : textContent;

  let prompt: string;
  let schema: string;

  if (field === "tuition" || field === "tuition_metadata") {
    prompt = `Extract ONLY tuition/fee information from this text. Find the exact amount, currency, and whether it's per year, semester, credit, or total. Also identify if it's for international or domestic students.`;
    schema = `{
      "tuition": {
        "amount": number or null,
        "currency": "USD|EUR|GBP|etc",
        "basis": "per_year|per_semester|per_credit|total|unknown",
        "scope": "international|domestic|all|unknown",
        "is_free": boolean
      },
      "snippet": "exact quote with the fee information"
    }`;
  } else if (field === "language") {
    prompt = `Extract ONLY the language of instruction from this text. What language(s) are courses taught in?`;
    schema = `{
      "languages": ["en", "ar", etc],
      "snippet": "exact quote mentioning the language of instruction"
    }`;
  } else {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: `You extract specific data from university pages. ${prompt}\n\nReturn JSON with this structure:\n${schema}\n\nIf the information is not found, return null.` 
        },
        { role: "user", content: truncatedText },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) return null;

  try {
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());
    
    if (field === "tuition" || field === "tuition_metadata") {
      if (parsed.tuition?.amount) {
        return { value: parsed.tuition, snippet: parsed.snippet };
      }
    } else if (field === "language") {
      if (parsed.languages?.length > 0) {
        return { value: { languages: parsed.languages }, snippet: parsed.snippet };
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function extractUniversity(supabase: any, apiKey: string, body: ExtractRequest) {
  const { batch_id, limit = 10 } = body;

  // Get universities from the batch that need enrichment
  const { data: batchUnis, error } = await supabase
    .from("crawl_batch_universities")
    .select(`
      university_id,
      crawl_batches(
        id, country_code
      )
    `)
    .eq("batch_id", batch_id)
    .limit(limit);

  if (error) throw new Error(`Failed to fetch batch universities: ${error.message}`);

  let universityEnrichments = 0;
  let universityEvidenceRows = 0;

  // Get Firecrawl API key for branding extraction (logo)
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

  for (const record of batchUnis || []) {
    const uniId = record.university_id;
    const countryCode = record.crawl_batches?.country_code;

    try {
      // Get university details
      const { data: uni, error: uniError } = await supabase
        .from("universities")
        .select("id, name, slug, website_url, country_id")
        .eq("id", uniId)
        .single();

      if (uniError || !uni) {
        console.log(`University ${uniId} not found or error:`, uniError?.message);
        continue;
      }

      // Get institutional pages (home, about, housing) for this university
      const { data: instPages, error: pagesError } = await supabase
        .from("program_urls")
        .select("id, url, kind, raw_page_id, raw_pages(text_content)")
        .eq("university_id", uniId)
        .in("kind", ["home", "about", "housing"])
        .eq("status", "fetched")
        .limit(3);

      if (pagesError || !instPages || instPages.length === 0) {
        console.log(`No institutional pages found for university ${uniId}`);
        continue;
      }

      // Merge content from all institutional pages
      const pageContents = instPages
        .filter((p: any) => p.raw_pages?.text_content)
        .map((p: any) => p.raw_pages.text_content)
        .join("\n\n---PAGE BREAK---\n\n");

      if (!pageContents) {
        console.log(`No text content found for university ${uniId}`);
        continue;
      }

      // PHASE 2: Try Firecrawl branding for logo extraction
      let brandingLogo: string | null = null;
      if (firecrawlKey && uni.website_url) {
        try {
          const brandingResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${firecrawlKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: uni.website_url,
              formats: ["branding"],
            }),
          });
          if (brandingResp.ok) {
            const brandingData = await brandingResp.json();
            brandingLogo = brandingData?.data?.branding?.logo 
              || brandingData?.data?.branding?.images?.logo 
              || brandingData?.branding?.logo
              || null;
            console.log(`[Branding] Logo for ${uni.slug}: ${brandingLogo ? 'found' : 'not found'}`);
          }
        } catch (e) {
          console.log(`[Branding] Firecrawl error for ${uni.slug}:`, e);
        }
      }

      // Call AI for institutional data extraction (PHASE 2: enhanced prompt)
      const extracted = await callAIForUniversityExtraction(apiKey, pageContents, uni.name, countryCode);

      if (!extracted) {
        console.log(`Failed to extract data for university ${uniId}`);
        continue;
      }

      // Update university with extracted institutional data
      const updates: any = {};
      
      if (extracted.city) updates.city = extracted.city;
      if (extracted.description) updates.description = extracted.description;
      
      // PHASE 2: Prefer Firecrawl branding logo over AI-extracted text-based logo
      if (brandingLogo) {
        updates.logo_url = brandingLogo;
      } else if (extracted.logo_url) {
        updates.logo_url = extracted.logo_url;
      }
      
      if (extracted.hero_image_url) updates.hero_image_url = extracted.hero_image_url;
      
      // PHASE 2: New fields
      if (extracted.name_en) updates.name_en = extracted.name_en;
      if (extracted.website_url && !uni.website_url) updates.website_url = extracted.website_url;
      if (countryCode) updates.country_code = countryCode;
      
      if (extracted.housing) {
        updates.has_dorm = extracted.housing.has_dorm;
        if (extracted.housing.monthly_rent) {
          updates.dorm_price_monthly_local = extracted.housing.monthly_rent;
        }
        if (extracted.housing.currency) {
          updates.dorm_currency_code = extracted.housing.currency;
        }
      }

      // Only update if we have data to add
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("universities")
          .update(updates)
          .eq("id", uniId);

        if (!updateError) {
          universityEnrichments++;
          console.log(`[University Enrichment] Updated ${uni.slug} with fields:`, Object.keys(updates).join(", "));
        } else {
          console.error(`Failed to update university ${uniId}:`, updateError);
        }
      }

      // Store evidence for each extracted field
      const evidenceFields = [
        { field: "city", value: extracted.city, snippet: extracted.evidence?.city_snippet },
        { field: "description", value: extracted.description, snippet: extracted.evidence?.description_snippet },
        { field: "logo_url", value: updates.logo_url, snippet: brandingLogo ? `Firecrawl branding: ${brandingLogo}` : extracted.evidence?.logo_snippet },
        { field: "housing", value: extracted.housing, snippet: extracted.evidence?.housing_snippet },
        { field: "name_en", value: extracted.name_en, snippet: extracted.evidence?.name_en_snippet },
      ];

      for (const ev of evidenceFields) {
        if (ev.value && ev.snippet) {
          const { error: evError } = await supabase
            .from("university_source_evidence")
            .upsert({
              university_id: uniId,
              field: ev.field,
              source_urls: instPages.map((p: any) => p.url).filter(Boolean),
              text_snippet: ev.snippet,
              confidence: extracted.confidence || 0.75,
              batch_id,
              extractor: "gemini-flash-institutional-v2",
              data_extracted: ev.value,
            }, {
              onConflict: "university_id,field,batch_id",
            });

          if (!evError) {
            universityEvidenceRows++;
          } else {
            console.error(`Failed to save evidence for ${ev.field} on university ${uniId}:`, evError);
          }
        }
      }

    } catch (error) {
      console.error(`Error processing university ${uniId}:`, error);
    }
  }

  // Update batch status
  await supabase
    .from("crawl_batches")
    .update({ status: "enriching" })
    .eq("id", batch_id);

  return new Response(
    JSON.stringify({ 
      university_enrichments: universityEnrichments, 
      university_evidence_rows: universityEvidenceRows 
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function callAIForUniversityExtraction(apiKey: string, textContent: string, uniName: string, countryCode?: string): Promise<any> {
  const maxLength = 25000;
  const truncatedText = textContent.length > maxLength 
    ? textContent.substring(0, maxLength) + "..." 
    : textContent;

  const countryContext = countryCode ? `The university is located in ${countryCode}.` : "";

  const systemPrompt = `You are a university institutional data extractor. Extract key information about the university from official website content.

CRITICAL RULES:
1. Only extract data that is EXPLICITLY mentioned in the text
2. For each value you extract, you MUST provide the exact text snippet as evidence
3. If a field is not clearly mentioned, set it to null - NEVER GUESS
4. Extract city name only if it's clearly mentioned (not inferred from domain)
5. For logos: extract URLs to logo images mentioned in the content
6. For housing: extract rental prices if mentioned, with currency
7. Focus on factual institutional information, not marketing claims
8. Extract the English name of the university if available

${countryContext}

Return a JSON object with this exact structure:
{
  "city": "city name or null",
  "name_en": "English name of the university or null",
  "description": "brief institutional description (max 500 chars) or null",
  "logo_url": "https://... or null",
  "hero_image_url": "https://... or null",
  "website_url": "official website URL or null",
  "housing": {
    "has_dorm": boolean or null,
    "monthly_rent": number or null,
    "currency": "USD|EUR|GBP|etc|null",
    "details": "any additional housing info or null"
  } or null,
  "evidence": {
    "city_snippet": "exact quote from text",
    "description_snippet": "exact quote from text",
    "logo_snippet": "exact quote or URL reference",
    "housing_snippet": "exact quote about housing",
    "name_en_snippet": "exact quote with English name"
  },
  "confidence": 0.0-1.0
}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract institutional information about ${uniName} from this website content:\n\n${truncatedText}` },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`AI API error for university extraction: ${response.status} - ${errorText}`);
    return null;
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    console.error("No content in AI response for university extraction");
    return null;
  }

  // Parse JSON from response (handle markdown code blocks)
  try {
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());
    
    return {
      city: parsed.city || null,
      name_en: parsed.name_en || null,
      description: parsed.description || null,
      logo_url: parsed.logo_url || null,
      hero_image_url: parsed.hero_image_url || null,
      website_url: parsed.website_url || null,
      housing: parsed.housing || null,
      evidence: parsed.evidence || {},
      confidence: parsed.confidence || 0.7,
    };
  } catch (error) {
    console.error("Failed to parse AI response for university extraction:", error);
    return null;
  }
}
