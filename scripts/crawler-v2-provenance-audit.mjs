#!/usr/bin/env node

import { writeFileSync } from "node:fs";

const NO_WRITE_STATEMENT =
  "This provenance audit is diagnostic-only. It did not run crawler functions, queue mutations, Run All, country crawl, publish, ORX scoring, student eligibility, canonical writes, migrations, Edge Functions, workflows, scripts, external API calls, or language/i18n changes.";

const REQUIRED_TABLES = new Set([
  "crawler_runs",
  "crawler_run_items",
  "raw_pages",
  "crawler_page_candidates",
  "evidence_items",
  "crawler_telemetry",
]);

const HIGH_IMPACT_PATTERNS = [
  /tuition/i,
  /\bfees?\b/i,
  /deadline/i,
  /language/i,
  /ielts/i,
  /toefl/i,
  /pte/i,
  /duolingo/i,
  /admission/i,
  /requirement/i,
  /apply/i,
  /application/i,
  /scholarship/i,
  /accreditation/i,
  /career/i,
  /employment/i,
  /outcome/i,
  /orx/i,
  /eligibility/i,
];

const OPTIONAL_UNAVAILABLE = Object.freeze({ available: false, status: "WARN", count: null });

function parseArgs(argv) {
  const args = { runId: null, runItemId: null, format: "json", out: null, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--run-id") {
      args.runId = requireValue(arg, next);
      i += 1;
    } else if (arg.startsWith("--run-id=")) args.runId = arg.slice("--run-id=".length);
    else if (arg === "--run-item-id") {
      args.runItemId = requireValue(arg, next);
      i += 1;
    } else if (arg.startsWith("--run-item-id=")) args.runItemId = arg.slice("--run-item-id=".length);
    else if (arg === "--format") {
      args.format = requireValue(arg, next);
      i += 1;
    } else if (arg.startsWith("--format=")) args.format = arg.slice("--format=".length);
    else if (arg === "--out") {
      const value = argv[i + 1];
      if (value && !value.startsWith("--")) {
        args.out = value;
        i += 1;
      } else {
        args.out = "crawler-v2-provenance-audit-report.json";
      }
    } else if (arg.startsWith("--out=")) {
      args.out = arg.slice("--out=".length) || "crawler-v2-provenance-audit-report.json";
    } else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!["json", "markdown"].includes(args.format)) {
    throw new Error("--format must be json or markdown");
  }

  return args;
}

function requireValue(flag, value) {
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/crawler-v2-provenance-audit.mjs --run-item-id <uuid> [--format json|markdown] [--out [path]]",
    "  node scripts/crawler-v2-provenance-audit.mjs --run-id <uuid> --run-item-id <uuid> [--format json|markdown] [--out [path]]",
    "",
    "Required env:",
    "  SUPABASE_URL or VITE_SUPABASE_URL",
    "  SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY",
    "",
    "Safety:",
    "  SELECT-only Supabase REST reads. No Edge Functions, RPC, crawler stages, AI providers, publish paths, or DB writes.",
  ].join("\n");
}

function getEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, or VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return { url: url.replace(/\/$/, ""), key };
}

function headers(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    ...extra,
  };
}

function enc(value) {
  return encodeURIComponent(value);
}

function eq(column, value) {
  return `${column}=eq.${enc(value)}`;
}

function inList(column, values) {
  return `${column}=in.(${values.map(enc).join(",")})`;
}

function unavailable(reason, details = null) {
  return { ...OPTIONAL_UNAVAILABLE, reason, details };
}

class RestReader {
  constructor({ url, key }) {
    this.url = url;
    this.key = key;
  }

  async read(table, query, { required = true } = {}) {
    const path = query ? `${table}?${query}` : table;
    const res = await fetch(`${this.url}/rest/v1/${path}`, {
      method: "GET",
      headers: headers(this.key),
    });
    const parsed = await parseResponse(res);

    if (!res.ok) {
      if (!required || !REQUIRED_TABLES.has(table)) {
        return { ok: false, unavailable: unavailable(`Could not read ${table}`, safeDetails(parsed)) };
      }
      throw new Error(`Required table read failed for ${table}: HTTP ${res.status} ${JSON.stringify(safeDetails(parsed))}`);
    }

    return { ok: true, data: parsed };
  }

  async maybeSingle(table, query, { required = true } = {}) {
    const result = await this.read(table, query, { required });
    if (!result.ok) return result;
    if (!Array.isArray(result.data)) throw new Error(`Expected ${table} response to be an array`);
    if (result.data.length === 0) return { ok: true, data: null };
    if (result.data.length > 1) throw new Error(`Expected one ${table} row but received ${result.data.length}`);
    return { ok: true, data: result.data[0] };
  }

