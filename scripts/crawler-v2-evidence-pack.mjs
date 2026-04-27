#!/usr/bin/env node

const NO_WRITE_STATEMENT =
  "This evidence pack is diagnostic-only. It did not run crawler functions, Run All, country crawl, publish, ORX scoring, student eligibility, canonical writes, migrations, Edge Functions, workflows, scripts, external API calls, or language/i18n changes.";

const REQUIRED_TABLES = new Set([
  "crawler_runs",
  "crawler_run_items",
  "raw_pages",
  "crawler_page_candidates",
  "evidence_items",
  "crawler_telemetry",
]);

const OPTIONAL_UNAVAILABLE = Object.freeze({
  available: false,
  count: null,
  reason: "unavailable",
});

function parseArgs(argv) {
  const args = {
    runId: null,
    runItemId: null,
    format: "json",
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--run-id") {
      args.runId = requireValue(arg, next);
      i += 1;
    } else if (arg.startsWith("--run-id=")) {
      args.runId = arg.slice("--run-id=".length);
    } else if (arg === "--run-item-id") {
      args.runItemId = requireValue(arg, next);
      i += 1;
    } else if (arg.startsWith("--run-item-id=")) {
      args.runItemId = arg.slice("--run-item-id=".length);
    } else if (arg === "--format") {
      args.format = requireValue(arg, next);
      i += 1;
    } else if (arg.startsWith("--format=")) {
      args.format = arg.slice("--format=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!["json", "markdown"].includes(args.format)) {
    throw new Error("--format must be json or markdown");
  }

  return args;
}

function requireValue(flag, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/crawler-v2-evidence-pack.mjs --run-item-id <uuid> [--format json|markdown]",
    "  node scripts/crawler-v2-evidence-pack.mjs --run-id <uuid> --run-item-id <uuid> [--format json|markdown]",
    "",
    "Required env:",
    "  SUPABASE_URL",
    "  SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY",
    "",
    "Safety:",
    "  This script performs SELECT-only REST reads. It does not call Edge Functions, crawler stages, AI providers, or publish paths.",
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
        return { ok: false, unavailable: unavailable(`Could not read ${table}`, parsed) };
      }
      throw new Error(`Required table read failed for ${table}: HTTP ${res.status} ${JSON.stringify(parsed)}`);
    }

    return { ok: true, data: parsed };
  }

  async maybeSingle(table, query, { required = true } = {}) {
    const result = await this.read(table, query, { required });
    if (!result.ok) return result;
    if (!Array.isArray(result.data)) {
      throw new Error(`Expected ${table} response to be an array`);
    }
    if (result.data.length === 0) return { ok: true, data: null };
    if (result.data.length > 1) {
      throw new Error(`Expected one ${table} row but received ${result.data.length}`);
    }
    return { ok: true, data: result.data[0] };
  }

  async count(table, filters = [], { required = true } = {}) {
    const query = ["select=id", ...filters].join("&");
    const res = await fetch(`${this.url}/rest/v1/${table}?${query}`, {
      method: "GET",
      headers: headers(this.key, { Prefer: "count=exact", Range: "0-0" }),
    });
    const parsed = await parseResponse(res);

    if (!res.ok) {
      if (!required || !REQUIRED_TABLES.has(table)) {
        return unavailable(`Could not count ${table}`, parsed);
      }
      throw new Error(`Required table count failed for ${table}: HTTP ${res.status} ${JSON.stringify(parsed)}`);
    }

    return { available: true, count: parseContentRangeCount(res.headers.get("content-range")) };
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
          return { ok: false, unavailable: unavailable(`Could not read ${table}`, parsed), rows, truncated: false };
        }
        throw new Error(`Required table read failed for ${table}: HTTP ${res.status} ${JSON.stringify(parsed)}`);
      }

      if (!Array.isArray(parsed)) {
        throw new Error(`Expected ${table} response to be an array`);
      }

      rows.push(...parsed);
      if (parsed.length < pageSize) {
        return { ok: true, rows, truncated: false };
      }
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

function parseContentRangeCount(value) {
  if (!value || !value.includes("/")) return null;
  const count = value.split("/").pop();
  if (count === "*") return null;
  const n = Number(count);
  return Number.isFinite(n) ? n : null;
}

