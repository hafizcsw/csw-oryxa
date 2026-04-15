import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflight, handleError, generateTraceId } from "../_shared/cors.ts";

const INGESTION_BUCKETS = ["program-ingestion", "ingest", "university-media"] as const;

Deno.serve(async (req) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("origin");
  const tid = generateTraceId();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { job_id, university_id } = await req.json();
    if (!job_id) throw new Error("Missing job_id");

    // Get the job
    const { data: job, error: jobErr } = await supabase
      .from("program_ingestion_jobs")
      .select("*")
      .eq("id", job_id)
      .single();
    if (jobErr || !job) throw new Error("Job not found");

    // Verify university ownership
    if (university_id && job.university_id !== university_id) {
      throw new Error("UNIVERSITY_MISMATCH");
    }

    await supabase
      .from("program_ingestion_jobs")
      .update({ status: "processing" })
      .eq("id", job_id);

    // ── Read real file content from storage ──
    let fileText = "";

    // Check if there's already extracted text from a previous step (ingest_artifacts)
    const { data: textArtifact } = await supabase
      .from("ingest_artifacts")
      .select("content")
      .eq("job_id", job_id)
      .eq("kind", "text")
      .maybeSingle();

    if (textArtifact?.content?.text) {
      fileText = textArtifact.content.text;
    } else {
      // Download the actual file from storage
      const filePath = job.file_path;
      if (!filePath) throw new Error("No file_path on job");

      // Canonical bucket is program-ingestion; keep legacy fallbacks for existing jobs.
      let fileBuffer: Uint8Array | null = null;
      for (const bucket of INGESTION_BUCKETS) {
        const { data: fileData, error: dlErr } = await supabase.storage
          .from(bucket)
          .download(filePath);
        if (!dlErr && fileData) {
          fileBuffer = new Uint8Array(await fileData.arrayBuffer());
          break;
        }
      }

      if (!fileBuffer) {
        throw new Error("FILE_NOT_FOUND: Could not download file from storage");
      }

      // For text-based files, decode directly
      const fileType = (job.file_type || "").toLowerCase();
      if (fileType === "txt" || fileType === "csv" || fileType === "text") {
        fileText = new TextDecoder().decode(fileBuffer);
      } else {
        // For PDF/DOCX, we encode as base64 and send to AI for extraction
        // The AI model can process the raw text content
        const decoder = new TextDecoder("utf-8", { fatal: false });
        const rawText = decoder.decode(fileBuffer);
        // Strip binary noise, keep readable text
        fileText = rawText.replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\n\r\t]/g, " ")
          .replace(/\s{3,}/g, " ")
          .trim();

        if (fileText.length < 50) {
          throw new Error("NO_TEXT_EXTRACTED: File contains insufficient readable text. Upload a text-based document or use the text extraction step first.");
        }
      }
    }

    if (!fileText || fileText.length < 50) {
      await supabase
        .from("program_ingestion_jobs")
        .update({ status: "failed", error_message: "Insufficient text content" })
        .eq("id", job_id);
      throw new Error("NO_TEXT_EXTRACTED");
    }

    // ── AI extraction using OpenAI ──
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const systemPrompt = `You are an expert at extracting structured program data from university documents (brochures, fee sheets, curriculum docs, requirements).

Extract ALL programs/offers found. For each, extract:
- program_name (original language)
- program_name_en (English translation if available)
- degree_level (bachelor, master, phd, diploma, certificate)
- faculty, department
- duration_months
- teaching_language
- study_mode (on_campus, online, hybrid)
- delivery_mode (full_time, part_time)
- tuition_amount, currency_code, tuition_basis (yearly, semester, total)
- application_deadline (ISO date if found)
- apply_url
- ielts_min, toefl_min, gpa_min
- intake_months (array of month numbers 1-12)
- seats_total
- scholarship_info (any scholarship mentions)
- requirements (array of strings)
- description

For EACH field you extract, also include:
- [field]_confidence: 0-1 score
- [field]_evidence: the exact snippet from the source text that supports this value (20-80 chars)

Return JSON: { "programs": [...] }`;

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
          { role: "user", content: `Extract all program information from this document text:\n\n${fileText.slice(0, 120000)}` },
        ],
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI gateway error: ${aiResponse.status} - ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    let extracted: any;
    try {
      extracted = JSON.parse(content);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    const programs = Array.isArray(extracted) ? extracted : extracted.programs || [extracted];

    // Store AI result on the job
    await supabase
      .from("program_ingestion_jobs")
      .update({
        status: "completed",
        ai_result: extracted,
        model_used: "gpt-4o-mini",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    // Create proposals for each extracted program with evidence
    const proposals: any[] = [];
    for (const prog of programs) {
      const fields = [
        "program_name", "program_name_en", "degree_level", "faculty", "department",
        "duration_months", "teaching_language", "study_mode", "delivery_mode",
        "tuition_amount", "currency_code", "tuition_basis",
        "application_deadline", "apply_url", "ielts_min", "toefl_min", "gpa_min",
        "intake_months", "seats_total", "requirements", "description",
      ];

      for (const field of fields) {
        if (prog[field] != null && prog[field] !== "" && prog[field] !== undefined) {
          proposals.push({
            job_id,
            target_entity: "program",
            target_field: field,
            proposed_value: typeof prog[field] === "object" ? prog[field] : { value: prog[field] },
            confidence: prog[`${field}_confidence`] || prog.confidence || 0.7,
            evidence_snippet: prog[`${field}_evidence`] || null,
            review_status: "pending",
          });
        }
      }

      if (prog.scholarship_info) {
        proposals.push({
          job_id,
          target_entity: "scholarship",
          target_field: "scholarship_info",
          proposed_value: typeof prog.scholarship_info === "object" ? prog.scholarship_info : { value: prog.scholarship_info },
          confidence: prog.scholarship_confidence || 0.6,
          evidence_snippet: prog.scholarship_evidence || null,
          review_status: "pending",
        });
      }
    }

    if (proposals.length > 0) {
      await supabase
        .from("program_ingestion_proposals")
        .insert(proposals);
    }

    return new Response(JSON.stringify({
      ok: true,
      tid,
      job_id,
      programs_found: programs.length,
      proposals_created: proposals.length,
    }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
    });

  } catch (e) {
    return handleError(e, tid, origin);
  }
});