  async readAll(table, queryParts, { required = true, pageSize = 1000, maxRows = 5000 } = {}) {
    const rows = [];
    let from = 0;

    while (from < maxRows) {
      const to = Math.min(from + pageSize - 1, maxRows - 1);
      const query = queryParts.join("&");
      const res = await fetch(`${this.url}/rest/v1/${table}?${query}`, {
        method: "GET",
        headers: headers(this.key, { Range: `${from}-${to}` }),
      });
      const parsed = await parseResponse(res);

      if (!res.ok) {
        if (!required || !REQUIRED_TABLES.has(table)) {
          return { ok: false, rows, truncated: false, unavailable: unavailable(`Could not read ${table}`, safeDetails(parsed)) };
        }
        throw new Error(`Required table read failed for ${table}: HTTP ${res.status} ${JSON.stringify(safeDetails(parsed))}`);
      }

      if (!Array.isArray(parsed)) throw new Error(`Expected ${table} response to be an array`);
      rows.push(...parsed);
      if (parsed.length < pageSize) return { ok: true, rows, truncated: false };
      from += pageSize;
    }

    return { ok: true, rows, truncated: true };
  }
}

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function safeDetails(value) {
  if (!value || typeof value !== "object") return value;
  const clone = { ...value };
  for (const key of Object.keys(clone)) {
    if (/authorization|apikey|token|secret|key/i.test(key)) clone[key] = "[redacted]";
  }
  return clone;
}

async function resolveRunAndItem(reader, { runId, runItemId }) {
  if (!runId && !runItemId) throw new Error("Fail closed: provide --run-id and/or --run-item-id.");

  let item = null;
  if (runItemId) {
    const itemResult = await reader.maybeSingle(
      "crawler_run_items",
      [
        "select=id,run_id,university_id,website,target_domain,status,stage,progress_percent,failure_reason,failure_detail,trace_id,created_at,started_at,updated_at,completed_at,draft_count,orx_signal_count,evidence_count,evidence_verified_count,pages_found,pages_fetched,pages_rendered,retry_count",
        eq("id", runItemId),
      ].join("&"),
    );
    item = itemResult.data;
    if (!item) throw new Error(`Fail closed: no crawler_run_items row found for --run-item-id ${runItemId}`);
    if (runId && item.run_id !== runId) {
      throw new Error(`Fail closed: --run-id ${runId} does not match run_item.run_id ${item.run_id}`);
    }
    runId = item.run_id;
  }

  const runResult = await reader.maybeSingle(
    "crawler_runs",
    [
      "select=id,status,scope,mode,total_targets,trace_id,created_at,started_at,updated_at,completed_at",
      eq("id", runId),
    ].join("&"),
  );
  const run = runResult.data;
  if (!run) throw new Error(`Fail closed: no crawler_runs row found for --run-id ${runId}`);

  if (!item) {
    const items = await reader.read(
      "crawler_run_items",
      [
        "select=id,run_id,university_id,website,target_domain,status,stage,progress_percent,failure_reason,failure_detail,trace_id,created_at,started_at,updated_at,completed_at,draft_count,orx_signal_count,evidence_count,evidence_verified_count,pages_found,pages_fetched,pages_rendered,retry_count",
        eq("run_id", runId),
        "order=created_at.asc",
      ].join("&"),
    );
    if (!Array.isArray(items.data) || items.data.length === 0) {
      throw new Error(`Fail closed: no crawler_run_items rows found for --run-id ${runId}`);
    }
    if (items.data.length > 1) {
      throw new Error(
        `Fail closed: --run-id ${runId} has ${items.data.length} run items. Provide --run-item-id to avoid ambiguity.`,
      );
    }
    item = items.data[0];
  }

  return { run, item };
}

