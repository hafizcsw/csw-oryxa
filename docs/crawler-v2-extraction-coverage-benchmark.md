# Crawler v2 Extraction Coverage Benchmark

Status: offline deterministic benchmark
Roadmap item: P1-4 Extraction Coverage Benchmark
Door mapping: Door 3 Extraction Expansion

## Purpose

The Extraction Coverage Benchmark validates whether future Crawler v2 expansion candidates should be prioritized, reviewed, blocked, rejected, or skipped before any production crawler expansion work begins.

It is not crawler implementation. It does not fetch pages, render JavaScript, read PDFs, run OCR, call AI, call Supabase, mutate data, publish facts, or change canonical records.

## Why This Is P1

P1 is for simulation and benchmarkable evidence improvements that can run before the remaining original runtime gates close. Extraction coverage decisions can be tested offline because they use deterministic mock inputs: URL type, source type, evidence value, provenance state, cost tier, conflict or ambiguity markers, and safety blockers.

This benchmark keeps Door 3 expansion ideas measurable while preserving Door 0 and Door 1 safety boundaries.

## Door 3 Mapping

Door 3 defines crawler expansion deltas above the current Crawler v2 engine. This benchmark maps to:

- Discovery Intelligence
- Deep Program Extraction
- PDF Intelligence
- JS-render fallback
- Multi-domain official handling
- Media/file artifact intelligence
- Crawl Ethics / Politeness
- Crawler Cost Brain
- Evidence Freshness SLA
- Change Detection

The benchmark only validates decision rules. It does not create a new crawler, run a crawler, or modify extraction logic.

## Relationship To P0-1 Evidence Pack

The Evidence Pack is the future runtime input surface for extraction coverage decisions. It can provide run context, raw page counts, page candidate breakdowns, evidence counts, telemetry, trace IDs, failure details, and no-write verification.

This benchmark uses hardcoded cases so it can run without Supabase access.

## Relationship To P0-2 Queue Controls Validation

Queue Controls Validation inspects whether pause, resume, stop, retry, and selected-stage actions would be safe before queue mutation exists. This benchmark does not inspect queue state and does not execute queue actions.

Extraction coverage recommendations must remain subordinate to queue safety, duplicate-run checks, and selected-stage safety.

## Relationship To P0-3 Provenance Audit

The Provenance Audit checks whether evidence, drafts, ORX-relevant outputs, and future publishable facts have source lineage. This benchmark assumes provenance states as mock inputs and validates the extraction decision that should follow.

Missing source URLs, missing quotes, ambiguous values, and high-impact changes are routed to review or blocked outcomes.

## Relationship To P1-1 Review Quality Benchmark

The Review Quality Benchmark validates Door 2 confidence, conflict, weak marketing, high-impact blocking, and lane routing. This extraction benchmark feeds the same review-first posture: high-impact ambiguity, missing provenance, and unsafe fallbacks do not become production facts.

## Relationship To P1-2 Requirement Hardness Benchmark

The Requirement Hardness Benchmark validates future Door 5 requirement labels. This extraction benchmark focuses on whether requirement-bearing pages and fields are worth targeting, reviewing, or blocking before any student eligibility use.

No case authorizes student eligibility production.

## Relationship To P1-3 ORX Signal Benchmark

The ORX Signal Benchmark validates future Door 4 signal-candidate decisions. This extraction benchmark identifies which pages, PDFs, artifacts, and changes might later supply ORX evidence.

No case authorizes ORX scoring, public ORX display, or university dashboard ORX production guidance.

## What It Tests

### Discovery Intelligence

Mock URL cases cover homepage, admissions, international admissions, program listings, tuition and fees, scholarships, accommodation, career services, quality assurance, annual report, strategic plan, sitemap, robots file, irrelevant news/blog pages, social links, and trusted third-party application portals.

Important official pages are prioritized. Irrelevant pages are skipped. Social and unrelated external pages are rejected. Sitemap and robots files are treated as discovery metadata, not content facts.

### Deep Program Extraction Target Coverage

Mock field cases cover program name, degree level, field, duration, credits/ECTS, tuition, deadline, start date, language of instruction, IELTS, TOEFL, PTE, Duolingo, CEFR, campus, delivery mode, apply URL, documents required, admission requirements, scholarships, career outcomes, curriculum modules, learning outcomes, internship/co-op/capstone, and accreditation.

High-impact program fields require source and quote provenance. Missing provenance blocks the case. Ambiguous values require review.

### PDF Intelligence Decisioning

Mock PDF cases cover program catalogue, tuition table, admissions guide, scholarship document, annual report, scanned PDF, generic brochure, and unrelated PDF.

High-value official PDFs are prioritized. Table-heavy PDFs are flagged as valuable future targets. Scanned PDFs are marked OCR-needed but not processed. Generic brochures stay low priority or review-only.

### JS-render Fallback Decisioning

Mock cases cover low text density static HTML, script-heavy pages, normal static program pages, broken pages, client-side admissions portals, and login-required pages.

Render fallback is only recommended for high-priority low-text or script-heavy pages. Login-required and broken pages are blocked. Normal static pages do not consume render cost.

### Multi-domain Official Handling

Mock cases cover the main university domain, official admissions subdomain, faculty subdomain, official application portal, third-party application vendor, unrelated domain, and social media page.

Official subdomains are trusted with reason. Third-party vendors require official-link provenance and review. Unrelated and social domains are not blindly trusted.

### Media / File Artifact Classification

Mock cases cover image galleries, program brochures, course catalogues, video transcripts, press releases, admissions PDFs, annual reports, and accreditation certificates.

