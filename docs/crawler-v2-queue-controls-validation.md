# Crawler v2 Queue Controls Validation

Status: P0-2 read-only diagnostics implementation
Scope: local validation script plus documentation only
Door mapping: Door 1 Run Control & Diagnostics

## Purpose

`scripts/crawler-v2-queue-controls-validation.mjs` generates a no-write queue validation report for one Crawler v2 run item. It inspects current run, item, lock, duplicate, telemetry, and failure state so a reviewer can decide whether pause, resume, stop, retry, or selected-stage actions look safe before real queue mutation exists.

This tool does not execute queue controls. It is a diagnostic precheck only.

## Relationship To P0-1 Evidence Pack

P0-1 Evidence Pack answers: "What evidence and telemetry exist for this run item?"

P0-2 Queue Controls Validation answers: "Given the current state, would queue actions be allowed, blocked, or require review?"

Both tools are local, read-only, Supabase REST `GET` diagnostics. The queue validator can be used after an Evidence Pack to focus specifically on Queue Controls readiness, duplicate active run risk, stale lock indicators, retry eligibility, selected-stage safety, and downstream blockers.

## What It Reads

Required tables:

- `crawler_runs`
- `crawler_run_items`
- `crawler_telemetry`

Optional sections:

- `crawler_locks`
- duplicate active run candidates from `crawler_run_items`

If optional sections are unavailable, the report emits unavailable markers. If required run/item/telemetry reads fail, the script fails closed.

## What It Does Not Do

The script does not:

- run queue controls
- pause, resume, stop, cancel, retry, or clean locks
- run crawler functions
- run Run All
- run country crawl
- publish
- call Edge Functions
- call Supabase RPC
- call external APIs outside Supabase SELECT reads
- call AI providers
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

The script remains SELECT-only when a service role key is used. The key only affects what Supabase Row Level Security allows the local diagnostic read to see.

## Example Commands

JSON output is the default:

```bash
node scripts/crawler-v2-queue-controls-validation.mjs \
  --run-item-id 0098a363-e2cd-4493-ba92-bf234b2227fa
```

Provide both IDs for a stricter run/item consistency check:

```bash
node scripts/crawler-v2-queue-controls-validation.mjs \
  --run-id f67313a4-883d-4074-90cd-a68f047cb495 \
  --run-item-id 0098a363-e2cd-4493-ba92-bf234b2227fa
```

Markdown output:

```bash
node scripts/crawler-v2-queue-controls-validation.mjs \
  --run-id f67313a4-883d-4074-90cd-a68f047cb495 \
  --run-item-id 0098a363-e2cd-4493-ba92-bf234b2227fa \
  --format markdown
```

Syntax-only validation:

```bash
node --check scripts/crawler-v2-queue-controls-validation.mjs
```

Fail-closed static check:

```bash
node scripts/crawler-v2-queue-controls-validation.mjs
```

That command fails before DB reads because no run identifier was provided.

## Output Fields

The report includes:

- `run_id`
- `run_item_id`
- `university_id`
- `website`
- `target_domain`
- `run_status`
- `item_status`
- `item_stage`
- `item_progress`
- `current_locks`
- `telemetry_timeline_summary`
- `failure_error_summary`
- `duplicate_active_run_candidates`
- `stale_lock_indicators`
- `retry_eligibility`
- `pause_eligibility`
- `resume_eligibility`
- `stop_eligibility`
- `selected_stage_eligibility`
- `precondition_failures`
- `blocked_downstream_stages`
- `trace_id_list`
- `timestamps`
- `no_write_verification_statement`

Eligibility values are one of:

- `allowed`
- `blocked`
- `requires_review`

Every eligibility object also includes:

- `reasons`
- `recommendation`
- `executed: false`
- `no_write: true`

## Validation Logic

The validator applies Door 1 safety rules:

- If the item is active or mid-stage, retry is blocked.
- If the item is already completed, retry requires explicit reason and review.
- If failed telemetry looks retryable, retry is only a diagnostic recommendation and still requires review.
- If stale lock evidence is detected, the report flags `stale_lock_possible` but does not fix it.
- If the item is mid-stage or the stage is missing/ambiguous, selected-stage eligibility is blocked.
- If duplicate active run candidates exist for the same university or target domain, the report flags `duplicate_run_possible`.
- Runtime-open stages 1E, 2, 4, 5, and 6 are listed as blocked downstream dependencies.
- Missing optional values are marked unavailable instead of invented.

## Failure Behavior

The script fails closed when:

- neither `--run-id` nor `--run-item-id` is supplied
- required Supabase env vars are missing
- `--format` is not `json` or `markdown`
- a provided `--run-id` does not match the selected `--run-item-id`
- a run ID has multiple run items and no `--run-item-id` is supplied
- `crawler_runs`, `crawler_run_items`, or `crawler_telemetry` cannot be read
- no matching run or run item is found

## No-write Guarantee

Mandatory statement emitted in every report:

> This queue controls validation report is diagnostic-only. It did not run crawler functions, queue mutations, Run All, country crawl, publish, ORX scoring, student eligibility, canonical writes, migrations, Edge Functions, workflows, scripts, external API calls, or language/i18n changes.

Implementation guardrails:

- HTTP method is `GET` only.
- The script does not call Supabase Functions endpoints.
- The script does not call RPC.
- The script does not call crawler functions.
- The script does not write files by default; output goes to stdout.
- Every action eligibility reports `executed: false`.

## Door 1 Mapping

This implements the Door 1 Queue Controls Validation diagnostic:

- It reads run and item state.
- It reads telemetry and lock evidence.
- It detects duplicate active run candidates when visible.
- It reports stale-lock indicators without cleanup.
- It reports pause/resume/stop/retry/selected-stage eligibility without mutation.
- It repeats downstream blockers for 1E, 2, 4, 5, and 6.

## What Remains Blocked

Until real Queue Controls runtime closure:

- pause execution
- resume execution
- stop/cancel execution
- retry execution
- lock cleanup
- selected-stage execution
- duplicate-run enforcement

Downstream remains blocked by original runtime gates:

- reviewer workflow execution waits for 1E
- draft writes wait for 4
- ORX mapping and scoring wait for 5 plus 6
- publish, canonical writes, trust badges, public pages, and data APIs wait for 6
- student eligibility production waits for verified requirements plus 4 and 6