async function buildProvenanceAudit(reader, args) {
  const { run, item } = await resolveRunAndItem(reader, args);
  const runId = run.id;
  const runItemId = item.id;
  const universityId = item.university_id;

  const rawPages = await reader.readAll("raw_pages", [
    "select=id,url,status_code,content_type,fetched_at,body_sha256,fetch_error,needs_render",
    eq("university_id", universityId),
    "order=fetched_at.desc",
  ]);
  const pageCandidates = await reader.readAll("crawler_page_candidates", [
    "select=id,candidate_url,candidate_type,discovery_method,status,raw_page_id,fetch_error,trace_id,created_at,updated_at",
    eq("crawler_run_item_id", runItemId),
    "order=created_at.asc",
  ]);
  const evidenceItems = await reader.readAll("evidence_items", [
    "select=id,crawler_run_id,crawler_run_item_id,university_id,entity_type,entity_id,fact_group,field_key,value_raw,value_normalized,evidence_quote,source_url,source_domain,raw_page_id,artifact_id,content_hash,confidence_0_100,trust_level,extraction_method,model_provider,model_name,validation_status,review_status,publish_status,orx_layer,orx_signal_family,orx_evidence_id,trace_id,created_at,updated_at",
    eq("crawler_run_item_id", runItemId),
    "order=created_at.asc",
  ]);
  const telemetry = await reader.readAll("crawler_telemetry", [
    "select=stage,event_type,success,error_type,error_message,duration_ms,trace_id,timestamp",
    eq("run_item_id", runItemId),
    "order=timestamp.asc",
  ]);

  const rawRows = rawPages.rows || [];
  const candidateRows = pageCandidates.rows || [];
  const evidenceRows = evidenceItems.rows || [];
  const telemetryRows = telemetry.rows || [];
  const traceIds = uniqueCompact([
    run.trace_id,
    item.trace_id,
    ...rawRows.map((row) => row.trace_id),
    ...candidateRows.map((row) => row.trace_id),
    ...evidenceRows.map((row) => row.trace_id),
    ...telemetryRows.map((row) => row.trace_id),
  ]);

  const draftAudit = await readDraftAudit(reader, runId, runItemId, universityId, evidenceRows);
  const orxAudit = await readOrxAudit(reader, evidenceRows);
  const publishAudit = await readPublishAudit(reader, traceIds);
  const rawAudit = auditRawPages(rawRows, rawPages.truncated);
  const candidateAudit = auditPageCandidates(candidateRows, rawRows, pageCandidates.truncated);
  const evidenceAudit = auditEvidenceItems(evidenceRows, rawRows, evidenceItems.truncated);
  const highImpactAudit = auditHighImpactFields(evidenceRows);
  const traceabilitySummary = buildTraceabilitySummary(run, item, rawRows, candidateRows, evidenceRows, telemetryRows);
  const blockingIssues = collectBlockingIssues(rawAudit, candidateAudit, evidenceAudit, highImpactAudit, draftAudit, orxAudit, publishAudit);

  return {
    meta: {
      generated_at: new Date().toISOString(),
      report_type: "crawler_v2_provenance_audit",
      p0_item: "P0-3 Provenance model audit",
      read_only: true,
    },
    run_context: {
      run_id: runId,
      run_item_id: runItemId,
      university_id: universityId,
      website: item.website ?? null,
      target_domain: item.target_domain ?? null,
      run_status: run.status ?? null,
      item_status: item.status ?? null,
      item_stage: item.stage ?? null,
      item_progress: item.progress_percent ?? null,
      timestamps: {
        run_created_at: run.created_at ?? null,
        run_started_at: run.started_at ?? null,
        run_updated_at: run.updated_at ?? null,
        run_completed_at: run.completed_at ?? null,
        item_created_at: item.created_at ?? null,
        item_started_at: item.started_at ?? null,
        item_updated_at: item.updated_at ?? null,
        item_completed_at: item.completed_at ?? null,
      },
    },
    source_table_coverage: buildSourceTableCoverage({
      run,
      item,
      rawPages,
      pageCandidates,
      evidenceItems,
      telemetry,
      draftAudit,
      orxAudit,
      publishAudit,
    }),
    raw_pages_audit: rawAudit,
    page_candidates_audit: candidateAudit,
    evidence_items_audit: evidenceAudit,
    draft_audit: draftAudit,
    orx_audit: orxAudit,
    publish_audit: publishAudit,
    high_impact_field_audit: highImpactAudit,
    traceability_summary: traceabilitySummary,
    blocking_issues: blockingIssues,
    recommendations: recommendedNextSafeActions(blockingIssues, evidenceAudit, highImpactAudit),
    no_write_verification_statement: NO_WRITE_STATEMENT,
  };
}

