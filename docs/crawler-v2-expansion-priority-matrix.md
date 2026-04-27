# Crawler v2 Expansion Priority Matrix

Status: simulation prioritization only  
Baseline: original Crawler v2 remains the source of truth  
Scope: sequencing, blocked gates, and prototype order for docs-only planning

## Executive Snapshot

The expansion program should be handled as a simulation queue, not an implementation queue. The current engine has enough runtime proof to simulate evidence packs, benchmarks, provenance, change detection, discovery quality, and ORX signal candidates. It does not yet have enough runtime proof to build public pages, publish gates, ORX scores, student eligibility decisions, or CRM automation.

Priority is based on four criteria:

- It helps close the original Crawler v2 plan.
- It can run against saved snapshots without live crawler or Supabase changes.
- It increases evidence trust before increasing product surface area.
- It blocks risky public/student/CRM outputs until 1E, 2, 4, 5, and 6 are runtime closed.

## Existing Engine Baseline

| Stage | Runtime status | Planning implication |
|---|---:|---|
| 1A Control/Admin/Create Run | Closed | May anchor simulation cohorts and run metadata |
| 1B Worker/Homepage Fetch | Closed | May provide saved fetch evidence |
| 1C Page Planner | Closed | May benchmark page discovery and official-source coverage |
| 1D Basic Extract | Closed | May benchmark deterministic extraction and evidence quality |
| 1E Review Surface | Not closed | Blocks human review workflows and reviewer-facing products |
| 2 Queue Controls | Not closed | Blocks retry, selected-stage runner, duplicate-run enforcement |
| 3 AI Extract | Closed | May be simulated offline only from saved text |
| 4 Draft Writer | Not closed | Blocks draft-dependent program, eligibility, and apply-pack outputs |
| 5 ORX Mapper | Not closed | Blocks score-affecting ORX work |
| 6 Verify/Publish Gate | Not closed | Blocks public, canonical, publish, trust badge, CRM-ready truth |

## Priority Method

| Score | Meaning |
|---:|---|
| P0 | Helps close original runtime plan or prevents unsafe expansion |
| P1 | High-value simulation now, no live crawler or schema changes |
| P2 | Prototype later after relevant original stages close |
| P3 | Delay until production truth boundary, external source policy, or legal review exists |
| R | Reject for now because it conflicts with current constraints or is too speculative |

| Block code | Meaning |
|---|---|
| None | Can be simulated now with saved/local evidence |
| 1E | Blocked by Review Surface runtime closure |
| 2 | Blocked by Queue Controls runtime closure |
| 4 | Blocked by Draft Writer runtime closure |
| 5 | Blocked by ORX Mapper runtime closure |
| 6 | Blocked by Verify/Publish Gate runtime closure |
| External | Needs external source policy/API/legal review later |

## Expansion Map

### Operations / Current Engine Extension

| Priority | Idea | Recommendation | Blocks | Simulation-ready next step | Promote only when |
|---:|---|---|---|---|---|
| P0 | Queue Controls validation | Keep | 2 | Define isolated pause/resume/stop/retry test cases | 2 runtime tests pass |
| P0 | Smoke Diagnostics / Evidence Pack | Keep | partial 1E/4/5/6 | Build no-write pack spec from saved run outputs | Pack covers every closed stage |
| P0 | Provenance model | Keep | 4/6 | Audit existing draft/evidence rows for missing URL/snippet/hash | Every proposed fact has provenance or null reason |
| P0 | Human Review Triggers | Keep | 1E/6 | Simulate trigger rules on labeled evidence packs | Review queue runtime is closed |
| P0 | Safe Publish Sandbox | Keep | 6 | Define dry-run diff contract with zero writes | Publish gate runtime is closed |
| P1 | Duplicate Run Guard | Keep | 2 | Simulate duplicate intent keys over historical run scopes | Queue controls enforce run state |
| P1 | Failure Classifier | Keep | partial 4/5/6 | Classify existing ingest_errors/log packs | Classifier agrees with reviewers |
| P1 | Benchmarking System | Keep | None | Create golden-pack criteria and measurement thresholds | Golden labels are stable |
| P1 | Full Pipeline Orchestrator above existing stages | Keep | 2/4/5/6 | Simulate read-only stage supervisor | All original stages are closed |
| P1 | Dedupe Engine | Keep | 4/5 | Benchmark duplicate draft clustering | Draft writer is stable |
| P2 | Retry Policy | Benchmark First | 2 | Backtest retry decisions on failed URL snapshots | Queue controls are closed |
| P2 | Safe selected-stage runner | Keep | 2/4/5/6 | Specify precondition and refusal rules | Stage selection cannot trigger publish |
| P2 | Agent-neutral handoff | Keep | 1E | Draft standard handoff template from evidence pack | Review surface is closed |

