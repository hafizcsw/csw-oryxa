# Crawler v2 ORX Signal Benchmark

Status: offline deterministic benchmark
Roadmap item: P1-3 ORX Signal Candidate Benchmark
Door mapping: Door 4 ORX Evidence Layer

## Purpose

The ORX Signal Benchmark validates future Door 4 rules for turning crawler evidence into ORX signal candidates without producing ORX scores. It separates evidence into candidate, review, reject, or blocked decisions and keeps every output benchmark-only.

This is not production ORX implementation. It does not calculate final ORX scores, write ORX scores, publish ORX outputs, or expose public ranking behavior.

## Why This Is P1

P1 contains simulation and benchmarkable evidence improvements that can run before original Crawler v2 runtime gates close. ORX signal candidacy can be benchmarked offline because it only needs saved or synthetic evidence snippets, source type, provenance status, conflict status, and anti-gaming labels.

The benchmark supports the roadmap requirement that unsupported or high-error signals must not be proposed for score production.

## Door 4 Mapping

Door 4 defines how crawler evidence may later support ORX signal candidates, explanations, improvement guidance, and anti-gaming controls. This benchmark maps to:

- ORX Evidence Integration
- ORX Signal Candidates
- ORX Curriculum and Future Readiness Evidence Agent
- curriculum updates
- course/module changes
- learning outcomes
- AI/data/automation exposure
- industry advisory boards
- internships/co-op/capstone
- employer partnerships
- career outcomes
- employment reports
- accreditation and quality assurance
- annual reports
- research labs and AI centers
- startup incubators
- digital learning infrastructure
- career services
- student/international support
- ORX Anti-gaming
- published ORX signal verified-error strategy

It does not map evidence into production scores. It only validates candidate safety and review routing.

## Relationship To P0-1 Evidence Pack

The Evidence Pack provides future runtime inputs for this benchmark:

- source URL
- evidence quote
- source type
- extraction method
- model/provider when AI-derived
- timestamps
- trace IDs
- unavailable markers

This first benchmark uses hardcoded cases so it can run offline with no environment variables.

## Relationship To P0-2 Queue Controls Validation

Queue Controls Validation checks whether run and item states are safe for future queue actions. This benchmark does not inspect queue state and cannot execute pause, resume, stop, retry, selected-stage runs, crawler functions, or any ORX mapper behavior.

Both tools keep production effects blocked.

## Relationship To P0-3 Provenance Audit

The Provenance Audit checks whether evidence preserves source, quote, trace, method, and related provenance fields. This benchmark uses mock provenance states and validates how ORX signal decisions respond to complete, missing, conflicting, stale, weak, or AI-derived evidence.

This benchmark does not touch Claude's P0-3 provenance audit files.

## Relationship To P1-1 Review Quality Benchmark

The Review Quality Benchmark validates Door 2 review behavior: confidence, conflicts, weak marketing claims, high-impact blocking, and review lanes. This ORX benchmark uses the same safety posture for ORX-specific signal candidates.

Marketing-only claims remain rejected from ORX impact.

## Relationship To P1-2 Requirement Hardness Benchmark

The Requirement Hardness Benchmark validates Door 5 student-evaluation labels. This ORX benchmark is separate: it checks ORX signal evidence only and does not classify admissions requirements or produce student eligibility decisions.

Both benchmarks are offline and production-blocked.

## What It Tests

### Curriculum And Future Readiness

Cases cover:

- dated curriculum revision with named AI/ML module
- course/module change without date
- learning outcomes mentioning practical skills
- vague future-ready curriculum

Dated specific changes can become signal candidates. Undated changes require review. Marketing-only claims are rejected and must not affect ORX.

### AI / Data / Automation Exposure

Cases cover:

- named AI module
- named data science module
- AI lab or research center official page
- generic AI-powered education
- AI mentioned only in news or marketing

Specific curricular or lab evidence can become a candidate. News-only evidence requires review. Marketing-only AI claims are rejected.

### Industry Alignment

Cases cover:

- named employer partnership
- industry advisory board
- required internship or co-op
- capstone with companies
- vague strong industry links

Named and specific evidence can become a candidate. Vague claims are rejected or routed to review.

### Career Outcomes

Cases cover:

- published graduate employment outcome
- salary or employment report
- career services page only
- vague excellent career opportunities or outcomes

Published outcomes can become candidates. Career services alone is weak and requires review. Vague claims are rejected.

### Accreditation / Quality Assurance

Cases cover:

- official accreditation document
- quality assurance report
- annual report metric
- old or undated accreditation

Official dated accreditation and quality evidence can become candidates. Old or undated evidence requires review.

### Research / Labs / Startup / Digital Infrastructure

Cases cover:

- official AI center
- research lab with relevant domain
- startup incubator
- digital learning infrastructure
- international support
- generic innovation page

Specific official assets can become candidates. Generic pages are weak and may be rejected or routed to review.