async function readDraftAudit(reader, runId, runItemId, universityId, evidenceRows) {
  const v2Drafts = await Promise.all([
    readOptionalDraftTable(reader, "housing_draft", [
      "select=id,primary_evidence_id,trace_id,review_status,publish_status,created_at,updated_at",
      eq("crawler_run_item_id", runItemId),
      "order=created_at.asc",
    ]),
    readOptionalDraftTable(reader, "leadership_draft", [
      "select=id,primary_evidence_id,trace_id,review_status,publish_status,created_at,updated_at",
      eq("crawler_run_item_id", runItemId),
      "order=created_at.asc",
    ]),
    readOptionalDraftTable(reader, "media_draft", [
      "select=id,source_url,trace_id,confidence_0_100,review_status,publish_status,created_at,updated_at",
      eq("crawler_run_item_id", runItemId),
      "order=created_at.asc",
    ]),
  ]);

  const programDraft = await readOptionalDraftTable(reader, "program_draft", [
    "select=id,source_url,source_program_url,raw_page_id,field_evidence_map,confidence_score,final_confidence,content_hash,status,review_status,created_at",
    eq("university_id", universityId),
    "order=created_at.desc",
    "limit=100",
  ]);

  const sections = [...v2Drafts, programDraft];
  const availableRows = sections.flatMap((section) =>
    section.available ? section.rows.map((row) => ({ ...row, source_table: section.table })) : [],
  );
  const evidenceIds = new Set(evidenceRows.map((row) => row.id));
  const orphanRows = availableRows.filter((row) => {
    if (row.primary_evidence_id) return !evidenceIds.has(row.primary_evidence_id);
    if (row.source_table === "program_draft") return !hasAny(row.source_url, row.source_program_url, row.raw_page_id, row.field_evidence_map);
    if (row.source_table === "media_draft") return !hasAny(row.source_url);
    return true;
  });
  const missingSourceRows = availableRows.filter((row) => {
    if (row.source_table === "program_draft") return !hasAny(row.source_url, row.source_program_url);
    if (row.source_table === "media_draft") return !hasAny(row.source_url);
    return false;
  });
  const missingConfidenceRows = availableRows.filter((row) => {
    if (row.source_table === "program_draft") return !hasAny(row.confidence_score, row.final_confidence);
    if (row.source_table === "media_draft") return !hasAny(row.confidence_0_100);
    return false;
  });
  const unavailableSections = sections.filter((section) => !section.available);
  const status = availableRows.length === 0 ? "WARN" : orphanRows.length > 0 || missingSourceRows.length > 0 ? "FAIL" : unavailableSections.length > 0 ? "WARN" : "PASS";

  return {
    available: availableRows.length > 0,
    status,
    count: availableRows.length || null,
    sections: sections.map((section) => summarizeOptionalSection(section)),
    orphan_draft_indicators: sampleRows(orphanRows),
    draft_without_source: sampleRows(missingSourceRows),
    draft_without_confidence: sampleRows(missingConfidenceRows),
    unavailable_sections: unavailableSections.map((section) => ({ table: section.table, reason: section.reason, details: section.details })),
  };
}

async function readOptionalDraftTable(reader, table, queryParts) {
  const result = await reader.readAll(table, queryParts, { required: false, maxRows: 1000 });
  if (!result.ok) return { table, available: false, status: "WARN", rows: [], reason: result.unavailable?.reason, details: result.unavailable?.details };
  return { table, available: true, status: "PASS", rows: result.rows || [], truncated: result.truncated };
}

async function readOrxAudit(reader, evidenceRows) {
  const mappedEvidence = evidenceRows.filter((row) => hasAny(row.orx_layer, row.orx_signal_family, row.orx_evidence_id));
  const orxEvidenceIds = uniqueCompact(evidenceRows.map((row) => row.orx_evidence_id));
  let orxRowsResult = { ok: false, rows: [], truncated: false, unavailable: unavailable("No evidence_items rows reference orx_evidence_id") };

  if (orxEvidenceIds.length > 0) {
    orxRowsResult = await reader.readAll(
      "orx_evidence",
      [
        "select=id,entity_type,entity_id,layer,signal_family,source_type,source_url,snippet,content_hash,observed_at,extraction_confidence,evidence_status,conflict_group_id",
        inList("id", orxEvidenceIds),
        "order=created_at.asc",
      ],
      { required: false, maxRows: 1000 },
    );
  }

  const orxRows = orxRowsResult.rows || [];
  const missingSource = mappedEvidence.filter((row) => !hasAny(row.source_url));
  const missingQuote = mappedEvidence.filter((row) => !hasAny(row.evidence_quote, row.value_raw));
  const missingSignal = mappedEvidence.filter((row) => !hasAny(row.orx_layer, row.orx_signal_family));
  const missingConfidence = mappedEvidence.filter((row) => !hasAny(row.confidence_0_100));
  const conflictRows = [...mappedEvidence.filter((row) => row.validation_status === "needs_review"), ...orxRows.filter((row) => row.conflict_group_id)];
  const status =
    mappedEvidence.length === 0 && orxRows.length === 0
      ? "WARN"
      : missingSource.length > 0 || missingQuote.length > 0 || missingSignal.length > 0 || missingConfidence.length > 0
        ? "FAIL"
        : conflictRows.length > 0
          ? "WARN"
          : "PASS";

  return {
    available: mappedEvidence.length > 0 || orxRowsResult.ok,
    status,
    count: mappedEvidence.length + orxRows.length,
    evidence_items_with_orx_mapping: mappedEvidence.length,
    orx_evidence_rows_available: orxRowsResult.ok,
    orx_evidence_rows_count: orxRows.length,
    orx_evidence_unavailable_reason: orxRowsResult.ok ? null : orxRowsResult.unavailable?.reason,
    missing_source_url_count: missingSource.length,
    missing_quote_or_snippet_count: missingQuote.length,
    missing_signal_category_count: missingSignal.length,
    missing_confidence_count: missingConfidence.length,
    conflict_candidates: sampleRows(conflictRows),
  };
}