async function resolveRunAndItem(reader, { runId, runItemId }) {
  if (!runId && !runItemId) {
    throw new Error("Fail closed: provide --run-id and/or --run-item-id.");
  }

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

async function buildEvidencePack(reader, args) {
  const { run, item } = await resolveRunAndItem(reader, args);
  const runId = run.id;
  const runItemId = item.id;
  const universityId = item.university_id;

  const rawPagesCount = await reader.count("raw_pages", [eq("university_id", universityId)]);
  const rawLatest = await reader.read(
    "raw_pages",
    [
      "select=id,url,status_code,content_type,fetched_at,body_sha256,fetch_error,needs_render",
      eq("university_id", universityId),
      "order=fetched_at.desc",
      "limit=5",
    ].join("&"),
  );

  const candidatesCount = await reader.count("crawler_page_candidates", [eq("crawler_run_item_id", runItemId)]);
  const candidates = await reader.readAll("crawler_page_candidates", [
    "select=id,candidate_type,discovery_method,status,trace_id,created_at,updated_at",
    eq("crawler_run_item_id", runItemId),
    "order=created_at.asc",
  ]);

  const evidenceCount = await reader.count("evidence_items", [eq("crawler_run_item_id", runItemId)]);
  const evidenceItems = await reader.readAll("evidence_items", [
    "select=id,extraction_method,model_provider,model_name,trace_id,field_key,entity_type,review_status,publish_status,created_at,updated_at",
    eq("crawler_run_item_id", runItemId),
    "order=created_at.asc",
  ]);

  const telemetry = await reader.readAll("crawler_telemetry", [
    "select=stage,event_type,success,error_type,error_message,duration_ms,trace_id,timestamp",
    eq("run_item_id", runItemId),
    "order=timestamp.asc",
  ]);

  const telemetryRows = telemetry.rows || [];
  const candidateRows = candidates.rows || [];
  const evidenceRows = evidenceItems.rows || [];

  const errors = [
    ...telemetryRows
      .filter((row) => row.success === false || row.error_type || row.error_message)
      .map((row) => ({
        source: "crawler_telemetry",
        stage: row.stage,
        event_type: row.event_type,
        error_type: row.error_type,
        error_message: row.error_message,
        trace_id: row.trace_id,
        timestamp: row.timestamp,
      })),
    ...(item.failure_reason || item.failure_detail
      ? [
          {
            source: "crawler_run_items",
            failure_reason: item.failure_reason,
            failure_detail: item.failure_detail,
            trace_id: item.trace_id,
            updated_at: item.updated_at,
          },
        ]
      : []),
  ];

  const traceIds = uniqueCompact([
    run.trace_id,
    item.trace_id,
    ...telemetryRows.map((row) => row.trace_id),
    ...candidateRows.map((row) => row.trace_id),
    ...evidenceRows.map((row) => row.trace_id),
  ]);

  const draftCount = await sumOptionalCounts(reader, [
    { table: "media_draft", filters: [eq("crawler_run_item_id", runItemId)] },
    { table: "housing_draft", filters: [eq("crawler_run_item_id", runItemId)] },
    { table: "leadership_draft", filters: [eq("crawler_run_item_id", runItemId)] },
  ]);
  const orxOutputCount = await reader.count(
    "evidence_items",
    [eq("crawler_run_item_id", runItemId), "orx_evidence_id=not.is.null"],
    { required: false },
  );
  const publishAuditCount =
    traceIds.length > 0
      ? await reader.count("publish_audit_trail", [inList("trace_id", traceIds)], { required: false })
      : unavailable("No trace ids available for publish audit count");

  return {
    generated_at: new Date().toISOString(),
    run_id: runId,
    run_item_id: runItemId,
    university_id: universityId,
    website: item.website ?? null,
    target_domain: item.target_domain ?? null,
    run_status: run.status ?? null,
    item_status: item.status ?? null,
    item_stage: item.stage ?? null,
    item_progress: item.progress_percent ?? null,
    raw_pages_count: rawPagesCount.count,
    raw_pages_latest_rows_summary: summarizeRawPages(rawLatest.data || []),
    crawler_page_candidates_count: candidatesCount.count,
    crawler_page_candidates_breakdown: {
      by_candidate_type: countBy(candidateRows, "candidate_type"),
      by_status: countBy(candidateRows, "status"),
      by_discovery_method: countBy(candidateRows, "discovery_method"),
      truncated: candidates.truncated,
    },
    evidence_items_count: evidenceCount.count,
    evidence_items_method_breakdown: {
      ...countBy(evidenceRows, "extraction_method"),
      truncated: evidenceItems.truncated,
    },
    evidence_items_model_breakdown: {
      by_provider: countBy(evidenceRows, "model_provider"),
      by_model: countBy(evidenceRows, "model_name"),
      truncated: evidenceItems.truncated,
    },
    crawler_telemetry_timeline: summarizeTelemetry(telemetryRows, telemetry.truncated),
    errors,
    failure_reason: item.failure_reason ?? null,
    failure_detail: item.failure_detail ?? null,
    trace_id_list: traceIds,
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
    draft_count: normalizeCountResult(draftCount),
    orx_output_count: normalizeCountResult(orxOutputCount),
    publish_audit_count: normalizeCountResult(publishAuditCount),
    no_write_verification_statement: NO_WRITE_STATEMENT,
  };
}

async function sumOptionalCounts(reader, candidates) {
  const parts = [];
  const unavailableParts = [];
  for (const candidate of candidates) {
    const result = await reader.count(candidate.table, candidate.filters, { required: false });
    if (result.available) {
      parts.push({ table: candidate.table, count: result.count });
    } else {
      unavailableParts.push({ table: candidate.table, reason: result.reason, details: result.details });
    }
  }

  if (parts.length === 0) {
    return unavailable("No optional draft tables were available", unavailableParts);
  }

  return {
    available: true,
    count: parts.reduce((sum, part) => sum + (part.count || 0), 0),
    source: parts.map((part) => part.table).join("+"),
    partial: unavailableParts.length > 0,
    unavailable_parts: unavailableParts,
  };
}

function normalizeCountResult(result) {
  if (!result?.available) {
    return {
      available: false,
      count: null,
      reason: result?.reason || "unavailable",
      details: result?.details || null,
    };
  }
  return {
    available: true,
    count: result.count,
    source: result.source || null,
    partial: result.partial || false,
    unavailable_parts: result.unavailable_parts || [],
  };
}

function summarizeRawPages(rows) {
  return rows.map((row) => ({
    id: row.id,
    url: row.url,
    status_code: row.status_code,
    content_type: row.content_type,
    fetched_at: row.fetched_at,
    body_sha256: row.body_sha256,
    fetch_error: row.fetch_error,
    needs_render: row.needs_render,
  }));
}

function summarizeTelemetry(rows, truncated) {
  return {
    truncated,
    events: rows.map((row) => ({
      timestamp: row.timestamp,
      stage: row.stage,
      event_type: row.event_type,
      success: row.success,
      duration_ms: row.duration_ms,
      error_type: row.error_type,
      error_message: row.error_message,
      trace_id: row.trace_id,
    })),
  };
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const label = row[key] ?? "unavailable";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

function uniqueCompact(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))];
}

