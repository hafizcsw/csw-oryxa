import { computeProgramKey, enforceEvidenceGuard, type UnifiedProgram } from "../_shared/unifiedExtraction.ts";

export async function insertIngestError(supabase: any, payload: Record<string, unknown>) {
  const details = (payload.details_json ?? payload.details ?? {}) as Record<string, unknown>;
  await supabase.from("ingest_errors").insert({
    ...payload,
    details,
    details_json: details,
  });
}

export function sanitizeDbError(error: { message?: string; code?: string; details?: string } | null | undefined) {
  return {
    message: (error?.message || "unknown").slice(0, 500),
    code: error?.code || null,
    details: (error?.details || "").slice(0, 500),
  };
}

export function reasonForUniqueConflict(error: { message?: string | null; details?: string | null }) {
  const context = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  return context.includes("content_hash") ? "unique_conflict_content_hash" : "unique_conflict_fingerprint";
}

export async function recordRegexNoMatch(params: {
  supabase: any;
  sourceUrl: string;
  contentHash: string;
  mode: string;
  job_id?: string;
  batch_id?: string;
}) {
  const { supabase, sourceUrl, contentHash, mode, job_id, batch_id } = params;
  await insertIngestError(supabase, {
    pipeline: "uniranks_enrich",
    job_id,
    batch_id,
    entity_hint: "page",
    source_url: sourceUrl,
    content_hash: contentHash,
    stage: "extract",
    reason: "regex_no_match",
    details_json: { mode },
  });
}

export async function persistPrograms(params: {
  supabase: any;
  discovered: UnifiedProgram[];
  scrapeMarkdown: string;
  sourceUrl: string;
  university_id: string;
  slug: string;
  contentHash: string;
  job_id?: string;
  batch_id?: string;
}) {
  const { supabase, discovered, scrapeMarkdown, sourceUrl, university_id, slug, contentHash, job_id, batch_id } = params;
  let programsValid = 0;
  let programsSaved = 0;
  let programsRejected = 0;
  const rejectionReasons: Record<string, number> = {};

  for (const rawProgram of discovered) {
    if (!rawProgram.name?.trim()) {
      rejectionReasons.schema_invalid = (rejectionReasons.schema_invalid || 0) + 1;
      programsRejected += 1;
      await insertIngestError(supabase, {
        pipeline: "uniranks_enrich",
        job_id,
        batch_id,
        entity_hint: "program",
        source_url: sourceUrl,
        content_hash: contentHash,
        stage: "extract",
        reason: "schema_invalid",
        details_json: { rawProgram },
      });
      continue;
    }

    const checked = enforceEvidenceGuard(rawProgram, scrapeMarkdown);
    checked.rejections.forEach((r) => (rejectionReasons[r] = (rejectionReasons[r] || 0) + 1));
    for (const reason of checked.rejections) {
      await insertIngestError(supabase, {
        pipeline: "uniranks_enrich",
        job_id,
        batch_id,
        entity_hint: "program",
        source_url: sourceUrl,
        content_hash: contentHash,
        stage: "extract",
        reason: "evidence_not_found",
        details_json: { reason, program_name: rawProgram.name },
      });
    }

    programsValid++;
    const programKey = await computeProgramKey(sourceUrl, rawProgram.name, rawProgram.degree?.raw || rawProgram.degree?.level || null);
    const payload = {
      university_id,
      university_name: slug,
      title: rawProgram.name,
      degree_level: rawProgram.degree?.raw,
      source_url: sourceUrl,
      program_key: programKey,
      schema_version: "unified_v2",
      content_hash: contentHash,
      extracted_json: rawProgram,
      field_evidence_map: rawProgram.evidence || {},
      rejection_reasons: checked.rejections,
      last_extracted_at: new Date().toISOString(),
      status: "pending",
    };

    const { data: upserted, error } = await supabase
      .from("program_draft")
      .upsert(payload, { onConflict: "program_key" })
      .select("id");

    if (error) {
      const reason = error.code === "23505" ? reasonForUniqueConflict(error) : "db_error";
      rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
      programsRejected += 1;
      await insertIngestError(supabase, {
        pipeline: "uniranks_enrich",
        job_id,
        batch_id,
        entity_hint: "program",
        source_url: sourceUrl,
        fingerprint: programKey,
        content_hash: contentHash,
        stage: "upsert",
        reason,
        details_json: sanitizeDbError(error),
      });
      continue;
    }

    if (Array.isArray(upserted) && upserted.length === 1) {
      programsSaved += 1;
      continue;
    }

    rejectionReasons.db_error = (rejectionReasons.db_error || 0) + 1;
    programsRejected += 1;
    await insertIngestError(supabase, {
      pipeline: "uniranks_enrich",
      job_id,
      batch_id,
      entity_hint: "program",
      source_url: sourceUrl,
      fingerprint: programKey,
      content_hash: contentHash,
      stage: "upsert",
      reason: "db_error",
      details_json: { message: "upsert returned unexpected row count", row_count: Array.isArray(upserted) ? upserted.length : null },
    });
  }

  return { programsValid, programsSaved, programsRejected, rejectionReasons };
}