async function readPublishAudit(reader, traceIds) {
  if (traceIds.length === 0) {
    return { available: false, status: "WARN", count: null, reason: "No trace ids available for publish_audit_trail lookup" };
  }

  const result = await reader.readAll(
    "publish_audit_trail",
    [
      "select=id,entity_type,entity_uuid,entity_text_id,evidence_item_ids,action,confidence_min,confidence_avg,trace_id,published_at",
      inList("trace_id", traceIds),
      "order=published_at.desc",
    ],
    { required: false, maxRows: 1000 },
  );

  if (!result.ok) {
    return { available: false, status: "WARN", count: null, reason: result.unavailable?.reason, details: result.unavailable?.details };
  }

  const rows = result.rows || [];
  const missingEvidenceIds = rows.filter((row) => !Array.isArray(row.evidence_item_ids) || row.evidence_item_ids.length === 0);
  const missingConfidence = rows.filter((row) => !hasAny(row.confidence_min, row.confidence_avg));
  return {
    available: true,
    status: missingEvidenceIds.length > 0 ? "FAIL" : missingConfidence.length > 0 ? "WARN" : "PASS",
    count: rows.length,
    missing_evidence_item_ids_count: missingEvidenceIds.length,
    missing_confidence_count: missingConfidence.length,
    actions: countBy(rows, "action"),
    sample_rows: sampleRows(rows),
    truncated: result.truncated,
  };
}

function auditRawPages(rows, truncated) {
  const missingUrl = rows.filter((row) => !hasAny(row.url));
  const missingTimestamp = rows.filter((row) => !hasAny(row.fetched_at));
  const missingHash = rows.filter((row) => !hasAny(row.body_sha256));
  const failedFetches = rows.filter((row) => hasAny(row.fetch_error) || Number(row.status_code || 0) >= 400);
  const status =
    rows.length === 0 ? "FAIL" : missingUrl.length > 0 || missingTimestamp.length > 0 ? "FAIL" : missingHash.length > 0 ? "WARN" : "PASS";

  return {
    status,
    count: rows.length,
    missing_source_url_count: missingUrl.length,
    missing_fetched_timestamp_count: missingTimestamp.length,
    missing_content_hash_count: missingHash.length,
    failed_fetch_count: failedFetches.length,
    latest_rows_summary: rows.slice(0, 10).map((row) => ({
      id: row.id,
      url: row.url,
      status_code: row.status_code,
      content_type: row.content_type,
      fetched_at: row.fetched_at,
      body_sha256_present: hasAny(row.body_sha256),
      fetch_error: row.fetch_error,
      needs_render: row.needs_render,
    })),
    truncated,
  };
}

function auditPageCandidates(rows, rawRows, truncated) {
  const rawIds = new Set(rawRows.map((row) => row.id));
  const missingUrl = rows.filter((row) => !hasAny(row.candidate_url));
  const missingTrace = rows.filter((row) => !hasAny(row.trace_id));
  const fetchedWithoutRawPage = rows.filter((row) => ["fetched", "extracted"].includes(row.status) && !hasAny(row.raw_page_id));
  const linkedToMissingRawPage = rows.filter((row) => hasAny(row.raw_page_id) && !rawIds.has(row.raw_page_id));
  const status =
    rows.length === 0
      ? "FAIL"
      : missingUrl.length > 0 || fetchedWithoutRawPage.length > 0 || linkedToMissingRawPage.length > 0
        ? "FAIL"
        : missingTrace.length > 0
          ? "WARN"
          : "PASS";

  return {
    status,
    count: rows.length,
    by_status: countBy(rows, "status"),
    by_candidate_type: countBy(rows, "candidate_type"),
    by_discovery_method: countBy(rows, "discovery_method"),
    missing_candidate_url_count: missingUrl.length,
    missing_trace_id_count: missingTrace.length,
    fetched_without_raw_page_id_count: fetchedWithoutRawPage.length,
    linked_to_missing_raw_page_count: linkedToMissingRawPage.length,
    orphan_candidate_indicators: sampleRows([...fetchedWithoutRawPage, ...linkedToMissingRawPage]),
    truncated,
  };
}

