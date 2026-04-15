import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EXTRACTOR_VERSION = "artifact-extract-v1.0";

function supaAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Fee extraction from parsed text ──

interface FeeCandidate {
  amount: number;
  currency: string;
  context: string;
  page: number | null;
  scope: "program" | "university";
  degree_level: string | null;
  program_hint: string | null;
  confidence: number;
}

const CURRENCY_PATTERNS: Record<string, RegExp[]> = {
  USD: [/\$\s*([\d,]+(?:\.\d{2})?)/g, /USD\s*([\d,]+(?:\.\d{2})?)/gi],
  GBP: [/£\s*([\d,]+(?:\.\d{2})?)/g, /GBP\s*([\d,]+(?:\.\d{2})?)/gi],
  EUR: [/€\s*([\d,]+(?:\.\d{2})?)/g, /EUR\s*([\d,]+(?:\.\d{2})?)/gi],
  TRY: [/₺\s*([\d.,]+)/g, /TL\s*([\d.,]+)/gi, /([\d.,]+)\s*₺/g, /([\d.,]+)\s*TL/gi],
  AUD: [/A\$\s*([\d,]+(?:\.\d{2})?)/g, /AUD\s*([\d,]+(?:\.\d{2})?)/gi],
  CAD: [/C\$\s*([\d,]+(?:\.\d{2})?)/g, /CAD\s*([\d,]+(?:\.\d{2})?)/gi],
};

const FEE_KEYWORDS = /tuition|fee|fees|cost|per credit|per semester|per year|annual|yearly|ücret|harç|مصاريف|رسوم/i;
const DEGREE_PATTERNS: Array<{ pattern: RegExp; level: string }> = [
  { pattern: /\b(bachelor|undergraduate|B\.?S\.?|B\.?A\.?|B\.?Sc)\b/i, level: "bachelor" },
  { pattern: /\b(master|graduate|M\.?S\.?|M\.?A\.?|M\.?Sc|MBA|LLM)\b/i, level: "master" },
  { pattern: /\b(doctor|phd|Ph\.?D|Ed\.?D|doctorate)\b/i, level: "doctorate" },
  { pattern: /\b(certificate|diploma|associate)\b/i, level: "certificate" },
];

const PROGRAM_HINT_PATTERNS = [
  /(?:program|programme|major|department|faculty|school)\s*(?:of|in|:)?\s*([A-Z][A-Za-z &,]+)/g,
  /(?:Engineering|Business|Law|Medicine|Science|Arts|Education|Nursing)\b/g,
];

function extractPageNumber(text: string, position: number): number | null {
  const before = text.slice(0, position);
  const pageMarkers = [...before.matchAll(/--- PAGE (\d+) ---/g)];
  if (pageMarkers.length > 0) {
    return parseInt(pageMarkers[pageMarkers.length - 1][1]);
  }
  return null;
}

