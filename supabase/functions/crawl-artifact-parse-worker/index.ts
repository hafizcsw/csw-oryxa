import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PARSER_VERSION = "artifact-parse-v1.0";
const FETCH_TIMEOUT_MS = 30_000;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

function supaAdmin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Extract text from PDF using pdf.js
 */
async function extractPdfText(buffer: Uint8Array): Promise<{ text: string; pages: number }> {
  // Use unpdf which wraps pdf.js and works without worker threads
  const { extractText, getDocumentProxy } = await import("npm:unpdf@0.12.1");
  
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  
  let fullText = "";
  for (let i = 0; i < text.length; i++) {
    fullText += `--- PAGE ${i + 1} ---\n${text[i]}\n\n`;
  }
  
  return { text: fullText, pages: totalPages };
}

/**
 * Detect language from text content (simple heuristic)
 */
function detectLanguage(text: string): string {
  const sample = text.slice(0, 2000).toLowerCase();
  // Arabic
  if (/[\u0600-\u06FF]{10,}/.test(sample)) return "ar";
  // Russian/Cyrillic
  if (/[\u0400-\u04FF]{10,}/.test(sample)) return "ru";
  // Turkish
  if (/[çğıöşüÇĞİÖŞÜ]/.test(sample) && /\b(ve|bir|için|ile|olan)\b/.test(sample)) return "tr";
  // German
  if (/\b(und|der|die|das|ist|für|ein|von)\b/i.test(sample)) return "de";
  // French
  if (/\b(les|des|une|est|pour|dans|avec|sur)\b/i.test(sample)) return "fr";
  // Default English
  return "en";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { artifact_id, batch_size = 5, mode = "single" } = body;
    const db = supaAdmin();
    const results: any[] = [];

    // Get artifacts to process
    let artifacts: any[];
    if (mode === "single" && artifact_id) {
      const { data, error } = await db
        .from("crawl_file_artifacts")
        .select("*")
        .eq("id", artifact_id)
        .single();
      if (error) throw new Error(`Artifact not found: ${error.message}`);
      artifacts = [data];
    } else {
      // Batch mode: get pending artifacts
      const { data, error } = await db
        .from("crawl_file_artifacts")
        .select("*")
        .eq("parse_status", "pending")
        .eq("mime_type", "application/pdf")
        .order("created_at", { ascending: true })
        .limit(batch_size);
      if (error) throw new Error(`Query failed: ${error.message}`);
      artifacts = data || [];
    }

    if (artifacts.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No pending artifacts", processed: 0 }),
        { headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    for (const artifact of artifacts) {
      const artifactResult: any = {
        id: artifact.id,
        file_name: artifact.file_name,
        source_url: artifact.source_url,
      };

      try {
        // ── Step 1: Download the file ──
        console.log(`[ArtifactParse] ⬇️ Downloading: ${artifact.source_url}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        
        const resp = await fetch(artifact.source_url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
            "Accept": "application/pdf,*/*",
          },
        });
        clearTimeout(timeout);

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status} downloading ${artifact.source_url}`);
        }

        const contentType = resp.headers.get("content-type") || "";
        const fileBytes = new Uint8Array(await resp.arrayBuffer());
        const fileSize = fileBytes.length;

        if (fileSize > MAX_FILE_SIZE) {
          throw new Error(`File too large: ${fileSize} bytes (max ${MAX_FILE_SIZE})`);
        }
        if (fileSize < 100) {
          throw new Error(`File too small: ${fileSize} bytes`);
        }

        artifactResult.file_size_bytes = fileSize;
        artifactResult.download_ok = true;

        // ── Step 2: Upload to storage ──
        const storagePath = `crawl-artifacts/${artifact.university_id}/${artifact.id}/${artifact.file_name || "file.pdf"}`;
        console.log(`[ArtifactParse] 📦 Uploading to storage: ${storagePath}`);

        const { data: uploadData, error: uploadError } = await db.storage
          .from("university-assets")
          .upload(storagePath, fileBytes, {
            contentType: artifact.mime_type || "application/pdf",
            cacheControl: "31536000",
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        artifactResult.storage_path = storagePath;
        artifactResult.storage_ok = true;

        // ── Step 3: Parse if PDF ──
        let parseResult: any = null;
        if (artifact.mime_type === "application/pdf" || artifact.file_name?.endsWith(".pdf")) {
          console.log(`[ArtifactParse] 📄 Parsing PDF: ${artifact.file_name}`);
          try {
            parseResult = await extractPdfText(fileBytes);
            artifactResult.parsed_pages = parseResult.pages;
            artifactResult.parsed_chars = parseResult.text.length;
            artifactResult.parse_ok = true;
          } catch (parseErr: any) {
            parseResult = { error: parseErr.message };
            artifactResult.parse_ok = false;
            artifactResult.parse_error = parseErr.message;
          }
        } else {
          artifactResult.parse_ok = false;
          artifactResult.parse_error = "not_pdf";
        }

        // ── Step 4: Detect language ──
        const detectedLang = parseResult?.text ? detectLanguage(parseResult.text) : null;
        artifactResult.parsed_language = detectedLang;

        // ── Step 5: Update artifact record ──
        const updatePayload: any = {
          storage_path: storagePath,
          file_size_bytes: fileSize,
          fetched_at: new Date().toISOString(),
          parser_version: PARSER_VERSION,
          updated_at: new Date().toISOString(),
        };

        if (parseResult?.text) {
          // Store first 50K chars of parsed text (enough for evidence)
          updatePayload.parsed_text = parseResult.text.slice(0, 50000);
          updatePayload.parsed_pages = parseResult.pages;
          updatePayload.parsed_language = detectedLang;
          updatePayload.parsed_at = new Date().toISOString();
          updatePayload.parse_status = "parsed";
          // Store evidence snippet (first meaningful 500 chars)
          const cleanText = parseResult.text.replace(/--- PAGE \d+ ---\n/g, "").trim();
          updatePayload.evidence_snippet = cleanText.slice(0, 500);
        } else {
          updatePayload.parse_status = "parse_failed";
          updatePayload.parse_error = parseResult?.error || "unknown_error";
        }

        const { error: updateError } = await db
          .from("crawl_file_artifacts")
          .update(updatePayload)
          .eq("id", artifact.id);

        if (updateError) {
          console.error(`[ArtifactParse] ❌ DB update failed: ${updateError.message}`);
          artifactResult.db_update_ok = false;
        } else {
          artifactResult.db_update_ok = true;
        }

        artifactResult.status = updatePayload.parse_status;
        console.log(`[ArtifactParse] ✅ ${artifact.file_name}: ${updatePayload.parse_status} (${parseResult?.pages || 0} pages, ${fileSize} bytes)`);

      } catch (err: any) {
        console.error(`[ArtifactParse] ❌ Failed: ${artifact.file_name}: ${err.message}`);
        artifactResult.status = "failed";
        artifactResult.error = err.message;

        // Update artifact as failed
        await db
          .from("crawl_file_artifacts")
          .update({
            parse_status: "parse_failed",
            parse_error: err.message,
            parser_version: PARSER_VERSION,
            updated_at: new Date().toISOString(),
          })
          .eq("id", artifact.id);
      }

      results.push(artifactResult);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  } catch (err: any) {
    console.error(`[ArtifactParse] Fatal error: ${err.message}`);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
    );
  }
});
