# Crawler v2 Evidence Pack

Status: P0-1 read-only diagnostics implementation
Scope: local script plus documentation only
Door mapping: Door 1 Run Control & Diagnostics, with Door 2 evidence fields preserved

## Purpose

`scripts/crawler-v2-evidence-pack.mjs` generates a local read-only Evidence Pack for a Crawler v2 run item. It gives Claude, Codex, and human reviewers a single inspection packet for run state, item state, evidence counts, candidate breakdowns, telemetry, errors, traces, timestamps, and downstream unavailable markers.

This replaces manual SQL and browser Console loops for diagnostics. It does not replace Crawler v2 and does not execute crawler stages.

## What It Reads

The script uses Supabase REST `GET` requests only.

Required tables:

- `crawler_runs`
- `crawler_run_items`
- `raw_pages`
- `crawler_page_candidates`
- `evidence_items`
- `crawler_telemetry`

Optional count sources:

- `media_draft`
- `housing_draft`
- `leadership_draft`
- `publish_audit_trail`

ORX output count is derived read-only from `evidence_items` where `orx_evidence_id` is present for the selected run item.

If an optional table is unavailable, the output contains an explicit unavailable marker. If a required table read fails, the script fails closed.

## What It Does Not Do

The script does not:

- run crawler functions
- run Run All
- run country crawl
- publish
- call Edge Functions
- call AI providers
- call external APIs outside Supabase SELECT reads
- write to Supabase
- update canonical `universities`, `programs`, `university_media`, or `orx_scores`
- create migrations, workflows, or Edge Functions
- change crawler extraction, ORX scoring, student eligibility, or language/i18n logic

## Required Env Vars

Set:

```bash
export SUPABASE_URL="https://<project>.supabase.co"
```

Set one read-capable key:

```bash
export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

or:

```bash
export SUPABASE_ANON_KEY="<anon-key>"
```

or:

```bash
export VITE_SUPABASE_PUBLISHABLE_KEY="<publishable-key>"
```

The script is still SELECT-only when a service role key is used. The key only affects what Supabase Row Level Security allows the local diagnostic read to see.

## Example Commands

JSON output is the default:

```bash
node scripts/crawler-v2-evidence-pack.mjs \
  --run-item-id 0098a363-e2cd-4493-ba92-bf234b2227fa
```

Provide both IDs for a stricter check:

```bash
node scripts/crawler-v2-evidence-pack.mjs \
  --run-id f67313a4-883d-4074-90cd-a68f047cb495 \
  --run-item-id 0098a363-e2cd-4493-ba92-bf234b2227fa
```

Markdown output:

```bash
node scripts/crawler-v2-evidence-pack.mjs \
  --run-item-id 0098a363-e2cd-4493-ba92-bf234b2227fa \
  --format markdown
```

Syntax-only validation:

```bash
node --check scripts/crawler-v2-evidence-pack.mjs
```

Fail-closed static check without DB access:

```bash
node scripts/crawler-v2-evidence-pack.mjs
```

That command should fail with a missing identifier error and no reads or writes.

## Expected Output Fields

The JSON and Markdown output preserve the Door 1 Evidence Pack contract:

- `run_id`
- `run_item_id`
- `university_id`
- `website`
- `target_domain`
- `run_status`
- `item_status`
- `item_stage`
- `item_progress`
- `raw_pages_count`
- `raw_pages_latest_rows_summary`
- `crawler_page_candidates_count`
- `crawler_page_candidates_breakdown`
- `evidence_items_count`
- `evidence_items_method_breakdown`
- `evidence_items_model_breakdown`
- `crawler_telemetry_timeline`
- `errors`
- `failure_reason`
- `failure_detail`
- `trace_id_list`
- `timestamps`
- `draft_count`
- `orx_output_count`
- `publish_audit_count`
- `no_write_verification_statement`

Optional count fields use this shape when available:

```json
{
  "available": true,
  "count": 0,
  "source": "media_draft+housing_draft+leadership_draft"
}
```

Unavailable optional fields use this shape:

```json
{
  "available": false,
  "count": null,
  "reason": "unavailable"
}
```

## Failure Behavior

The script fails closed when:

- neither `--run-id` nor `--run-item-id` is supplied
- required Supabase env vars are missing
- `--format` is not `json` or `markdown`
- a provided `--run-id` does not match the selected `--run-item-id`
- a run ID has multiple run items and no `--run-item-id` is supplied
- a required Crawler v2 table cannot be read

The script does not invent missing fields. It either reads them, marks optional sections unavailable, or exits with an error.

## No-write Guarantee

Mandatory statement emitted in every pack:

> This evidence pack is diagnostic-only. It did not run crawler functions, Run All, country crawl, publish, ORX scoring, student eligibility, canonical writes, migrations, Edge Functions, workflows, scripts, external API calls, or language/i18n changes.

Implementation guardrails:

- HTTP method is `GET` only.
- The script does not import or call crawler functions.
- The script does not call Supabase Functions endpoints.
- The script does not call RPCs.
- The script does not create files by default; output goes to stdout.

## Door 1 Mapping

This is the first implementation of the Door 1 Evidence Pack contract:

- It anchors diagnostics on `run_id` and `run_item_id`.
- It exposes run, item, page, candidate, evidence, telemetry, error, trace, and timestamp state.
- It keeps Draft Writer, ORX Mapper, and Verify/Publish outputs as read-only counts or unavailable markers.
- It does not add admin UI actions.
- It does not run Crawler v2 stages.
- It keeps publish, canonical writes, ORX scoring, student eligibility, Run All, and country crawl blocked.
