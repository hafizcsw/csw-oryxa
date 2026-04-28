# Crawler v2 Requirement Hardness Benchmark

Status: offline deterministic benchmark
Roadmap item: P1-2 Program Requirement Hardness Benchmark
Door mapping: Door 5 Student Evaluation Layer

## Purpose

The Requirement Hardness Benchmark validates future Door 5 Student Evaluation rules for classifying university and program requirement snippets. It is designed to reduce false-positive eligibility risk before any student-facing production logic exists.

This is not crawler execution, not student eligibility production, and not a new student evaluation system. It is a deterministic offline benchmark over hardcoded mock cases.

## Why This Is P1

P1 contains simulation and benchmarkable evidence improvements that can run before the original Crawler v2 runtime gates close. Requirement hardness is benchmarkable because it can use saved or synthetic requirement snippets without live crawler execution, Supabase access, external APIs, or AI providers.

The benchmark supports the Door 5 rule that hard, soft, conditional, document, financial, visa, post-admission, recommended, competitive, and unclear requirements must be separated before any later student matching prototype.

## Door 5 Mapping

Door 5 defines student evaluation as evidence-first, human-reviewable, and blocked from production decisions. This benchmark maps to:

- Program Requirement Hardness Classifier
- Student-Program Eligibility Matcher prerequisites
- Decision Confidence Engine prerequisites
- Official Apply Pack prerequisites
- Deadline Radar prerequisites
- Country/Visa/Budget risk layer boundaries

It does not create eligibility decisions. It only tests whether requirement snippets classify into safe review labels.

## Relationship To P0-1 Evidence Pack

The Evidence Pack provides future runtime inputs such as source URLs, extracted requirement text, timestamps, trace IDs, and unavailable markers. This benchmark does not read Evidence Packs yet; it uses hardcoded cases so it can run offline with no environment variables.

Later, saved Evidence Pack snippets can become benchmark fixtures only after a separate PR approves that scope.

## Relationship To P0-2 Queue Controls Validation

Queue Controls Validation checks whether run or item state is safe for future queue actions. This benchmark does not inspect queue state and cannot execute pause, resume, stop, retry, or selected-stage actions.

Both tools are read-only and diagnostic-only.

## Relationship To P0-3 Provenance Audit

The Provenance Audit checks whether facts preserve source, quote, trace, method, and related evidence fields. This benchmark assumes each mock case has a source type and input snippet, then validates classification and safety behavior.

This benchmark does not touch Claude's P0-3 provenance audit files.

## Relationship To P1-1 Review Quality Benchmark

The Review Quality Benchmark validates Door 2 review rules such as confidence, conflicts, weak claims, and review lanes. This Requirement Hardness Benchmark extends that safety posture into Door 5 by checking classification labels that would later feed student evaluation previews.

Both benchmarks keep production actions blocked.

## What It Tests

### Language Requirements

Cases cover:

- IELTS minimum score
- TOEFL minimum score
- PTE minimum score
- Duolingo minimum score
- CEFR level
- English proficiency recommended
- English test waiver wording
- language certificate required after admission

Explicit minimum scores classify as `hard_requirement`. Waiver and conditional wording requires review or classifies as a non-blocking soft requirement. Post-admission wording classifies as `post_admission_requirement`.

### Academic Requirements

Cases cover:

- GPA minimum
- bachelor degree in related field
- math prerequisite
- programming background required
- portfolio required
- research proposal required
- interview required
- entrance exam required
- preferred background
- recommended preparation
- ambiguous academic wording

Mandatory academic wording classifies as `hard_requirement`. Required files classify as `document_requirement`. Preferred wording classifies as `competitive_requirement`. Recommended preparation classifies as `recommended_requirement`. Ambiguous wording classifies as `unknown_or_needs_review`.

### Document Requirements

Cases cover:

- passport copy
- transcript
- diploma
- CV
- motivation letter
- recommendation letter
- financial proof
- translated or notarized documents

Document evidence classifies as `document_requirement`, except financial proof can classify as `financial_requirement` with document-related secondary flags.

### Financial / Visa / Country Requirements

Cases cover:

- proof of funds
- bank statement
- visa support documents
- medical insurance
- apostille/legalization
- migration card
- residence permit
- tuition prepayment
- deposit

These classify as `financial_requirement`, `visa_requirement`, `document_requirement`, or `post_admission_requirement` with secondary flags when applicable.

### Deadline / Apply URL / Scholarship Requirements

Cases cover:

- explicit deadline
- rolling admissions
- scholarship deadline
- separate scholarship application
- official application portal
- missing apply URL

