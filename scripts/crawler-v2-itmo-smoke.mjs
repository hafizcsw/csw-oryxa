#!/usr/bin/env node
import fs from "node:fs/promises";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const runId = "f67313a4-883d-4074-90cd-a68f047cb495";
const runItemId = "0098a363-e2cd-4493-ba92-bf234b2227fa";
const universityId = "055a0d4b-f0a2-404a-a064-2c0f4e40e302";

if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const flags = {
  worker: process.env.RUN_WORKER === "true",
  planner: process.env.RUN_PLANNER === "true",
  basic: process.env.RUN_BASIC_EXTRACT === "true",
  ai: process.env.RUN_AI_EXTRACT === "true",
  draft: process.env.RUN_DRAFT_WRITER === "true",
  orx: process.env.RUN_ORX_MAPPER === "true",
  verify: process.env.RUN_VERIFY_ONLY === "true",
};

const report = {
  ok: null,
  generated_at: new Date().toISOString(),
  target: { runId, runItemId, universityId, website: "https://itmo.ru/" },
  flags,
  before: null,
  stages: [],
  after: null,
  failure: null,
  safety: {
    publish_executed_by_script: false,
    run_all_executed_by_script: false,
    country_crawl_executed_by_script: false,
    canonical_mutation_attempted_by_script: false
  }
};

function headers(extra = {}) {
  return {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function getJson(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: headers() });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  return { ok: res.ok, status: res.status, body };
}

async function count(table, filter = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*${filter}`, {
    headers: headers({ Prefer: "count=exact", Range: "0-0" }),
  });
  const cr = res.headers.get("content-range") || "";
  const n = cr.includes("/") ? Number(cr.split("/").pop()) : null;
  return { ok: res.ok, status: res.status, count: n };
}

async function evidence(label) {
  return {
    label,
    at: new Date().toISOString(),
    run_item: await getJson(`crawler_run_items?select=id,status,stage,progress_percent,pages_found,pages_fetched,failure_reason,failure_detail,updated_at&id=eq.${runItemId}`),
    raw_pages_count: await count("raw_pages", `&university_id=eq.${universityId}`),
    raw_pages_latest: await getJson(`raw_pages?select=id,url,status_code,content_type,fetched_at,body_sha256&university_id=eq.${universityId}&order=fetched_at.desc&limit=5`),
    candidates_count: await count("crawler_page_candidates", `&crawler_run_item_id=eq.${runItemId}`),
    candidates_sample: await getJson(`crawler_page_candidates?select=id,candidate_type,discovery_method,candidate_url,priority,status,trace_id,created_at&crawler_run_item_id=eq.${runItemId}&order=priority.desc&limit=20`),
    evidence_count: await count("evidence_items", `&crawler_run_id=eq.${runId}`),
    evidence_group_sample: await getJson(`evidence_items?select=extraction_method,model_provider,model_name&crawler_run_id=eq.${runId}&limit=200`),
    telemetry_latest: await getJson(`crawler_telemetry?select=stage,event_type,success,error_type,error_message,duration_ms,trace_id,timestamp&run_item_id=eq.${runItemId}&order=timestamp.desc&limit=30`),
    program_draft_count: await count("program_draft", `&crawler_run_item_id=eq.${runItemId}`),
    orx_evidence_count: await count("orx_evidence", `&crawler_run_item_id=eq.${runItemId}`),
    publish_audit_count: await count("publish_audit_trail", ""),
  };
}

async function callStage(stage, fn, payload) {
  if (JSON.stringify(payload).includes("publish")) throw new Error("Publish action blocked");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  const rec = { stage, fn, http_status: res.status, body, trace_id: body?.trace_id || body?.tid || null };
  report.stages.push(rec);
  console.log(`[${stage}] HTTP ${res.status}`, JSON.stringify(body));
  if (!res.ok || body?.ok === false) {
    const err = new Error(`${stage} failed`);
    err.rec = rec;
    throw err;
  }
}

function hint(rec) {
  const b = rec?.body || {};
  const e = String(b.error || b.error_type || "");
  if (rec?.http_status === 401 || rec?.http_status === 403) return "AUTH_FAILED_OR_ADMIN_GUARD";
  if (rec?.http_status === 404) return "FUNCTION_NOT_DEPLOYED";
  if (e.includes("no_raw_page")) return "RAW_PAGE_MISSING";
  if (e.includes("candidate")) return "CANDIDATES_MISSING";
  if (e.includes("evidence")) return "EVIDENCE_MISSING";
  if (e.includes("deepseek") || e.includes("ai")) return "AI_PROVIDER_FAILED";
  if (e.includes("draft")) return "DRAFT_SCHEMA_MISMATCH";
  if (e.includes("orx")) return "ORX_RULES_MISSING";
  return "UNKNOWN_EDGE_ERROR";
}

try {
  report.before = await evidence("before");

  if (flags.worker) await callStage("worker", "crawler-v2-worker", { action: "run_item", run_item_id: runItemId });
  if (flags.planner) await callStage("planner", "crawler-v2-page-planner", { action: "plan_pages", run_item_id: runItemId });
  if (flags.basic) await callStage("basic_extract", "crawler-v2-basic-extract", { action: "extract_homepage", run_item_id: runItemId });
  if (flags.ai) await callStage("ai_extract", "crawler-v2-ai-extract", { action: "ai_extract", run_item_id: runItemId });
  if (flags.draft) await callStage("draft_writer", "crawler-v2-draft-writer", { action: "write_drafts", run_item_id: runItemId });
  if (flags.orx) await callStage("orx_mapper", "crawler-v2-orx-mapper", { action: "map_orx", run_item_id: runItemId });
  if (flags.verify) await callStage("verify_only", "crawler-v2-control", { action: "verify_item", run_item_id: runItemId });

  report.after = await evidence("after");
  report.ok = true;
} catch (err) {
  const diag = await evidence("failure_diagnostics");
  report.ok = false;
  report.failure = {
    message: String(err?.message || err),
    failed_stage: err?.rec?.stage || null,
    stage_record: err?.rec || null,
    diagnosis_hint: hint(err?.rec),
    diagnostics: diag,
  };
  await fs.writeFile("crawler-v2-itmo-smoke-report.json", JSON.stringify(report, null, 2));
  console.error(JSON.stringify(report.failure, null, 2));
  process.exit(1);
}

await fs.writeFile("crawler-v2-itmo-smoke-report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  ok: report.ok,
  stages: report.stages.map(s => ({ stage: s.stage, http_status: s.http_status, trace_id: s.trace_id })),
  report_file: "crawler-v2-itmo-smoke-report.json",
  safety: report.safety
}, null, 2));