### Anti-gaming / Weak Marketing Claims

Weak claims tested include:

- world-class
- future-ready
- innovative
- global leader
- excellent outcomes
- industry focused

These must not create accepted ORX signals and must not affect ORX scores.

### Conflict / Missing Provenance

Cases cover:

- conflicting curriculum year
- conflicting employment outcome
- missing source URL
- missing quote
- AI-derived evidence without model/provider
- high-impact signal with low confidence

Conflicts require human review. Missing source or quote blocks the candidate. AI-derived evidence without model/provider metadata requires review.

### Production Guard

Every case asserts that these remain blocked:

- ORX score production
- ORX score writes
- publish
- public ORX display
- university dashboard ORX improvement output as production

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
- implement ORX Mapper
- implement ORX scoring
- calculate final ORX scores
- implement public ORX explanations
- implement university dashboard guidance
- implement CRM automation
- implement student eligibility production
- change crawler extraction logic
- change language or i18n behavior

## How To Run

Default JSON output:

```bash
node scripts/crawler-v2-orx-signal-benchmark.mjs
```

Markdown output:

```bash
node scripts/crawler-v2-orx-signal-benchmark.mjs --format markdown
```

Strict mode:

```bash
node scripts/crawler-v2-orx-signal-benchmark.mjs --strict
```

Write a local JSON report only when explicitly requested:

```bash
node scripts/crawler-v2-orx-signal-benchmark.mjs --out crawler-v2-orx-signal-benchmark-report.json
```

## Output Fields

The overall report includes:

- total_cases
- passed_cases
- failed_cases
- pass_rate
- failures_list
- domain_breakdown
- decision_distribution
- signal_category_distribution
- anti_gaming_rejection_count
- human_review_count
- conflict_blocked_count
- production_guard_failures
- no_write_no_network_no_production_verification_statement
- cases

Each case includes:

- case_id
- domain
- input_text
- source_type
- entity_type
- signal_category
- expected_decision
- actual_decision
- expected_human_review
- actual_human_review
- expected_anti_gaming_flag
- actual_anti_gaming_flag
- expected_conflict_status
- actual_conflict_status
- expected_signal_category
- actual_signal_category
- confidence_score
- source_strength
- provenance_status
- production_allowed
- orx_score_allowed
- pass
- reasons

## Signal Decision Rules

The benchmark uses four decisions:

| Decision | Meaning |
|---|---|
| `candidate` | Specific official evidence is complete enough to become an internal ORX signal candidate |
| `review` | Evidence is plausible but needs human review because it is weak, undated, news-only, conflicting, AI-derived without metadata, or low confidence |
| `reject` | Evidence is weak marketing, anti-gaming risk, or unsupported by factual proof |
| `blocked` | Evidence lacks required provenance such as source URL or quote |

Candidate does not mean score. Candidate means “may enter Ready for ORX review later.”

## Anti-gaming Rules

Marketing-only claims are rejected from ORX impact. The benchmark flags weak terms such as:

- world-class
- future-ready
- innovative
- global leader
- excellent outcomes
- industry focused
- AI-powered education
- strong industry links

Repeated buzzwords, vague claims, and unsupported institutional slogans must not become accepted ORX signals.

## Strict Mode

`--strict` exits non-zero if any case fails. This is intended for local acceptance checks and future CI only if a later PR explicitly approves workflow use.

## Failure Behavior

The benchmark fails closed:

- invalid CLI arguments exit non-zero
- unknown formats exit non-zero
- failed cases exit non-zero in strict mode
- missing source URL blocks the candidate
- missing quote blocks the candidate
- conflicts require human review
- marketing-only claims are rejected
- production actions are hard-blocked in every case

## No-Network And No-Write Guarantee

The benchmark uses plain Node.js with hardcoded mock cases. It does not require environment variables and does not perform network or database calls.

Mandatory verification statement:

> This ORX signal benchmark is offline and diagnostic-only. It did not read Supabase, run crawler functions, Run All, country crawl, publish, ORX scoring, student eligibility production, CRM automation, canonical writes, migrations, Edge Functions, workflows, scripts, external API calls, AI providers, or language/i18n changes.

The only optional local write is the explicit `--out` report file requested by the operator.

## Why It Does Not Calculate ORX Scores

Door 4 allows signal candidate benchmarking, not score production. ORX score production is blocked until ORX Mapper and Verify/Publish Gate close. A signal candidate in this benchmark is only a labeled evidence item for later review and mapping; it has no numeric score, weight, ranking effect, public display, or university dashboard production effect.

## What Remains Blocked

The following remain blocked until ORX Mapper and Verify/Publish Gate close and a later implementation PR explicitly approves the work:

- ORX score production
- `orx_scores` writes
- public ORX explanations
- public ORX display
- trust badges
- public rankings
- university dashboard ORX improvement output
- CRM automation
- publish
- canonical writes
- Run All
- country crawl