function toMarkdown(pack) {
  const lines = [
    "# Crawler v2 Evidence Pack",
    "",
    `Generated at: ${pack.generated_at}`,
    "",
    "## Run",
    "",
    `- run_id: ${pack.run_id}`,
    `- run_item_id: ${pack.run_item_id}`,
    `- university_id: ${pack.university_id}`,
    `- website: ${pack.website ?? "unavailable"}`,
    `- target_domain: ${pack.target_domain ?? "unavailable"}`,
    `- run_status: ${pack.run_status ?? "unavailable"}`,
    `- item_status: ${pack.item_status ?? "unavailable"}`,
    `- item_stage: ${pack.item_stage ?? "unavailable"}`,
    `- item_progress: ${pack.item_progress ?? "unavailable"}`,
    "",
    "## Counts",
    "",
    `- raw_pages_count: ${formatCount(pack.raw_pages_count)}`,
    `- crawler_page_candidates_count: ${formatCount(pack.crawler_page_candidates_count)}`,
    `- evidence_items_count: ${formatCount(pack.evidence_items_count)}`,
    `- draft_count: ${formatCountObject(pack.draft_count)}`,
    `- orx_output_count: ${formatCountObject(pack.orx_output_count)}`,
    `- publish_audit_count: ${formatCountObject(pack.publish_audit_count)}`,
    "",
    "## Breakdowns",
    "",
    "```json",
    JSON.stringify(
      {
        crawler_page_candidates_breakdown: pack.crawler_page_candidates_breakdown,
        evidence_items_method_breakdown: pack.evidence_items_method_breakdown,
        evidence_items_model_breakdown: pack.evidence_items_model_breakdown,
      },
      null,
      2,
    ),
    "```",
    "",
    "## Latest Raw Pages",
    "",
    "```json",
    JSON.stringify(pack.raw_pages_latest_rows_summary, null, 2),
    "```",
    "",
    "## Telemetry",
    "",
    "```json",
    JSON.stringify(pack.crawler_telemetry_timeline, null, 2),
    "```",
    "",
    "## Errors",
    "",
    "```json",
    JSON.stringify(pack.errors, null, 2),
    "```",
    "",
    "## Trace IDs",
    "",
    "```json",
    JSON.stringify(pack.trace_id_list, null, 2),
    "```",
    "",
    "## Timestamps",
    "",
    "```json",
    JSON.stringify(pack.timestamps, null, 2),
    "```",
    "",
    "## No-write Verification",
    "",
    pack.no_write_verification_statement,
  ];
  return `${lines.join("\n")}\n`;
}

function formatCount(value) {
  return value === null || value === undefined ? "unavailable" : String(value);
}

function formatCountObject(value) {
  if (value?.available) return String(value.count);
  return `unavailable (${value?.reason || "unknown"})`;
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
  const pack = await buildEvidencePack(reader, args);

  if (args.format === "markdown") {
    process.stdout.write(toMarkdown(pack));
  } else {
    process.stdout.write(`${JSON.stringify(pack, null, 2)}\n`);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message, no_write_verification_statement: NO_WRITE_STATEMENT }, null, 2));
  process.exit(1);
});