### Crawler Expansions

| Priority | Idea | Recommendation | Blocks | Simulation-ready next step | Promote only when |
|---:|---|---|---|---|---|
| P1 | Discovery Intelligence | Keep | production 2/4 | Compare planned pages with known useful pages | Useful-page lift beats baseline |
| P1 | Evidence Freshness SLA | Keep | 6 | Identify stale, dated, and undated evidence in snapshots | Gate can enforce freshness |
| P1 | Change Detection | Keep | 4/6 | Replay old/new page snapshots by content hash and semantic diff | Draft/publish effects are dry-run safe |
| P1 | Crawl Ethics / Politeness | Keep | 2 | Simulate per-host budgets and stop rules | Queue controls can enforce limits |
| P2 | Deep Program Extraction | Benchmark First | 4 | Label program pages and compare structured extraction | Draft writer is closed |
| P2 | PDF Intelligence | Benchmark First | 4/6 | Extract page-referenced facts from saved PDFs | Artifact facts can be reviewed |
| P2 | Multi-domain official handling | Benchmark First | 6 | Test root-linked official alias rules | Gate can reject unsafe aliases |
| P2 | Crawler Cost Brain | Benchmark First | partial 4/5/6 | Backtest cost per accepted fact | Accepted-fact definition is stable |
| P2 | JS-render fallback | Prototype Later | production 2 | Compare static vs rendered saved captures | Politeness and budget rules exist |
| P2 | Media/file artifact intelligence | Prototype Later | 6 | Inventory official artifacts from snapshots | Publish gate can prevent unsafe media |

### Evidence / Trust

| Priority | Idea | Recommendation | Blocks | Simulation-ready next step | Promote only when |
|---:|---|---|---|---|---|
| P0 | Provenance model | Keep | 4/6 | Enforce source URL, snippet, observed date, hash in pack | Draft and verify gates are closed |
| P0 | Benchmarking System | Keep | None | Build labeled evidence packs | Benchmarks become CI/manual gates later |
| P0 | Human Review Triggers | Keep | 1E/6 | Simulate triggers and reviewer burden | Review surface is runtime closed |
| P1 | Quality / Confidence Engine | Benchmark First | 1E/6 | Compare confidence against human labels | Confidence predicts reviewer agreement |
| P1 | Official Conflict Resolver | Keep | 1E/6 | Label conflict packs and route decisions | Conflict decisions are reviewable |
| P1 | Weak Marketing Claim Detector | Benchmark First | partial 1E | Label factual vs marketing claims | False accept rate is low |
| P2 | Evidence Knowledge Graph | Prototype Later | 5 | Model claim-source-entity links offline | ORX mapper is closed |
| P2 | Safe Publish Sandbox | Keep | 6 | Define no-write publish diff | Verify/publish gate is closed |

### ORX Rank Extensions

