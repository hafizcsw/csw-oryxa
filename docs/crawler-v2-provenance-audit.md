# Crawler v2 Provenance Audit

Status: read-only local diagnostic
Roadmap item: P0-3 Provenance model audit
Door mapping: Door 2 Evidence & Review Workbench

## Purpose

The Crawler v2 Provenance Audit checks whether evidence, draft facts, ORX candidates, and future publishable facts have enough source lineage to be reviewable. It is designed to catch missing source URLs, missing quotes/snippets, missing raw-page links, missing extraction methods, missing model metadata, low confidence, orphan evidence, and high-impact fields with incomplete provenance.

This is not crawler execution and not production implementation. It only reads current Crawler v2 state and emits a diagnostic report.

## Why This Is P0

Provenance is a safety prerequisite for Door 2 review, Door 4 ORX evidence, Door 5 student evaluation, Door 6 product surfaces, and any future publish gate. A fact without source lineage cannot safely move into review, ORX, student advice, CRM, public pages, trust badges, data APIs, or canonical writes.

The P0 audit therefore runs before prototypes or production surfaces. It supports the rule that no high-impact fact should proceed without source URL, quote/snippet, traceability, extraction method, and confidence or an explicit unavailable reason.

## Door 2 Mapping

Door 2 requires every reviewable fact to preserve:

- source URL
- evidence quote or snippet
- source type/table
- observed or fetched timestamp where available
- trace ID where available
- extraction method
- confidence or explicit unavailable reason
- model/provider for AI-derived facts
- conflict status
- blocked reason when blocked

The audit turns those requirements into PASS/WARN/FAIL section checks.

## Relationship To P0-1 Evidence Pack

The Evidence Pack summarizes run/item evidence and counts. The Provenance Audit goes deeper into lineage quality:

- whether evidence rows have source URLs
- whether evidence rows have quotes/snippets
- whether raw pages and candidates link together
- whether AI-derived evidence has model/provider metadata
- whether high-impact fields are review-safe

The tools are complementary. Evidence Pack answers “what exists”; Provenance Audit answers “is it lineage-safe enough to review.”

## Relationship To P0-2 Queue Controls Validation

Queue Controls Validation reports whether a run/item is safe for future queue actions. Provenance Audit does not evaluate queue mutation safety and cannot pause, resume, stop, retry, or run selected stages.

Both scripts are read-only and diagnostic-only.

## Relationship To P1 Benchmarks

The P1 benchmarks consume the same safety posture:

- Review Quality Benchmark depends on provenance for confidence, conflicts, weak claims, and review lanes.
- Requirement Hardness Benchmark depends on verified requirement snippets before student evaluation.
- ORX Signal Benchmark depends on source URL, quote/snippet, signal category, confidence, and anti-gaming flags.

The Provenance Audit does not run benchmarks, but it identifies whether runtime rows are suitable candidates for future benchmark or review use.

## What It Reads

Required core reads:

- `crawler_runs`
- `crawler_run_items`
- `raw_pages`
- `crawler_page_candidates`
- `evidence_items`
- `crawler_telemetry`

Optional reads when available:

- `program_draft`
- `housing_draft`
- `leadership_draft`
- `media_draft`
- `orx_evidence`
- `publish_audit_trail`

Optional tables are marked unavailable when absent, inaccessible, or not linked to the run/item. Missing optional data is WARN/unavailable, not invented.

## What It Does Not Do

The audit does not:

- run crawler functions
- run Run All
- run country crawl
- mutate queue state
- publish
- write canonical universities, programs, university media, or ORX scores
- create migrations
- create Edge Functions
- create workflows
- call Supabase RPC
- call external APIs
- call AI providers
- change crawler extraction logic
- change ORX scoring logic
- change student eligibility logic
- change language or i18n behavior

## Required Env Vars

Set:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Accepted key alternatives:

- `SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Accepted URL alternative:

- `VITE_SUPABASE_URL`

The script fails closed when Supabase URL or key is missing.

## Example Commands

Run by item:

```bash
node scripts/crawler-v2-provenance-audit.mjs \
  --run-item-id 0098a363-e2cd-4493-ba92-bf234b2227fa
```

Run by run and item:

```bash
node scripts/crawler-v2-provenance-audit.mjs \
  --run-id f67313a4-883d-4074-90cd-a68f047cb495 \
  --run-item-id 0098a363-e2cd-4493-ba92-bf234b2227fa