Explicit dates classify as hard requirements. Rolling admissions and scholarship application wording require careful review. Missing apply URL classifies as `unknown_or_needs_review` and remains blocked.

### Ambiguity And Conflict Cases

Cases cover:

- may be required
- usually required
- recommended
- strongly encouraged
- conflicting language scores
- general admissions page versus program page
- old PDF versus current program page

Ambiguous cases require human review. Conflicts never silently produce hard eligibility and remain blocked from production recommendation.

### Production Guard

Every case asserts that these remain blocked:

- student eligibility production
- CRM automation
- publish
- ORX scoring

## What It Does Not Test

This benchmark does not:

- read Supabase
- require environment variables
- call external APIs
- call AI providers
- run crawler functions
- run Run All
- run country crawl
- publish
- write canonical universities, programs, university media, or ORX scores
- mutate queue state
- implement student eligibility production
- implement CRM automation
- implement Review Workbench UI
- change crawler extraction logic
- change ORX scoring logic
- change language or i18n behavior

## How To Run

Default JSON output:

```bash
node scripts/crawler-v2-requirement-hardness-benchmark.mjs
```

Markdown output:

```bash
node scripts/crawler-v2-requirement-hardness-benchmark.mjs --format markdown
```

Strict mode:

```bash
node scripts/crawler-v2-requirement-hardness-benchmark.mjs --strict
```

Write a local JSON report only when explicitly requested:

```bash
node scripts/crawler-v2-requirement-hardness-benchmark.mjs --out crawler-v2-requirement-hardness-benchmark-report.json
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
- classification_distribution
- high_impact_review_count
- ambiguous_review_count
- conflict_blocked_count
- production_guard_failures
- no_write_no_network_no_production_verification_statement
- cases

Each case includes:

- case_id
- domain
- input_text
- source_type
- field
- expected_classification
- actual_classification
- expected_secondary_flags
- actual_secondary_flags
- expected_human_review
- actual_human_review
- expected_blocking
- actual_blocking
- confidence_score
- ambiguity_status
- conflict_status
- high_impact_status
- production_allowed
- student_eligibility_production_allowed
- crm_automation_allowed
- publish_allowed
- orx_scoring_allowed
- pass
- reasons

## Classification Rules

The benchmark uses these labels:

| Classification | Meaning |
|---|---|
| `hard_requirement` | Mandatory requirement that can block eligibility in a future reviewed system |
| `soft_requirement` | Conditional or flexible requirement that cannot silently block eligibility |
| `document_requirement` | Required application document or file |
| `visa_requirement` | Visa, immigration, residence, insurance, or arrival-related requirement |
| `financial_requirement` | Funds, bank statement, tuition prepayment, deposit, or financial proof requirement |
| `post_admission_requirement` | Requirement due after admission or before enrollment |
| `recommended_requirement` | Recommended preparation or action |
| `competitive_requirement` | Preferred or strongly encouraged factor that may affect competitiveness but not base eligibility |
| `unknown_or_needs_review` | Ambiguous, missing, stale, or conflicting requirement that must not drive eligibility |

Secondary flags preserve additional context such as `minimum_score`, `deadline`, `financial_requirement`, `visa_requirement`, `document_requirement`, `conflict`, `stale_source`, `missing_source`, and `ambiguous`.

## Strict Mode

`--strict` exits non-zero if any case fails. This is intended for local acceptance checks and future CI only if a later PR explicitly approves workflow use.

## Failure Behavior

The benchmark fails closed:

- invalid CLI arguments exit non-zero
- unknown formats exit non-zero
- failed cases exit non-zero in strict mode
- missing apply URL classifies as `unknown_or_needs_review`
- ambiguity requires review
- conflicts block production recommendation
- production actions are hard-blocked in every case

## No-Network And No-Write Guarantee

The benchmark uses plain Node.js with hardcoded mock cases. It does not require environment variables and does not perform network or database calls.

Mandatory verification statement:

> This requirement hardness benchmark is offline and diagnostic-only. It did not read Supabase, run crawler functions, Run All, country crawl, publish, ORX scoring, student eligibility production, CRM automation, canonical writes, migrations, Edge Functions, workflows, scripts, external API calls, AI providers, or language/i18n changes.

The only optional local write is the explicit `--out` report file requested by the operator.

## What Remains Blocked

This benchmark does not unlock production behavior. The following remain blocked until the required runtime gates close and later implementation PRs explicitly approve them:

- verified program requirement production
- student eligibility production
- student AI advisor decisions
- CRM automation
- application checklist production
- deadline alerts
- country policy ingestion
- public recommendations
- publish
- canonical writes
- ORX scoring
- Run All
- country crawl

