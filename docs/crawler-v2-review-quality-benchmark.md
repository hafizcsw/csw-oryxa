# Crawler v2 Review Quality Benchmark

Status: offline deterministic benchmark
Roadmap item: P1-1 Review Quality Benchmark
Door mapping: Door 2 Evidence & Review Workbench

## Purpose

The Review Quality Benchmark validates the future Door 2 Evidence & Review Workbench rules before production implementation begins. It checks whether saved or synthetic review facts would be routed safely across confidence, conflict, weak-claim, and human-review rules.

This is not crawler execution and not production review logic. It is a deterministic contract benchmark that can fail closed when a future change weakens the review rules.

## Why This Is P1

P0 established read-only diagnostics and queue validation. P1 starts benchmarkable evidence improvements that can run before the remaining original Crawler v2 runtime gates close.

This benchmark is P1 because it exercises the planned Review Workbench behavior without requiring:

- Supabase access
- crawler functions
- Edge Functions
- external APIs
- AI providers
- canonical writes
- publish
- ORX score production
- student eligibility production

## Door 2 Mapping

The benchmark maps to Door 2 rules for:

- Confidence Engine
- Official Conflict Resolver
- Weak Marketing Claim Detector
- Human Review Triggers
- high-impact field blocking
- Safe Publish Sandbox guardrails
- Review Workbench lane routing

The lanes tested are:

- Critical
- Conflicts
- Needs Evidence
- Low Confidence
- Ready for Draft
- Ready for ORX
- Blocked

Each mock case must route to exactly one primary lane. Secondary flags may exist, but they must not create multiple primary lanes.

## Relationship To P0-1 Evidence Pack

The Evidence Pack provides the read-only runtime facts that future versions of this benchmark can evaluate:

- source URLs
- evidence quotes
- extraction method
- model/provider metadata
- trace IDs
- telemetry
- timestamps
- blocked stage markers

This first benchmark uses hardcoded cases so it can run offline with no environment variables.

## Relationship To P0-2 Queue Controls Validation

Queue Controls Validation determines whether run/item control actions are safe to consider. This benchmark does not validate queue mutations. It only validates whether evidence review recommendations remain safe and non-production.

Both tools share the same safety posture:

- no queue mutation
- no crawler execution
- no publish
- no production output

## Relationship To P0-3 Provenance Audit

The Provenance Audit checks whether evidence rows or packs preserve required provenance. This benchmark assumes provenance fields exist in each mock case and tests how review rules respond when source, quote, confidence, conflict, or AI metadata is missing or weak.

The benchmark intentionally does not touch Claude's P0-3 provenance audit files.

## What It Tests

### Confidence Engine

The benchmark covers:

- official source plus quote plus fresh timestamp plus no conflict producing high-confidence routing
- official source plus weak quote plus old timestamp producing medium or low confidence
- missing quote producing Needs Evidence
- missing source URL producing Needs Evidence
- AI-derived evidence without model/provider metadata producing a warning or failure depending field impact
- high-impact low-confidence evidence requiring human review

### Official Conflict Resolver

The benchmark covers:

- program page versus general admissions page
- tuition page versus marketing page
- latest dated official document versus old PDF
- conflicting deadline values
- conflicting tuition values
- unresolved conflict requiring human review
- no silent winner when high-impact sources are close in authority

### Weak Marketing Claim Detector

The benchmark rejects weak claims from ORX score-impacting acceptance, including:

- world-class
- future-ready
- innovative education
- global leader
- excellent career opportunities

It also includes strong evidence examples:

- named AI module added in a curriculum
- named employer partnership
- required internship/co-op/capstone
- published employment outcome
- official accreditation
- dated curriculum revision
- official annual report metric

### Human Review Triggers

Human review is required for high-impact fields when confidence is low, conflict exists, quote or source is missing, or evidence is AI-only.

High-impact fields include:

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

### No-Production Guard

Every benchmark case must keep these actions blocked:

- publish
- ORX scoring
- student eligibility production
- CRM automation

## What It Does Not Test

This benchmark does not:

- read Supabase
- read environment variables
- call external APIs
- call AI providers
- run crawler functions
- run Run All
- run country crawl
- publish
- write canonical universities, programs, university media, or ORX scores
- mutate queue state
- implement Review Workbench UI
- implement production Confidence Engine logic
- implement production conflict resolution
- implement production ORX scoring
- implement production student eligibility
- change language or i18n behavior

## How To Run

Default JSON output:

```bash
node scripts/crawler-v2-review-quality-benchmark.mjs
```

Markdown output:

```bash
node scripts/crawler-v2-review-quality-benchmark.mjs --format markdown
```

Strict mode:

```bash
node scripts/crawler-v2-review-quality-benchmark.mjs --strict
```

Write a JSON report file:

```bash
node scripts/crawler-v2-review-quality-benchmark.mjs --out crawler-v2-review-quality-benchmark-report.json
```

## Output Fields

The overall report includes:

- benchmark
- status
- total_cases
- passed_cases
- failed_cases
- pass_rate
- failures_list
- domain_breakdown
- lane_distribution
- high_impact_review_count
- weak_marketing_rejection_count
- conflict_review_count
- no_write_no_network_no_production_verification_statement
- cases

Each case includes:

- case_id
- domain
- input_summary
- expected_lane
- actual_lane
- expected_human_review
- actual_human_review
- expected_publish_allowed
- actual_publish_allowed
- orx_scoring_allowed
- student_eligibility_production_allowed
- crm_automation_allowed
- confidence_score
- conflict_status
- weak_marketing_claim_status
- high_impact_field_status
- safe_review_recommendation
- pass
- reasons

## Strict Mode

`--strict` exits non-zero when any benchmark case fails. This is useful for local acceptance checks and future CI only if a later PR explicitly approves workflow use.

## Failure Behavior

The benchmark fails closed:

- invalid CLI arguments exit non-zero
- unknown output formats exit non-zero
- failed benchmark cases exit non-zero in strict mode
- production actions are hard-blocked in every case

## No-Network And No-Write Guarantee

The benchmark uses plain Node.js with hardcoded mock cases. It does not require environment variables and does not perform network or database calls.

Mandatory verification statement:

> This review quality benchmark is offline and diagnostic-only. It did not read Supabase, run crawler functions, Run All, country crawl, publish, ORX scoring, student eligibility, canonical writes, migrations, Edge Functions, workflows, scripts, external API calls, AI providers, or language/i18n changes.

The only optional local write is the explicit `--out` report file requested by the operator.

## What Remains Blocked

The benchmark does not unlock production behavior. The following remain blocked until the required runtime gates close and later implementation PRs explicitly approve them:

- Review Workbench production UI
- publish
- canonical writes
- ORX score production
- student eligibility production
- CRM automation
- public trust badges
- public university pages
- data APIs
- Run All
- country crawl