```

Markdown output:

```bash
node scripts/crawler-v2-provenance-audit.mjs \
  --run-id f67313a4-883d-4074-90cd-a68f047cb495 \
  --run-item-id 0098a363-e2cd-4493-ba92-bf234b2227fa \
  --format markdown
```

Write a local report file only when explicitly requested:

```bash
node scripts/crawler-v2-provenance-audit.mjs \
  --run-id f67313a4-883d-4074-90cd-a68f047cb495 \
  --run-item-id 0098a363-e2cd-4493-ba92-bf234b2227fa \
  --out crawler-v2-itmo-provenance-audit.json
```

## Output Fields

Top-level sections:

- `meta`
- `run_context`
- `source_table_coverage`
- `raw_pages_audit`
- `page_candidates_audit`
- `evidence_items_audit`
- `draft_audit`
- `orx_audit`
- `publish_audit`
- `high_impact_field_audit`
- `traceability_summary`
- `blocking_issues`
- `recommendations`
- `no_write_verification_statement`

The report includes:

- run ID
- run item ID
- university ID
- website
- target domain
- run status
- item status/stage/progress
- source table coverage summary
- raw pages provenance summary
- page candidates provenance summary
- evidence items provenance summary
- draft provenance summary if available
- ORX output/candidate provenance summary if available
- publish audit provenance summary if available
- missing provenance counts
- orphan evidence indicators
- orphan draft indicators
- evidence without source URL
- evidence without quote/snippet
- evidence without raw page or source page link
- evidence without extraction method
- AI evidence without model/provider
- high-impact fields missing provenance
- confidence missing or low-confidence summary
- conflict candidates if detectable
- trace ID coverage
- timestamp coverage
- content hash coverage where available
- per-section PASS/WARN/FAIL status
- blocking issues list
- recommended next safe action
- no-write verification statement

## PASS/WARN/FAIL Meaning

| Status | Meaning |
|---|---|
| PASS | Required lineage fields are present for that section. |
| WARN | Optional data is unavailable, low confidence exists, content hash is incomplete, or the section is not yet produced by the current runtime gates. |
| FAIL | Required provenance is missing, evidence rows are absent, raw/page/evidence lineage is broken, high-impact facts are incomplete, or a future publishable record lacks evidence IDs. |

The script fails closed on missing identifiers, missing Supabase env, missing run/item rows, and required table read failures.

## High-impact Field Rules

High-impact fields are flagged when provenance is incomplete. These include:

- tuition
- fees
- deadlines
- language requirements
- admission requirements
- apply URL
- scholarships
- accreditation
- career outcomes
- ORX score-impacting signals
- student eligibility-impacting requirements

High-impact fields should not move to review, ORX, student evaluation, CRM, public pages, trust badges, data APIs, or publish unless source URL, quote/snippet, extraction method, confidence, and AI model/provider metadata where relevant are present or explicitly unavailable with review rationale.

## Failure Behavior

The audit fails closed when:

- neither `--run-id` nor `--run-item-id` is provided
- Supabase env vars are missing
- `crawler_runs` cannot be read
- `crawler_run_items` cannot be read
- `raw_pages` cannot be read
- `crawler_page_candidates` cannot be read
- `evidence_items` cannot be read
- `crawler_telemetry` cannot be read
- no run item exists for the provided ID
- a run has multiple items and no `--run-item-id` is provided
- no evidence rows exist for the item

Unavailable optional sections are reported as WARN instead of being invented.

## No-write Guarantee

The script uses SELECT-only Supabase REST requests. It does not call Edge Functions, Supabase RPC, crawler functions, AI providers, publish paths, queue mutations, or write APIs.

Mandatory verification statement:

> This provenance audit is diagnostic-only. It did not run crawler functions, queue mutations, Run All, country crawl, publish, ORX scoring, student eligibility, canonical writes, migrations, Edge Functions, workflows, scripts, external API calls, or language/i18n changes.

The only optional local write is the explicit `--out` report file requested by the operator.

## What Remains Blocked

The audit does not unlock production behavior. The following remain blocked until the required original runtime gates close and later implementation PRs explicitly approve the work:

- 1E Review Surface execution
- 4 Draft Writer promotion
- 5 ORX Mapper score-affecting use
- 6 Verify/Publish Gate
- publish
- canonical writes
- ORX score production
- student eligibility production
- CRM automation
- public pages
- public ORX display
- trust badges
- data APIs
- Run All
- country crawl

