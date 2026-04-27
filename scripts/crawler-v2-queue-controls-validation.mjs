#!/usr/bin/env node

const NO_WRITE_STATEMENT =
  "This queue controls validation report is diagnostic-only. It did not run crawler functions, queue mutations, Run All, country crawl, publish, ORX scoring, student eligibility, canonical writes, migrations, Edge Functions, workflows, scripts, external API calls, or language/i18n changes.";

const REQUIRED_TABLES = new Set(["crawler_runs", "crawler_run_items", "crawler_telemetry"]);
const OPTIONAL_UNAVAILABLE = Object.freeze({ available: false, reason: "unavailable" });

const RUN_ACTIVE_STATUSES = new Set(["queued", "running", "paused"]);
const RUN_TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled", "canceled"]);
const ITEM_ACTIVE_STATUSES = new Set([
  "queued",
  "website_check",
  "fetching",
  "rendering_needed",
  "rendering",
  "artifact_discovery",
  "artifact_parsing",
  "extracting",
  "ai_extracting",
]);
const ITEM_TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
  "canceled",
  "verified",
  "published",
]);
const RETRYABLE_ERROR_HINTS = [
  "timeout",
  "rate",
  "429",
  "temporary",
  "network",
  "fetch",
  "lock",
  "stale",
  "unavailable",
  "5",
];