function auditEvidenceItems(rows, rawRows, truncated) {
  const rawIds = new Set(rawRows.map((row) => row.id));
  const missingSource = rows.filter((row) => !hasAny(row.source_url));
  const missingQuote = rows.filter((row) => !hasAny(row.evidence_quote, row.value_raw));
  const missingSourcePageLink = rows.filter((row) => !hasAny(row.raw_page_id, row.source_url));
  const missingExtractionMethod = rows.filter((row) => !hasAny(row.extraction_method));
  const missingConfidence = rows.filter((row) => !hasAny(row.confidence_0_100));
  const lowConfidence = rows.filter((row) => hasAny(row.confidence_0_100) && Number(row.confidence_0_100) < 70);
  const missingTrace = rows.filter((row) => !hasAny(row.trace_id));
  const missingTimestamp = rows.filter((row) => !hasAny(row.created_at, row.updated_at));
  const missingContentHash = rows.filter((row) => !hasAny(row.content_hash));
  const aiMissingModel = rows.filter((row) => isAiEvidence(row) && (!hasAny(row.model_provider) || !hasAny(row.model_name)));
  const rawPageMissing = rows.filter((row) => hasAny(row.raw_page_id) && !rawIds.has(row.raw_page_id));
  const orphanEvidence = rows.filter((row) => !hasAny(row.source_url) && !hasAny(row.raw_page_id) && !hasAny(row.artifact_id));
  const conflictCandidates = rows.filter((row) =>
    ["needs_review", "invalid"].includes(row.validation_status) ||
    ["needs_revision", "rejected"].includes(row.review_status) ||
    row.entity_match_status === "ambiguous",
  );
  const requiredFailureCount =
    missingSource.length +
    missingQuote.length +
    missingExtractionMethod.length +
    missingConfidence.length +
    missingTrace.length +
    rawPageMissing.length +
    orphanEvidence.length +
    aiMissingModel.length;
  const status = rows.length === 0 ? "FAIL" : requiredFailureCount > 0 ? "FAIL" : lowConfidence.length > 0 || missingContentHash.length > 0 ? "WARN" : "PASS";

  return {
    status,
    count: rows.length,
    by_entity_type: countBy(rows, "entity_type"),
    by_fact_group: countBy(rows, "fact_group"),
    by_extraction_method: countBy(rows, "extraction_method"),
    by_review_status: countBy(rows, "review_status"),
    by_publish_status: countBy(rows, "publish_status"),
    evidence_without_source_url: sampleRows(missingSource),
    evidence_without_quote_or_snippet: sampleRows(missingQuote),
    evidence_without_raw_page_or_source_link: sampleRows(missingSourcePageLink),
    evidence_without_extraction_method: sampleRows(missingExtractionMethod),
    ai_evidence_without_model_provider: sampleRows(aiMissingModel),
    confidence_missing_or_low_summary: {
      missing_confidence_count: missingConfidence.length,
      low_confidence_count: lowConfidence.length,
      low_confidence_threshold_0_100: 70,
      low_confidence_sample: sampleRows(lowConfidence),
    },
    trace_id_coverage: coverage(rows, (row) => row.trace_id),
    timestamp_coverage: coverage(rows, (row) => row.created_at || row.updated_at),
    content_hash_coverage: coverage(rows, (row) => row.content_hash),
    missing_raw_page_reference_count: rows.filter((row) => !hasAny(row.raw_page_id)).length,
    linked_to_missing_raw_page_count: rawPageMissing.length,
    orphan_evidence_indicators: sampleRows(orphanEvidence),
    conflict_candidates: sampleRows(conflictCandidates),
    truncated,
  };
}

function auditHighImpactFields(rows) {
  const highImpactRows = rows.filter(isHighImpactEvidence);
  const incomplete = highImpactRows.filter((row) => {
    const missingBase = !hasAny(row.source_url) || !hasAny(row.evidence_quote, row.value_raw) || !hasAny(row.extraction_method);
    const missingConfidence = !hasAny(row.confidence_0_100) || Number(row.confidence_0_100) < 70;
    const missingAi = isAiEvidence(row) && (!hasAny(row.model_provider) || !hasAny(row.model_name));
    return missingBase || missingConfidence || missingAi;
  });

  return {
    status: incomplete.length > 0 ? "FAIL" : highImpactRows.length > 0 ? "PASS" : "WARN",
    high_impact_fields_count: highImpactRows.length,
    high_impact_fields_missing_provenance_count: incomplete.length,
    high_impact_fields_missing_provenance: sampleRows(incomplete),
    rules: [
      "tuition",
      "fees",
      "deadlines",
      "language requirements",
      "admission requirements",
      "apply URL",
      "scholarships",
      "accreditation",
      "career outcomes",
      "ORX score-impacting signals",
      "student eligibility-impacting requirements",
    ],
  };
}