| Priority | Idea | Recommendation | Blocks | Simulation-ready next step | Promote only when |
|---:|---|---|---|---|---|
| P0 | Published ORX signal <=5% verified-error strategy | Keep | 5/6 | Define signal release threshold and holdout benchmark | Holdout error stays <=5% |
| P0 | ORX Anti-gaming | Keep | 5/6 | Create synthetic and real overclaim cases | Signal rules resist source inflation |
| P1 | ORX Evidence Integration | Keep | 5 | Map saved evidence to methodology v1.1 signals | Mapper links every score input |
| P1 | ORX Signal Candidates | Benchmark First | 5 | Benchmark candidate signal support | Signal has measurable lift and low error |
| P1 | ORX Curriculum and Future Readiness Evidence Agent | Benchmark First | 5/6 | Offline AI extraction from saved catalogs | <=5% verified error on golden pack |
| P1 | Curriculum updates | Keep | 5 | Detect last-updated/version evidence | Date extraction benchmark passes |
| P1 | Course/module changes | Keep | 4/5 | Diff old/new catalog snapshots | Material change labels are reliable |
| P1 | AI/data/automation exposure | Benchmark First | 5/6 | Label exposure levels from module text | Buzzword false positives are controlled |
| P1 | Internships/co-op/capstone | Benchmark First | 4/5 | Label required vs optional applied learning | Required/optional accuracy is high |
| P1 | Employer partnerships | Benchmark First | 5/6 | Label verified vs logo-only partnerships | Marketing-only claims are blocked |
| P1 | Career outcomes | Benchmark First | 5/6 | Verify year, cohort, denominator | Metrics are complete and current |
| P1 | Employment reports | Benchmark First | 5/6 | Extract metrics with PDF page refs | Table extraction is reviewable |
| P1 | Accreditation and quality assurance | Keep | 5/6 | Verify body, scope, current status | Expired/non-scope claims are blocked |
| P2 | Learning outcomes | Benchmark First | 4/5 | Label outcomes to skill families | Skill mapping is accurate |
| P2 | Strategic plans | Benchmark First | 5/6 | Separate commitments from delivered evidence | Aspirational claims are not scored |
| P2 | Research labs and AI centers | Prototype Later | 5 | Verify active lab evidence | Recent activity is proven |
| P2 | Startup incubators | Prototype Later | 5 | Verify services and outputs | Naming-only incubators are filtered |
| P2 | Digital learning infrastructure | Prototype Later | 5 | Verify active LMS/hybrid evidence | Vendor-name claims are filtered |
| P2 | Career services | Prototype Later | 5 | Label concrete services | Generic support copy is filtered |
| P2 | Student/international support | Prototype Later | 5 | Label concrete support services | Services are current and official |
| P2 | ORX University Improvement Guidance | Prototype Later | 1E/5 | Convert missing signals to action items | Human reviewers approve guidance |
| P3 | Annual reports | Prototype Later | 5 | Extract limited facts with page refs | Report facts add unique value |
| P3 | Faculty development | Delay | 5 | Explore label feasibility | Evidence is concrete enough |
| P3 | ORX Explanation Engine | Delay | 5/6 | Draft explanation contract only | ORX mapper and gate are closed |

### Student File Evaluation Extensions

| Priority | Idea | Recommendation | Blocks | Simulation-ready next step | Promote only when |
|---:|---|---|---|---|---|
| P1 | Program Requirement Hardness Classifier | Benchmark First | 4/6 | Label hard/soft/conditional/unclear requirements | False eligibility positives are low |
| P1 | Student-Program Eligibility Matcher | Benchmark First | 4/6 | Compare verified requirements to sample student evidence | Reviewers agree with decisions |
| P1 | Decision Confidence Engine | Keep | 1E/6 | Compare confidence against human decisions | Low-confidence cases route to review |
| P1 | Negative Recommendation Engine | Benchmark First | 4/6 | Test "no" decisions against hard evidence | No negative rec without citation |
| P1 | Official Apply Pack | Benchmark First | 4/6 | Build no-write checklist from official evidence | Every item cites source |
| P1 | Deadline Radar | Benchmark First | 4/6 | Label current-year deadline pages | Old-year dates are blocked |
| P2 | Student Evidence Parser | Prototype Later | verified reqs | Parse sample docs offline | Verified program requirements exist |
| P2 | Program Substitution Engine | Prototype Later | 4/6 | Rank alternatives for rejected cases | Substitutions are evidence-backed |
| P3 | Country/Visa/Budget risk layer | Delay | External/6 | Define source policy and risk taxonomy | Official country sources are approved |

### Psychological / Person-Program Fit