function extractFeeCandidates(parsedText: string, artifactType?: string): FeeCandidate[] {
  // If the entire artifact is a fee schedule, relax keyword requirement
  const isKnownFeeDoc = artifactType === "fee_schedule";
  const candidates: FeeCandidate[] = [];
  
  for (const [currency, patterns] of Object.entries(CURRENCY_PATTERNS)) {
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = regex.exec(parsedText)) !== null) {
        let raw = match[1].trim();
        // Detect European format: dots as thousands, comma as decimal (e.g. 14.000,00)
        let amount: number;
        if (/^\d{1,3}(\.\d{3})+(,\d{2})?$/.test(raw)) {
          // European: 14.000,00 → 14000.00
          amount = parseFloat(raw.replace(/\./g, "").replace(",", "."));
        } else {
          // Standard: 14,000.00 → 14000.00
          amount = parseFloat(raw.replace(/,/g, ""));
        }
        if (isNaN(amount) || amount <= 0 || amount > 500000) continue;

        // Extract context window (200 chars before and after)
        const ctxStart = Math.max(0, match.index - 200);
        const ctxEnd = Math.min(parsedText.length, match.index + match[0].length + 200);
        const context = parsedText.slice(ctxStart, ctxEnd);

        // Check fee relevance
        // Check fee relevance (skip check if whole doc is a fee schedule)
        if (!isKnownFeeDoc && !FEE_KEYWORDS.test(context)) continue;

        const page = extractPageNumber(parsedText, match.index);

        // Detect degree level from context
        let degree_level: string | null = null;
        for (const dp of DEGREE_PATTERNS) {
          if (dp.pattern.test(context)) {
            degree_level = dp.level;
            break;
          }
        }

        // Scope: if context mentions specific program, it's program-scoped
        const scope = degree_level ? "university" : "university"; // default university unless matched to program

        candidates.push({
          amount,
          currency,
          context: context.replace(/--- PAGE \d+ ---\n/g, "").trim().slice(0, 300),
          page,
          scope,
          degree_level,
          program_hint: null,
          confidence: FEE_KEYWORDS.test(context) ? 0.7 : 0.3,
        });
      }
    }
  }

  // Deduplicate by amount+currency
  const seen = new Set<string>();
  return candidates.filter(c => {
    const key = `${c.currency}:${c.amount}:${c.degree_level}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Admission fact extraction ──

interface AdmissionCandidate {
  field_name: string;
  value_raw: string;
  context: string;
  page: number | null;
  scope: "program" | "university";
  confidence: number;
}

const ADMISSION_PATTERNS: Array<{ field: string; pattern: RegExp }> = [
  { field: "min_gpa", pattern: /(?:minimum|min\.?)\s*(?:GPA|grade point)\s*(?:of|:)?\s*([\d.]+)/gi },
  { field: "min_ielts", pattern: /IELTS\s*(?:overall|score|minimum|min\.?)?\s*(?:of|:)?\s*([\d.]+)/gi },
  { field: "min_toefl", pattern: /TOEFL\s*(?:iBT|score|minimum|min\.?)?\s*(?:of|:)?\s*(\d{2,3})/gi },
  { field: "application_deadline", pattern: /(?:application|admission)\s*deadline\s*(?:is|:)?\s*([A-Z][a-z]+ \d{1,2},?\s*\d{4}|\d{1,2}\s+[A-Z][a-z]+\s+\d{4})/gi },
  { field: "scholarship_note", pattern: /(?:scholarship|bursary|financial aid|grant)\s*(?::|\-|–)?\s*(.{20,200})/gi },
];

function extractAdmissionCandidates(parsedText: string): AdmissionCandidate[] {
  const candidates: AdmissionCandidate[] = [];

  for (const { field, pattern } of ADMISSION_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(parsedText)) !== null) {
      const ctxStart = Math.max(0, match.index - 100);
      const ctxEnd = Math.min(parsedText.length, match.index + match[0].length + 100);
      const context = parsedText.slice(ctxStart, ctxEnd).replace(/--- PAGE \d+ ---\n/g, "").trim();
      const page = extractPageNumber(parsedText, match.index);

      candidates.push({
        field_name: field,
        value_raw: match[1].trim(),
        context: context.slice(0, 300),
        page,
        scope: "university",
        confidence: 0.6,
      });
    }
  }

  // Deduplicate by field+value
  const seen = new Set<string>();
  return candidates.filter(c => {
    const key = `${c.field_name}:${c.value_raw}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Academic year extraction ──

function extractAcademicYear(text: string): string | null {
  const m = text.match(/(20\d{2})\s*[-\/]\s*(20\d{2})/);
  return m ? `${m[1]}/${m[2]}` : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { artifact_id, batch_size = 5, mode = "single" } = body;
    const db = supaAdmin();

    // ── Get parsed artifacts ──
    let artifacts: any[];
    if (mode === "single" && artifact_id) {
      const { data, error } = await db
        .from("crawl_file_artifacts")
        .select("*")
        .eq("id", artifact_id)
        .eq("parse_status", "parsed")
        .single();
      if (error) throw new Error(`Artifact not found or not parsed: ${error.message}`);
      artifacts = [data];
    } else {
      // Batch: get parsed artifacts not yet extracted
      const { data, error } = await db
        .from("crawl_file_artifacts")
        .select("*")
        .eq("parse_status", "parsed")
        .order("parsed_at", { ascending: true })
        .limit(batch_size);
      if (error) throw new Error(`Query failed: ${error.message}`);
      artifacts = data || [];
    }

    if (artifacts.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No parsed artifacts to extract", processed: 0 }),
        { headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const artifact of artifacts) {
      const result: any = {
        artifact_id: artifact.id,
        file_name: artifact.file_name,
        university_id: artifact.university_id,
        observations_created: 0,
        fee_candidates: 0,
        admission_candidates: 0,
      };

      try {
        const parsedText = artifact.parsed_text;
        if (!parsedText || parsedText.length < 50) {
          result.status = "skipped";
          result.reason = "parsed_text too short";
          results.push(result);
          continue;
        }

        const academicYear = extractAcademicYear(parsedText);
        const traceId = `AEX-${Date.now()}`;
        const now = new Date().toISOString();

        // ── Extract fee candidates ──
        const feeCandidates = extractFeeCandidates(parsedText, artifact.artifact_type);
        result.fee_candidates = feeCandidates.length;

        // ── Extract admission candidates ──
        const admissionCandidates = extractAdmissionCandidates(parsedText);
        result.admission_candidates = admissionCandidates.length;

        // ── Create observations for fees ──
        const observationRows: any[] = [];

        for (const fee of feeCandidates) {
          observationRows.push({
            university_id: artifact.university_id,
            entity_type: fee.scope,
            entity_id: artifact.university_id,
            field_name: "tuition_fees",
            value_raw: `${fee.currency} ${fee.amount}`,
            value_normalized: String(fee.amount),
            currency: fee.currency,
            billing_period: "annual",
            evidence_snippet: fee.context,
            source_url: artifact.source_url,
            source_type: "official_pdf",
            source_tier: "official",
            fact_group: "fees",
            confidence: fee.confidence,
            status: "new",
            trace_id: traceId,
            parser_version: EXTRACTOR_VERSION,
            page_title: `${artifact.file_name} (page ${fee.page || "?"})`,
            extracted_at: now,
            created_at: now,
          });
        }

        // ── Create observations for admission facts ──
        for (const adm of admissionCandidates) {
          const factGroup = adm.field_name === "scholarship_note" ? "scholarships" : "admissions";
          observationRows.push({
            university_id: artifact.university_id,
            entity_type: "university",
            entity_id: artifact.university_id,
            field_name: adm.field_name,
            value_raw: adm.value_raw,
            value_normalized: adm.value_raw,
            evidence_snippet: adm.context,
            source_url: artifact.source_url,
            source_type: "official_pdf",
            source_tier: "official",
            fact_group: factGroup,
            confidence: adm.confidence,
            status: "new",
            trace_id: traceId,
            parser_version: EXTRACTOR_VERSION,
            page_title: `${artifact.file_name} (page ${adm.page || "?"})`,
            extracted_at: now,
            created_at: now,
          });
        }

        // ── Insert observations ──
        if (observationRows.length > 0) {
          const { error: insertError } = await db
            .from("official_site_observations")
            .insert(observationRows);

          if (insertError) {
            throw new Error(`Failed to insert observations: ${insertError.message}`);
          }
          result.observations_created = observationRows.length;
        }

        // ── Update artifact parse_status to extracted ──
        await db
          .from("crawl_file_artifacts")
          .update({
            parse_status: "extracted",
            updated_at: now,
          })
          .eq("id", artifact.id);

        result.status = "extracted";
        result.trace_id = traceId;
        result.academic_year = academicYear;
        console.log(`[ArtifactExtract] ✅ ${artifact.file_name}: ${observationRows.length} observations created`);

      } catch (err: any) {
        console.error(`[ArtifactExtract] ❌ ${artifact.file_name}: ${err.message}`);
        result.status = "failed";
        result.error = err.message;
      }

      results.push(result);
    }

    return new Response(
      JSON.stringify({ ok: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  } catch (err: any) {
    console.error(`[ArtifactExtract] Fatal: ${err.message}`);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  }
});