function parseArgs(argv) {
  const args = { runId: null, runItemId: null, format: "json", help: false };

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
    else throw new Error(`Unknown argument: ${arg}`);
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
    "  node scripts/crawler-v2-queue-controls-validation.mjs --run-item-id <uuid> [--format json|markdown]",
    "  node scripts/crawler-v2-queue-controls-validation.mjs --run-id <uuid> --run-item-id <uuid> [--format json|markdown]",
    "",
    "Required env:",
    "  SUPABASE_URL",
    "  SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY",
    "",
    "Safety:",
    "  This script performs SELECT-only REST reads. It never mutates queue state and never calls Edge Functions or RPC.",
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

function neq(column, value) {
  return `${column}=neq.${enc(value)}`;
}

function unavailable(reason, details = null) {
  return { ...OPTIONAL_UNAVAILABLE, details, reason };
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
          return { ok: false, rows, truncated: false, unavailable: unavailable(`Could not read ${table}`, parsed) };
        }
        throw new Error(`Required table read failed for ${table}: HTTP ${res.status} ${JSON.stringify(parsed)}`);
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

async function resolveRunAndItem(reader, { runId, runItemId }) {
  if (!runId && !runItemId) throw new Error("Fail closed: provide --run-id and/or --run-item-id.");

  let item = null;
  if (runItemId) {
    const itemResult = await reader.maybeSingle(
      "crawler_run_items",
      [
        "select=id,run_id,university_id,website,target_domain,status,stage,progress_percent,failure_reason,failure_detail,trace_id,created_at,started_at,updated_at,completed_at,retry_count,pages_found,pages_fetched,pages_rendered,evidence_count,draft_count,orx_signal_count",
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
        "select=id,run_id,university_id,website,target_domain,status,stage,progress_percent,failure_reason,failure_detail,trace_id,created_at,started_at,updated_at,completed_at,retry_count,pages_found,pages_fetched,pages_rendered,evidence_count,draft_count,orx_signal_count",
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

async function buildQueueValidation(reader, args) {
  const { run, item } = await resolveRunAndItem(reader, args);
  const telemetry = await reader.readAll("crawler_telemetry", [
    "select=stage,event_type,success,error_type,error_message,duration_ms,trace_id,timestamp",
    eq("run_item_id", item.id),
    "order=timestamp.asc",
  ]);

  const locks = await readLocks(reader, run, item);
  const duplicateActiveRuns = await readDuplicateActiveRunCandidates(reader, run, item);

  const telemetryRows = telemetry.rows || [];
  const errors = summarizeErrors(item, telemetryRows);
  const staleLockIndicators = detectStaleLockIndicators(item, locks);
  const failureCategory = classifyFailure(item, errors);
  const preconditionFailures = collectPreconditionFailures(run, item, locks, duplicateActiveRuns, staleLockIndicators);
  const blockedDownstreamStages = blockedStagesFor(item);
  const traceIds = uniqueCompact([
    run.trace_id,
    item.trace_id,
    ...telemetryRows.map((row) => row.trace_id),
    ...(locks.rows || []).map((row) => row.lock_metadata?.trace_id),
    ...(duplicateActiveRuns.candidates || []).map((row) => row.trace_id),
  ]);

  const context = {
    run,
    item,
    errors,
    locks,
    duplicateActiveRuns,
    staleLockIndicators,
    failureCategory,
    preconditionFailures,
  };

  return {
    generated_at: new Date().toISOString(),
    run_id: run.id,
    run_item_id: item.id,
    university_id: item.university_id,
    website: item.website ?? null,
    target_domain: item.target_domain ?? null,
    run_status: run.status ?? null,
    item_status: item.status ?? null,
    item_stage: item.stage ?? null,
    item_progress: item.progress_percent ?? null,
    current_locks: summarizeLocks(locks),
    telemetry_timeline_summary: summarizeTelemetry(telemetryRows, telemetry.truncated),
    failure_error_summary: {
      failure_reason: item.failure_reason ?? null,
      failure_detail: item.failure_detail ?? null,
      failure_category: failureCategory,
      errors,
    },
    duplicate_active_run_candidates: duplicateActiveRuns,
    stale_lock_indicators: staleLockIndicators,
    retry_eligibility: evaluateRetry(context),
    pause_eligibility: evaluatePause(context),
    resume_eligibility: evaluateResume(context),
    stop_eligibility: evaluateStop(context),
    selected_stage_eligibility: evaluateSelectedStage(context),
    precondition_failures: preconditionFailures,
    blocked_downstream_stages: blockedDownstreamStages,
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
    no_write_verification_statement: NO_WRITE_STATEMENT,
  };
}

async function readLocks(reader, run, item) {
  const ids = uniqueCompact([run.id, item.id, item.university_id, item.target_domain]);
  if (ids.length === 0) return { ok: false, rows: [], truncated: false, unavailable: unavailable("No resource ids available") };
  return reader.readAll(
    "crawler_locks",
    [
      "select=resource_type,resource_id,lock_holder,lock_metadata,acquired_at,expires_at",
      inList("resource_id", ids),
      "order=acquired_at.desc",
    ],
    { required: false, maxRows: 500 },
  );
}

async function readDuplicateActiveRunCandidates(reader, run, item) {
  const filters = [
    {
      label: "same_university",
      query: [
        "select=id,run_id,university_id,website,target_domain,status,stage,progress_percent,trace_id,created_at,updated_at",
        eq("university_id", item.university_id),
        inList("status", [...ITEM_ACTIVE_STATUSES]),
        neq("id", item.id),
        "order=updated_at.desc",
        "limit=50",
      ],
    },
  ];

  if (item.target_domain) {
    filters.push({
      label: "same_target_domain",
      query: [
        "select=id,run_id,university_id,website,target_domain,status,stage,progress_percent,trace_id,created_at,updated_at",
        eq("target_domain", item.target_domain),
        inList("status", [...ITEM_ACTIVE_STATUSES]),
        neq("id", item.id),
        "order=updated_at.desc",
        "limit=50",
      ],
    });
  }

  const candidates = [];
  const unavailableParts = [];
  for (const filter of filters) {
    const result = await reader.read("crawler_run_items", filter.query.join("&"), { required: false });
    if (!result.ok) {
      unavailableParts.push({ label: filter.label, reason: result.unavailable?.reason, details: result.unavailable?.details });
      continue;
    }
    for (const row of result.data || []) {
      candidates.push({ ...row, duplicate_basis: filter.label });
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const candidate of candidates) {
    if (seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    deduped.push(candidate);
  }

  return {
    available: unavailableParts.length === 0,
    duplicate_run_possible: deduped.length > 0,
    candidates: deduped,
    unavailable_parts: unavailableParts,
  };
}

function summarizeLocks(lockResult) {
  if (!lockResult.ok) {
    return {
      available: false,
      count: null,
      status: "unavailable",
      reason: lockResult.unavailable?.reason || "unavailable",
      details: lockResult.unavailable?.details || null,
    };
  }

  const now = Date.now();
  const rows = lockResult.rows || [];
  const current = rows.filter((row) => !row.expires_at || Date.parse(row.expires_at) >= now);
  const expired = rows.filter((row) => row.expires_at && Date.parse(row.expires_at) < now);
  return {
    available: true,
    count: rows.length,
    status: current.length > 0 ? "active_lock_present" : expired.length > 0 ? "expired_locks_only" : "no_locks",
    active_count: current.length,
    expired_count: expired.length,
    rows: rows.map((row) => ({
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      lock_holder: row.lock_holder,
      acquired_at: row.acquired_at,
      expires_at: row.expires_at,
      expired: row.expires_at ? Date.parse(row.expires_at) < now : null,
    })),
    truncated: lockResult.truncated,
  };
}

function detectStaleLockIndicators(item, lockResult) {
  const indicators = [];
  const now = Date.now();
  const updatedAt = item.updated_at ? Date.parse(item.updated_at) : null;
  const ageMinutes = updatedAt ? Math.round((now - updatedAt) / 60000) : null;

  if (ITEM_ACTIVE_STATUSES.has(item.status) && ageMinutes !== null && ageMinutes > 30) {
    indicators.push({
      type: "active_item_stale_updated_at",
      stale_lock_possible: true,
      detail: `Item status ${item.status} has not updated for ${ageMinutes} minutes.`,
    });
  }

  if (lockResult.ok) {
    for (const row of lockResult.rows || []) {
      if (row.expires_at && Date.parse(row.expires_at) < now) {
        indicators.push({
          type: "expired_crawler_lock",
          stale_lock_possible: true,
          resource_type: row.resource_type,
          resource_id: row.resource_id,
          expires_at: row.expires_at,
        });
      }
    }
  }

  return {
    stale_lock_possible: indicators.length > 0,
    indicators,
  };
}

function summarizeErrors(item, telemetryRows) {
  const telemetryErrors = telemetryRows
    .filter((row) => row.success === false || row.error_type || row.error_message)
    .map((row) => ({
      source: "crawler_telemetry",
      stage: row.stage,
      event_type: row.event_type,
      error_type: row.error_type,
      error_message: row.error_message,
      trace_id: row.trace_id,
      timestamp: row.timestamp,
    }));

  if (item.failure_reason || item.failure_detail) {
    telemetryErrors.push({
      source: "crawler_run_items",
      failure_reason: item.failure_reason,
      failure_detail: item.failure_detail,
      trace_id: item.trace_id,
      updated_at: item.updated_at,
    });
  }

  return telemetryErrors;
}

function classifyFailure(item, errors) {
  const text = `${item.failure_reason || ""} ${item.failure_detail || ""} ${errors
    .map((error) => `${error.error_type || ""} ${error.error_message || ""}`)
    .join(" ")}`.toLowerCase();

  if (!text.trim()) return "none";
  if (text.includes("429") || text.includes("rate")) return "retryable_rate_limit";
  if (text.includes("timeout") || text.includes("network") || text.includes("temporary")) return "retryable_transient";
  if (text.includes("lock") || text.includes("stale")) return "retryable_lock_or_stale_state";
  if (text.includes("403") || text.includes("401") || text.includes("robots")) return "requires_review_access_or_policy";
  if (text.includes("404") || text.includes("not found")) return "requires_review_not_found";
  if (text.includes("publish") || text.includes("orx") || text.includes("draft")) return "blocked_downstream_stage";
  if (item.status === "failed") return "unknown_failed_item";
  return "unknown";
}

function collectPreconditionFailures(run, item, locks, duplicates, staleIndicators) {
  const failures = [];
  if (!run.status) failures.push({ code: "run_status_unavailable", detail: "Run status is missing." });
  if (!item.status) failures.push({ code: "item_status_unavailable", detail: "Item status is missing." });
  if (!item.stage) failures.push({ code: "item_stage_unavailable", detail: "Item stage is missing or ambiguous." });
  if (duplicates.duplicate_run_possible) {
    failures.push({ code: "duplicate_run_possible", detail: "Another active run item exists for the same university or domain." });
  }
  if (staleIndicators.stale_lock_possible) {
    failures.push({ code: "stale_lock_possible", detail: "Stale item or expired crawler lock evidence was detected." });
  }
  if (!locks.ok) {
    failures.push({ code: "locks_unavailable", detail: "crawler_locks could not be read; lock status is unavailable." });
  }
  if (RUN_TERMINAL_STATUSES.has(run.status) && ITEM_ACTIVE_STATUSES.has(item.status)) {
    failures.push({ code: "terminal_run_with_active_item", detail: "Run is terminal but item appears active." });
  }
  return failures;
}

function blockedStagesFor(item) {
  return [
    {
      stage: "1E Review Surface",
      blocked: true,
      reason: "Reviewer workflow execution remains blocked until 1E runtime closure.",
    },
    {
      stage: "2 Queue Controls",
      blocked: true,
      reason: "This report is validation-only. Real pause/resume/stop/retry/selected-stage mutations remain blocked until Queue Controls runtime closure.",
    },
    {
      stage: "4 Draft Writer",
      blocked: true,
      reason: "Draft writes or promotion remain blocked until Draft Writer runtime closure.",
    },
    {
      stage: "5 ORX Mapper",
      blocked: true,
      reason: "ORX mapping and score-affecting work remain blocked until ORX Mapper runtime closure.",
    },
    {
      stage: "6 Verify/Publish Gate",
      blocked: true,
      reason: "Publish, canonical writes, public surfaces, and trust outputs remain blocked until Verify/Publish Gate runtime closure.",
    },
    ...(item.stage && ["draft_writer", "orx_mapper", "verify_publish"].includes(item.stage)
      ? [
          {
            stage: item.stage,
            blocked: true,
            reason: "Current item stage is downstream of the closed runtime set and requires review before any action.",
          },
        ]
      : []),
  ];
}

function evaluateRetry({ item, errors, staleLockIndicators, failureCategory }) {
  const reasons = [];
  if (ITEM_ACTIVE_STATUSES.has(item.status)) {
    return decision("blocked", ["Item is active or mid-stage; retry would compound state."], "Do not retry while active.");
  }
  if (item.status === "completed") {
    return decision(
      "requires_review",
      ["Item is already completed; retry requires an explicit reason and human approval."],
      "Diagnostic only: require explicit retry reason before any future queue action.",
    );
  }
  if (staleLockIndicators.stale_lock_possible) reasons.push("Stale lock evidence exists; cleanup is blocked and must be reviewed.");
  if (item.status === "failed") {
    const retryable = isRetryableFailure(failureCategory, errors);
    reasons.push(retryable ? "Failed item has retryable-looking telemetry." : "Failed item category is not clearly retryable.");
    return decision(
      "requires_review",
      reasons,
      retryable
        ? "Diagnostic recommendation: retry may be possible after review; this script does not retry."
        : "Review failure category before any retry.",
    );
  }
  return decision("blocked", [`Item status ${item.status || "unavailable"} is not a safe retry candidate.`], "No retry recommended.");
}

function evaluatePause({ run, item, duplicateActiveRuns, staleLockIndicators }) {
  if (!["running", "queued"].includes(run.status)) {
    return decision("blocked", [`Run status ${run.status || "unavailable"} is not pauseable.`], "No pause recommended.");
  }
  const reasons = [];
  if (duplicateActiveRuns.duplicate_run_possible) reasons.push("Duplicate active run candidates exist.");
  if (staleLockIndicators.stale_lock_possible) reasons.push("Stale lock evidence exists.");
  if (ITEM_ACTIVE_STATUSES.has(item.status)) reasons.push(`Item is currently active at status ${item.status}.`);
  return reasons.length
    ? decision("requires_review", reasons, "Pause may be safe only after reviewing active/stale/duplicate state; this script does not pause.")
    : decision("allowed", ["Run is queued/running and no local blockers were detected."], "Diagnostic only: pause appears safe to validate later.");
}

function evaluateResume({ run, item, duplicateActiveRuns, staleLockIndicators }) {
  if (run.status !== "paused") {
    return decision("blocked", [`Run status ${run.status || "unavailable"} is not paused.`], "No resume recommended.");
  }
  const reasons = [];
  if (duplicateActiveRuns.duplicate_run_possible) reasons.push("Duplicate active run candidates exist.");
  if (staleLockIndicators.stale_lock_possible) reasons.push("Stale lock evidence exists.");
  if (ITEM_ACTIVE_STATUSES.has(item.status)) reasons.push(`Item is already active at status ${item.status}.`);
  return reasons.length
    ? decision("requires_review", reasons, "Resume requires review of duplicate/stale/active item state; this script does not resume.")
    : decision("allowed", ["Run is paused and no local blockers were detected."], "Diagnostic only: resume appears safe to validate later.");
}

function evaluateStop({ run, item, staleLockIndicators }) {
  if (RUN_TERMINAL_STATUSES.has(run.status)) {
    return decision("blocked", [`Run status ${run.status} is already terminal.`], "No stop recommended.");
  }
  if (!RUN_ACTIVE_STATUSES.has(run.status)) {
    return decision("requires_review", [`Run status ${run.status || "unavailable"} is not a known active state.`], "Review before any future stop.");
  }
  const reasons = [];
  if (ITEM_ACTIVE_STATUSES.has(item.status)) reasons.push(`Item is active at status ${item.status}.`);
  if (staleLockIndicators.stale_lock_possible) reasons.push("Stale lock evidence exists.");
  return reasons.length
    ? decision("requires_review", reasons, "Stop may be appropriate after review; this script does not stop or mark items failed.")
    : decision("allowed", ["Run is active and no local blockers were detected."], "Diagnostic only: stop appears safe to validate later.");
}

function evaluateSelectedStage({ item, preconditionFailures }) {
  const reasons = [];
  if (!item.stage) reasons.push("Item stage is missing or ambiguous.");
  if (ITEM_ACTIVE_STATUSES.has(item.status)) reasons.push(`Item is mid-stage with status ${item.status}.`);
  if (preconditionFailures.some((failure) => failure.code === "duplicate_run_possible" || failure.code === "stale_lock_possible")) {
    reasons.push("Duplicate or stale-lock evidence must be reviewed first.");
  }
  if (reasons.length > 0) {
    return decision("blocked", reasons, "Selected-stage execution is blocked; this script does not run stages.");
  }
  return decision(
    "requires_review",
    ["Selected-stage execution remains blocked until Queue Controls and the selected stage are runtime-closed."],
    "Diagnostic only: preconditions should be reviewed before any future selected-stage action.",
  );
}

function isRetryableFailure(failureCategory, errors) {
  if (failureCategory.startsWith("retryable_")) return true;
  const joined = errors.map((error) => `${error.error_type || ""} ${error.error_message || ""}`).join(" ").toLowerCase();
  return RETRYABLE_ERROR_HINTS.some((hint) => joined.includes(hint));
}

function decision(state, reasons, recommendation) {
  return {
    state,
    reasons,
    recommendation,
    executed: false,
    no_write: true,
  };
}

function summarizeTelemetry(rows, truncated) {
  const byStage = countBy(rows, "stage");
  const byEventType = countBy(rows, "event_type");
  const failedEvents = rows.filter((row) => row.success === false || row.error_type || row.error_message).length;
  return {
    event_count: rows.length,
    failed_event_count: failedEvents,
    by_stage: byStage,
    by_event_type: byEventType,
    latest_event: rows.length > 0 ? rows[rows.length - 1] : null,
    truncated,
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

function toMarkdown(report) {
  const lines = [
    "# Crawler v2 Queue Controls Validation",
    "",
    `Generated at: ${report.generated_at}`,
    "",
    "## Run",
    "",
    `- run_id: ${report.run_id}`,
    `- run_item_id: ${report.run_item_id}`,
    `- university_id: ${report.university_id}`,
    `- website: ${report.website ?? "unavailable"}`,
    `- target_domain: ${report.target_domain ?? "unavailable"}`,
    `- run_status: ${report.run_status ?? "unavailable"}`,
    `- item_status: ${report.item_status ?? "unavailable"}`,
    `- item_stage: ${report.item_stage ?? "unavailable"}`,
    `- item_progress: ${report.item_progress ?? "unavailable"}`,
    "",
    "## Eligibility",
    "",
    `- retry: ${report.retry_eligibility.state}`,
    `- pause: ${report.pause_eligibility.state}`,
    `- resume: ${report.resume_eligibility.state}`,
    `- stop: ${report.stop_eligibility.state}`,
    `- selected_stage: ${report.selected_stage_eligibility.state}`,
    "",
    "## Details",
    "",
    "```json",
    JSON.stringify(
      {
        current_locks: report.current_locks,
        telemetry_timeline_summary: report.telemetry_timeline_summary,
        failure_error_summary: report.failure_error_summary,
        duplicate_active_run_candidates: report.duplicate_active_run_candidates,
        stale_lock_indicators: report.stale_lock_indicators,
        precondition_failures: report.precondition_failures,
        blocked_downstream_stages: report.blocked_downstream_stages,
        trace_id_list: report.trace_id_list,
        timestamps: report.timestamps,
      },
      null,
      2,
    ),
    "```",
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
  if (!args.runId && !args.runItemId) throw new Error("Fail closed: provide --run-id and/or --run-item-id.");

  const env = getEnv();
  const reader = new RestReader(env);
  const report = await buildQueueValidation(reader, args);
  if (args.format === "markdown") process.stdout.write(toMarkdown(report));
  else process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message, no_write_verification_statement: NO_WRITE_STATEMENT }, null, 2));
  process.exit(1);
});