| Priority | Idea | Recommendation | Blocks | Simulation-ready next step | Promote only when |
|---:|---|---|---|---|---|
| P1 | Financial risk tolerance | Keep | 4/6 | Simulate conservative budget ranking with verified fees | Missing fees never imply affordability |
| P2 | Interests | Prototype Later | 4/6 | Map program descriptions to interest tags | Human advisors validate fit |
| P2 | Learning preference | Prototype Later | 4/6 | Label delivery mode and project style | Claims are official and current |
| P2 | Risk tolerance | Prototype Later | 6 | Simulate risk-adjusted shortlist ordering | Verified uncertainty signals exist |
| P2 | Career orientation | Prototype Later | 4/5/6 | Rank career-oriented programs by outcomes/applied learning | Outcome evidence is verified |
| P2 | Technical vs human-facing preference | Prototype Later | 4/6 | Label orientation from module/outcome text | Sensitive wording is reviewed |
| P2 | Research vs applied preference | Prototype Later | 4/5/6 | Label research/applied balance | Labs/capstone evidence is verified |
| P3 | Work values | Delay | 4/6 | Define non-sensitive explanation rules | Avoids stereotyping and overreach |
| P3 | Language/culture tolerance | Delay | 4/6/External | Define sensitive wording rules | Legal/human review approves language |
| P3 | Solo vs team preference | Delay | 4/6 | Test evidence availability | Enough official pedagogy evidence exists |

### Skills / Future of Work

| Priority | Idea | Recommendation | Blocks | Simulation-ready next step | Promote only when |
|---:|---|---|---|---|---|
| P1 | Program-to-skills mapping | Benchmark First | 4/5 | Label skill clusters from outcomes/modules | Skill hallucination rate is low |
| P1 | AI exposure | Benchmark First | 5/6 | Benchmark exposure levels | <=5% verified error |
| P1 | Transferability | Keep | 5 | Label broad vs narrow skill mix | Reviewer agreement is strong |
| P1 | ORX program future readiness | Benchmark First | 5/6 | Combine proven ORX-P signal candidates | Holdout benchmark passes |
| P2 | Skills-to-occupations mapping | Prototype Later | skill evidence | Use external taxonomy offline later | Skills evidence is stable |
| P2 | Skill durability | Benchmark First | 5 | Expert-label foundational vs tool-specific skills | Speculation is bounded |
| P2 | Student fit | Prototype Later | 4/6 | Advisor review of ranked shortlist | Requirements and skills are verified |
| P3 | Future demand | Delay | External | Define dated labor-market source policy | External evidence is approved |

### Country Layer

| Priority | Idea | Recommendation | Blocks | Simulation-ready next step | Promote only when |
|---:|---|---|---|---|---|
| P2 | Recognition/accreditation environment | Benchmark First | 5/6 | Verify recognition body, scope, date | Accreditation source policy is clear |
| P3 | Post-study work policy | Delay | External | Source policy design only | Official policy source and update cadence exist |
| P3 | Visa difficulty | Delay | External | Define advisor-reviewed risk taxonomy | Avoids sensitive overclaim |
| P3 | Work rights | Delay | External | Source policy design only | Official source/date is verified |
| P3 | Cost of living | Delay | External/6 | Define city-level cost source rules | Cost data is current and localized |
| P3 | Safety/stability | Delay | External/legal | Define legal/human review requirements | Sensitive content policy exists |
| P3 | Language barrier | Delay | 4/6/External | Define neutral support-based framing | Program and country sources are verified |
| P3 | Labor market demand | Delay | External | Source policy design only | Forecast methodology is approved |
| P3 | Tech ecosystem | Delay | External | Define source diversity rules | Hype is filtered |
| P3 | International student policy | Delay | External | Source policy design only | Official policy date is verified |

### Product Surfaces

| Priority | Idea | Recommendation | Blocks | Simulation-ready next step | Promote only when |
|---:|---|---|---|---|---|
| P0 | Admin Review Queue | Keep | 1E | Use trigger and evidence-pack design to close original stage | Review surface runtime is closed |
| P2 | CRM Case Handoff | Prototype Later | 1E/4/6 | Generate offline handoff from approved evidence pack | Facts are verified and reviewable |
| P2 | Student AI Advisor | Prototype Later | 6 | Test refusal/citation behavior on evidence packs | Advisor never cites unverified facts |
| P2 | Application Checklist | Prototype Later | 4/6 | Build no-write checklist from apply pack | Every item is sourced |
| P2 | Deadline Alerts | Benchmark First | 4/6 | Simulate alert rules from current-year deadline evidence | Old/stale dates are blocked |
| P2 | University Dashboard | Prototype Later | 1E/6 | Preview evidence gaps and conflicts | Dispute flow is reviewable |
| P3 | Student App | Delay | 4/6 | Define verified-data contract | Publish gate is closed |
| P3 | Public University Pages | Delay | 6 | Define preview-only page diff | Public facts are verified |
| P3 | ORX Public Explanation | Delay | 5/6 | Define explanation contract | ORX mapper and gate are closed |
| P3 | Trust Badges | Delay | 6 | Define badge thresholds only | Gate can enforce provenance |
| P3 | Data Products/API | Delay | 6/legal | Define license/provenance constraints | Legal/source policy is approved |