function buildTraceabilitySummary(run, item, rawRows, candidateRows, evidenceRows, telemetryRows) {
  const traceValues = [
    { source: "crawler_runs", value: run.trace_id },
    { source: "crawler_run_items", value: item.trace_id },
    ...candidateRows.map((row) => ({ source: "crawler_page_candidates", value: row.trace_id })),
    ...evidenceRows.map((row) => ({ source: "evidence_items", value: row.trace_id })),
    ...telemetryRows.map((row) => ({ source: "crawler_telemetry", value: row.trace_id })),
  ];
  const timestamps = [
    ...rawRows.map((row) => row.fetched_at),
    ...candidateRows.flatMap((row) => [row.created_at, row.updated_at]),
    ...evidenceRows.flatMap((row) => [row.created_at, row.updated_at]),
    ...telemetryRows.map((row) => row.timestamp),
  ];
  const contentHashes = [...rawRows.map((row) => row.body_sha256), ...evidenceRows.map((row) => row.content_hash)];

  return {
    status: traceValues.every((row) => hasAny(row.value)) ? "PASS" : "WARN",
    trace_id_list: uniqueCompact(traceValues.map((row) => row.value)),
    trace_id_coverage: coverage(traceValues, (row) => row.value),
    timestamp_coverage: coverage(timestamps, (value) => value),
    content_hash_coverage: coverage(contentHashes, (value) => value),
  };
}

function buildSourceTableCoverage({ run, item, rawPages, pageCandidates, evidenceItems, telemetry, draftAudit, orxAudit, publishAudit }) {
  return {
    required: [
      { table: "crawler_runs", available: true, status: run?.id ? "PASS" : "FAIL", count: run?.id ? 1 : 0, truncated: false },
      { table: "crawler_run_items", available: true, status: item?.id ? "PASS" : "FAIL", count: item?.id ? 1 : 0, truncated: false },
      tableCoverage("raw_pages", rawPages, rawPages.rows?.length),
      tableCoverage("crawler_page_candidates", pageCandidates, pageCandidates.rows?.length),
      tableCoverage("evidence_items", evidenceItems, evidenceItems.rows?.length),
      tableCoverage("crawler_telemetry", telemetry, telemetry.rows?.length),
    ],
    optional: [
      { table: "draft_tables", available: draftAudit.available, status: draftAudit.status, count: draftAudit.count, sections: draftAudit.sections },
      { table: "orx_evidence_or_mapping", available: orxAudit.available, status: orxAudit.status, count: orxAudit.count },
      { table: "publish_audit_trail", available: publishAudit.available, status: publishAudit.status, count: publishAudit.count, reason: publishAudit.reason || null },
    ],
  };
}

function tableCoverage(table, result, count) {
  return {
    table,
    available: result.ok !== false,
    status: result.ok === false ? "FAIL" : Number(count || 0) === 0 ? "FAIL" : "PASS",
    count: count ?? null,
    truncated: Boolean(result.truncated),
  };
}

function collectBlockingIssues(...sections) {
  const issues = [];
  for (const section of sections) {
    if (!section || section.status !== "FAIL") continue;
    const label = sectionLabel(section);
    issues.push({ section: label, status: section.status, reason: failReason(section) });
  }
  return issues;
}

function sectionLabel(section) {
  if ("latest_rows_summary" in section) return "raw_pages_audit";
  if ("orphan_candidate_indicators" in section) return "page_candidates_audit";
  if ("evidence_without_source_url" in section) return "evidence_items_audit";
  if ("high_impact_fields_missing_provenance" in section) return "high_impact_field_audit";
  if ("orphan_draft_indicators" in section) return "draft_audit";
  if ("evidence_items_with_orx_mapping" in section) return "orx_audit";
  if ("missing_evidence_item_ids_count" in section) return "publish_audit";
  return "unknown";
}

function failReason(section) {
  if ("count" in section && section.count === 0) return "No rows available; cannot verify provenance.";
  if (section.missing_source_url_count) return "Rows missing source URL.";
  if (section.missing_quote_or_snippet_count) return "Rows missing evidence quote or snippet.";
  if (section.high_impact_fields_missing_provenance_count) return "High-impact rows have incomplete provenance.";
  if (section.orphan_evidence_indicators?.length) return "Orphan evidence detected.";
  if (section.orphan_draft_indicators?.length) return "Orphan draft detected.";
  if (section.missing_evidence_item_ids_count) return "Publish audit lacks evidence item ids.";
  return "Required provenance rule failed.";
}

function recommendedNextSafeActions(blockingIssues, evidenceAudit, highImpactAudit) {
  if (blockingIssues.length > 0) {
    return [
      "Keep review, ORX, student evaluation, CRM, public pages, and publish blocked.",
      "Fix or manually review the listed provenance gaps using read-only evidence first.",
      "Regenerate an Evidence Pack after the underlying run evidence is corrected or rerun safely later.",
    ];
  }
  if (evidenceAudit.status === "WARN" || highImpactAudit.status === "WARN") {
    return [
      "Proceed only to no-write review preparation.",
      "Treat unavailable optional sections as not production-ready.",
      "Keep ORX scoring, student eligibility, CRM, public surfaces, and publish blocked.",
    ];
  }
  return [
    "Evidence provenance is reviewable for internal no-write review.",
    "Do not publish or score; original runtime gates 1E/4/5/6 still control promotion.",
  ];
}