Evidence-rich official artifacts are prioritized. Marketing-only media is low priority. No media processing is executed.

### Crawl Ethics / Politeness Decision Rules

Mock cases cover robots disallow markers, rate limits, repeated failures, HTTP 403, HTTP 429, timeouts, and high-depth crawl requests.

Unsafe crawl conditions block or delay coverage. Politeness overrides coverage goals.

### Crawler Cost Brain

Mock cases cover basic extraction sufficiency, AI due to ambiguity, render due to low text density, PDF table extraction, OCR cost, duplicate pages, and low-value pages.

Low-cost paths are preferred when sufficient. Expensive paths require high-value justification and review. Duplicate or low-value pages are skipped.

### Evidence Freshness / Change Detection Readiness

Mock cases cover changed deadlines, tuition, apply URLs, language requirements, curriculum, footer dates, and cosmetic text.

High-impact changes require review. Cosmetic changes are low priority. No public or student alerts are authorized.

## What It Does Not Test

This benchmark does not:

- run crawler functions
- run Run All
- run country crawl
- fetch pages
- render JavaScript
- extract PDF text or tables
- run OCR
- call Supabase
- call Edge Functions
- call external APIs
- call AI providers
- publish
- write canonical university, program, media, or ORX rows
- authorize student eligibility production
- authorize CRM automation
- modify crawler extraction logic
- modify language or i18n behavior

## How To Run

Default JSON output:

```bash
node scripts/crawler-v2-extraction-coverage-benchmark.mjs
```

Markdown output:

```bash
node scripts/crawler-v2-extraction-coverage-benchmark.mjs --format markdown
```

Strict mode:

```bash
node scripts/crawler-v2-extraction-coverage-benchmark.mjs --strict
```

Write a local JSON report only when explicitly requested:

```bash
node scripts/crawler-v2-extraction-coverage-benchmark.mjs --out crawler-v2-extraction-coverage-benchmark-report.json
```

## Output Fields

Each case includes:

- case_id
- domain
- input_summary
- source_type
- expected_decision
- actual_decision
- expected_priority
- actual_priority
- expected_reason
- actual_reason
- expected_human_review
- actual_human_review
- expected_cost_tier
- actual_cost_tier
- expected_production_allowed
- actual_production_allowed
- pass/fail
- reasons

The overall report includes:

- total cases
- passed cases
- failed cases
- pass rate
- failures list
- domain breakdown
- decision distribution
- priority distribution
- cost-tier distribution
- human review count
- blocked count
- production guard failures
- no-write/no-network/no-production verification statement

## Decision Rules

The benchmark uses five decisions:

- `prioritize`: valuable official candidate for future extraction coverage.
- `review`: candidate may be valuable, but ambiguity, cost, provenance, fallback, or trust requires human review.
- `reject`: candidate is untrusted, unrelated, or not valid evidence.
- `blocked`: candidate is unsafe or missing required provenance.
- `skip`: candidate is low-value, duplicate, cosmetic, or already covered by a cheaper path.

High-impact fields and changes are never allowed to bypass review when source lineage is missing or ambiguous.

## Crawl Ethics Rules

The benchmark blocks or delays crawler expansion recommendations when mock inputs indicate:

- robots disallow
- rate limiting
- HTTP 403
- HTTP 429
- repeated failures
- timeouts
- login-required pages
- high-depth crawl requests

These cases do not create a queue action, retry action, Run All action, or country crawl action.

## Cost-Brain Rules

The benchmark prefers the lowest-cost sufficient route:

- Basic extraction is enough when static text already covers the field.
- AI, rendering, PDF table extraction, and OCR require high-value justification and review.
- Duplicate and low-value pages are skipped.
- Expensive paths are recommendations only; they are not executed.

## Strict Mode

`--strict` exits non-zero if any benchmark case fails. This is intended for local deterministic checks and later CI-style validation if explicitly approved.

Strict mode still performs no network, database, crawler, rendering, OCR, PDF extraction, or production action.

## Failure Behavior

The benchmark fails closed:

- unknown CLI arguments return an error
- unsupported formats return an error
- failing benchmark cases are listed in the report
- strict mode returns a non-zero exit code on failures
- production guard failure is counted as a benchmark failure condition

## No-network / No-write Guarantee

The benchmark is offline. It uses only hardcoded mock cases and local report writing when `--out` is explicitly provided.

It does not require environment variables and does not print secrets because it does not read any.

Mandatory verification statement:

> This extraction coverage benchmark is offline and diagnostic-only. It did not read Supabase, run crawler functions, Run All, country crawl, publish, ORX scoring, student eligibility production, CRM automation, canonical writes, migrations, Edge Functions, workflows, scripts, external API calls, AI providers, rendering, OCR, PDF extraction, or language/i18n changes.

## Why It Does Not Run Crawler / Render / OCR / PDF Extraction

P1-4 is a benchmark gate, not an extraction feature. Door 3 implementation must remain blocked until original runtime gates and review/provenance gates are closed enough to make expansion safe.

The benchmark proves decision rules first. Actual crawler execution, rendering, OCR, and PDF extraction remain future prototype or production work.

## Blocked Until Runtime Gates Close

The following remain blocked:

- crawler execution for expansion candidates
- Run All
- country crawl
- publish
- canonical writes
- ORX scoring
- student eligibility production
- CRM automation
- public/student alerts from change detection
- public trust badges
- data APIs
- production JS rendering
- production OCR
- production PDF extraction

Door 3 can move toward prototypes only after the relevant original runtime gates, Door 2 review/provenance contracts, and Door 1 diagnostics safety constraints are satisfied.