## Simulation Experiment Plan

| Prototype | Input pack | Output pack | Acceptance metric | Blocked production dependency |
|---|---|---|---|---|
| Evidence Pack | Saved run stats, source evidence, stage logs | Markdown/JSON-like run audit spec | 100% of proposed facts trace to source or null reason | Full coverage waits on 1E/4/5/6 |
| Provenance Audit | Existing program_draft and source_evidence rows | Missing provenance report | No high-stakes field without source URL/snippet/hash | 4/6 |
| ORX Signal Benchmark | Saved catalogs, PDFs, official pages, labels | Signal candidate scorecard | <=5% verified error for publishable signal subset | 5/6 |
| Requirement Hardness Benchmark | Official requirement snippets and labels | Hard/soft/conditional classifier report | Low false-positive eligibility risk | 4/6 |
| Change Detection | Old/new page snapshots | Material-change report | Detects field-changing updates and ignores noise | 4/6 |
| Deadline Radar Benchmark | Official deadline snippets and labels | Current/stale/ambiguous date classification | No old-year date accepted as current | 4/6 |
| Anti-gaming Benchmark | Real and synthetic claim packs | Suspicious-claim/source concentration flags | Blocks source-volume and buzzword inflation | 5/6 |

## Blocked Until Runtime Closed

| Blocked area | Why blocked | Required closure |
|---|---|---|
| Review-driven workflows | Reviewer decisions and queues are not runtime closed | 1E |
| Retry policies and stage selection | Queue state and controls are not runtime closed | 2 |
| Program eligibility, apply packs, substitutions | Draft facts are not runtime closed | 4 |
| ORX score mapping and explanations | Evidence-to-signal mapper is not runtime closed | 5 |
| Public pages, trust badges, CRM-ready truth, student advice | Verify/publish boundary is not runtime closed | 6 |
| Country policy and labor-market layers | Current source policy is undefined and time-sensitive | External policy plus 6 |

## What Must Not Be Built Yet

- New production orchestrator, crawler, simulation lab, Edge Function, migration, or workflow.
- Any code path that runs Crawler v2, Run All, country crawl, publish, or external API calls.
- Any update to canonical universities, programs, university_media, or orx_scores.
- Any crawler language-handling change or 12-locale crawler logic.
- Public ORX scores, public trust badges, public data API, or public university page writes.
- Student-facing eligibility decisions or AI advisor claims from unverified crawler facts.

## Recommended Next 5 Prototypes

| Rank | Prototype | Why first | Expected output |
|---:|---|---|---|
| 1 | Smoke Diagnostics / Evidence Pack | Helps close original runtime work and supports every later simulation | Standard evidence pack contract and sample pack from saved outputs |
| 2 | Queue Controls Validation | Unblocks safe retry, selected-stage runner, duplicate guard, and orchestrator work | Runtime test checklist for pause/resume/stop/retry |
| 3 | Provenance Model Audit | Prevents unsupported claims before any product expansion | Field-level missing provenance report and acceptance rules |
| 4 | ORX Signal Candidate Benchmark | Converts ORX ambition into measurable signal release decisions | Signal scorecard with keep/delay decisions and <=5% target |
| 5 | Program Requirement Hardness Benchmark | Directly supports student evaluation while staying offline | Labeled classifier benchmark and review-trigger rules |

## Files Changed

- `docs/crawler-v2-post-original-expansion-map.md`
- `docs/orx-student-evaluation-expansion-simulation-plan.md`
- `docs/crawler-v2-expansion-priority-matrix.md`

## What Was Not Touched

- No source code.
- No Supabase migrations.
- No Edge Functions.
- No workflows or scripts.
- No crawler execution.
- No Run All, country crawl, publish, or external API calls.
- No canonical table updates.
- No language handling or locale expansion.