function summarizeOptionalSection(section) {
  return {
    table: section.table,
    available: section.available,
    status: section.status,
    count: section.available ? section.rows.length : null,
    reason: section.reason || null,
    truncated: Boolean(section.truncated),
  };
}

function isAiEvidence(row) {
  return row.extraction_method === "ai_extraction" || hasAny(row.model_provider, row.model_name);
}

function isHighImpactEvidence(row) {
  const haystack = `${row.fact_group || ""} ${row.field_key || ""} ${row.orx_layer || ""} ${row.orx_signal_family || ""}`;
  return HIGH_IMPACT_PATTERNS.some((pattern) => pattern.test(haystack));
}

function hasAny(...values) {
  return values.some((value) => value !== null && value !== undefined && value !== "");
}

function coverage(rows, getter) {
  const total = rows.length;
  const present = rows.filter((row) => hasAny(getter(row))).length;
  return {
    total,
    present,
    missing: total - present,
    percent: total === 0 ? null : Number((present / total).toFixed(4)),
  };
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] ?? "unavailable";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function uniqueCompact(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))];
}

function sampleRows(rows, limit = 20) {
  return rows.slice(0, limit).map((row) => ({
    id: row.id,
    table: row.source_table || undefined,
    field: row.field_key || row.field || undefined,
    fact_group: row.fact_group || undefined,
    entity_type: row.entity_type || undefined,
    source_url: row.source_url || row.source_program_url || undefined,
    raw_page_id: row.raw_page_id || undefined,
    trace_id: row.trace_id || undefined,
    confidence: row.confidence_0_100 ?? row.confidence_score ?? row.final_confidence ?? undefined,
    review_status: row.review_status || undefined,
    publish_status: row.publish_status || undefined,
  }));
}

function toMarkdown(report) {
  const lines = [
    "# Crawler v2 Provenance Audit",
    "",
    `Generated at: ${report.meta.generated_at}`,
    "",
    "## Run Context",
    "",
    `- run_id: ${report.run_context.run_id}`,
    `- run_item_id: ${report.run_context.run_item_id}`,
    `- university_id: ${report.run_context.university_id}`,
    `- website: ${report.run_context.website ?? "unavailable"}`,
    `- target_domain: ${report.run_context.target_domain ?? "unavailable"}`,
    `- run_status: ${report.run_context.run_status ?? "unavailable"}`,
    `- item_status: ${report.run_context.item_status ?? "unavailable"}`,
    `- item_stage: ${report.run_context.item_stage ?? "unavailable"}`,
    `- item_progress: ${report.run_context.item_progress ?? "unavailable"}`,
    "",
    "## Section Status",
    "",
    "| Section | Status | Count |",
    "|---|---|---:|",
    `| raw_pages | ${report.raw_pages_audit.status} | ${report.raw_pages_audit.count} |`,
    `| crawler_page_candidates | ${report.page_candidates_audit.status} | ${report.page_candidates_audit.count} |`,
    `| evidence_items | ${report.evidence_items_audit.status} | ${report.evidence_items_audit.count} |`,
    `| draft | ${report.draft_audit.status} | ${report.draft_audit.count ?? "unavailable"} |`,
    `| ORX | ${report.orx_audit.status} | ${report.orx_audit.count ?? "unavailable"} |`,
    `| publish_audit | ${report.publish_audit.status} | ${report.publish_audit.count ?? "unavailable"} |`,
    `| high_impact_fields | ${report.high_impact_field_audit.status} | ${report.high_impact_field_audit.high_impact_fields_count} |`,
    "",
    "## Blocking Issues",
    "",
    "```json",
    JSON.stringify(report.blocking_issues, null, 2),
    "```",
    "",
    "## Evidence Audit",
    "",
    "```json",
    JSON.stringify(report.evidence_items_audit, null, 2),
    "```",
    "",
    "## High-impact Field Audit",
    "",
    "```json",
    JSON.stringify(report.high_impact_field_audit, null, 2),
    "```",
    "",
    "## Recommendations",
    "",
    ...report.recommendations.map((item) => `- ${item}`),
    "",
    "## No-write Verification",
    "",
    report.no_write_verification_statement,
  ];
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.runId && !args.runItemId) {
    throw new Error("Fail closed: provide --run-id and/or --run-item-id.");
  }

  const env = getEnv();
  const reader = new RestReader(env);
  const report = await buildProvenanceAudit(reader, args);

  if (args.out) {
    writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  if (args.format === "markdown") {
    process.stdout.write(toMarkdown(report));
  } else {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
