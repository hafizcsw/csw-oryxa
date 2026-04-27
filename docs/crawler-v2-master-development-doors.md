# Crawler v2 Master Development Doors

Status: planning gate only  
Source inventory: merged Crawler v2 expansion roadmap from PR #4  
Scope: docs-only sequencing; no implementation, crawler execution, publish, or schema work

## Executive Snapshot

This document creates the master door structure for expanding the existing Crawler v2 engine safely. It does not define a new crawler, a replacement architecture, or a production implementation plan. Every door is a controlled planning gate above the current Crawler v2 baseline.

Door 0 is the first required gate: Baseline & Safety. It freezes the baseline, names runtime-closed and runtime-open stages, and makes forbidden work explicit before any follow-on door can become implementation work.

Doors 1-6 are intentionally stubbed only. They establish the future sequence but do not yet expand requirements, acceptance tests, or implementation plans.

## Door Structure

| Door | Name | Status | Detail level |
|---:|---|---|---|
| 0 | Baseline & Safety | Planned in this document | Fully defined |
| 1 | Run Control & Diagnostics | Planned, not implemented | Stub only |
| 2 | Evidence & Review Workbench | Planned, not implemented | Stub only |
| 3 | Extraction Expansion | Planned, not implemented | Stub only |
| 4 | ORX Evidence Layer | Planned, not implemented | Stub only |
| 5 | Student Evaluation Layer | Planned, not implemented | Stub only |
| 6 | Product Surfaces | Planned, not implemented | Stub only |

## Door 0: Baseline & Safety

### Purpose

Door 0 establishes the non-negotiable baseline for all Crawler v2 expansion work. It confirms that the original Crawler v2 engine remains the engine of record, that expansion ideas from PR #4 are deltas above the current engine, and that no production work may begin until the relevant runtime-open original stages are closed.

Door 0 exists to prevent scope drift:

- No new crawler.
- No separate simulation lab build.
- No production expansion hidden inside planning work.
- No public, student-facing, CRM-ready, ORX-scoring, or publish-affecting output before the original gates support it.

### Current Crawler v2 Baseline

The current Crawler v2 baseline is the original staged engine:

| Stage | Name | Baseline responsibility | Door 0 posture |
|---|---|---|---|
| 1A | Control/Admin/Create Run | Create bounded crawl runs and admin controls | Baseline stage, runtime closed |
| 1B | Worker/Homepage Fetch | Fetch official homepage/page content and record fetch outcomes | Baseline stage, runtime closed |
| 1C | Page Planner | Select candidate official pages for crawl/extract | Baseline stage, runtime closed |
| 1D | Basic Extract | Deterministic fact extraction from fetched content | Baseline stage, runtime closed |
| 1E | Review Surface | Human review queue and evidence inspection | Baseline stage, runtime open |
| 2 | Queue Controls | Pause/resume/stop/retry/selection controls | Baseline stage, runtime open |
| 3 | AI Extract | AI extraction over existing evidence | Baseline stage, runtime closed |
| 4 | Draft Writer | Writes proposed university/program drafts | Baseline stage, runtime open |
| 5 | ORX Mapper | Maps evidence/facts to ORX entities/signals | Baseline stage, runtime open |
| 6 | Verify/Publish Gate | Verifies, gates, and publishes approved facts | Baseline stage, runtime open |

Door 0 does not change this baseline. It only records it as the required reference point for later doors.

### Runtime-Closed Stages

The following stages are runtime-closed and may be used as stable context for planning and simulation design:

| Stage | Name | What may depend on it later |
|---|---|---|
| 1A | Control/Admin/Create Run | Run identity, bounded run setup, simulation cohort naming |
| 1B | Worker/Homepage Fetch | Saved fetch evidence, fetch outcomes, page availability signals |
| 1C | Page Planner | Page-discovery simulations, page intent benchmarks, official-source coverage checks |
| 1D | Basic Extract | Deterministic extracted facts, snippets, field flags, evidence normalization checks |
| 3 | AI Extract | Offline AI extraction simulation from saved evidence only |

Runtime-closed does not mean expansion production is allowed. It only means these stages can be referenced by future door plans.

### Runtime-Open Stages

The following original stages are not runtime-closed and must remain blockers for dependent expansion work:

| Stage | Name | Work blocked until runtime closure |
|---|---|---|
| 1E | Review Surface | Reviewer workflows, human review triggers, agent-neutral handoff, dashboard review loops |
| 2 | Queue Controls | Retry policy, duplicate run enforcement, selected-stage runner, real queue validation |
| 4 | Draft Writer | Dedupe promotion, program requirements, apply packs, student eligibility inputs |
| 5 | ORX Mapper | ORX evidence integration, ORX signal candidates, ORX explanations, anti-gaming score actions |
| 6 | Verify/Publish Gate | Publish, canonical writes, public pages, trust badges, data APIs, CRM-ready truth, student-facing advice |

Runtime-open stages may be described and simulated from saved evidence, but they must not become production dependencies until closed.

### Global Safety Rules

These rules apply to every door:

- No Run All.
- No country crawl.
- No publish.
- No canonical writes.
- No ORX score production before ORX Mapper and Verify/Publish Gate close.
- No student eligibility production before verified program requirements exist.
- No public pages, trust badges, or data APIs before Verify/Publish Gate closes.
- No crawler language or i18n changes.
- No new crawler or system rewrite.
- No Edge Functions.
- No migrations.
- No workflows.
- No scripts.
- No source-code changes unless a later door explicitly becomes an approved implementation ticket.
- No Supabase modifications.
- No external API calls for door-planning work.

### Dependency Rule

All expansion ideas from PR #4 are deltas above current Crawler v2, not replacements.

Future work must state:

- which current Crawler v2 component it extends;
- which runtime-closed stage it can safely use;
- which runtime-open stage blocks production use;
- what evidence it consumes;
- what output it proposes;
- what no-write simulation would prove it;
- what runtime test must close before implementation.

No expansion may bypass, replace, or fork the original Crawler v2 baseline.

### Forbidden Work Register

The following work is forbidden during Door 0 and remains forbidden until a later door explicitly opens it:

| Forbidden work | Reason |
|---|---|
| Run All or country crawl | Too broad; can trigger unsafe execution paths |
| Publish or canonical updates | Verify/Publish Gate is runtime open |
| ORX score production | ORX Mapper and Verify/Publish Gate are runtime open |
| Student eligibility production | Verified program requirements are not production-ready |
| Public pages, trust badges, data APIs | Public truth boundary is not closed |
| Language/i18n crawler changes | Explicitly outside the expansion roadmap scope |
| New crawler/system rewrite | PR #4 defines deltas above existing Crawler v2, not a replacement |
| Scripts, workflows, migrations, Edge Functions | Door 0 is docs-only planning |
| Supabase changes | No schema or data mutation belongs in Door 0 |

### Promotion Criteria

Door 0 is accepted when:

- the current Crawler v2 baseline is explicit;
- runtime-closed and runtime-open stages are listed;
- forbidden work is explicit;
- all expansion ideas from PR #4 are defined as deltas above the current engine;
- future work is required to map to a Door before implementation;
- no source code, Supabase files, migrations, Edge Functions, workflows, scripts, crawler runs, publish actions, canonical writes, or language/i18n files are changed.

## Door 1: Run Control & Diagnostics

Status: planned, not implemented

Purpose: define safe run-control, diagnostic, and handoff planning above the current Crawler v2 stages. Door 1 is still a planning gate. It specifies how diagnostics, safe run actions, and no-write evidence packs should behave later, but it does not authorize implementation, crawler execution, publish, canonical writes, ORX scoring, student eligibility, or public surfaces.

Depends on:

- Door 0 accepted.
- Runtime closure or explicit simulation-only handling for 2 Queue Controls.

### Door 1 Scope

Door 1 is the run-control and diagnostics door. It may define future behavior for inspecting and safely operating the current Crawler v2 engine, but only as a supervisory layer above the existing stages.

Door 1 must not:

- add a new crawler;
- replace the current Crawler v2 engine;
- run all stages by default;
- run country crawl by default;
- expose publish;
- expose ORX score actions;
- expose student eligibility actions;
- write canonical data;
- modify crawler language/i18n behavior.

### Door 1 Admin UI Constraints

Door 1 may support no more than five future primary admin actions. The first Door 1 plan allows only three:

| Future primary action | Allowed in Door 1 plan | Notes |
|---|---:|---|
| Create / Select Run | Yes | Select an existing run or create a bounded run shell after Door 2 queue safety is proven |
| Run Safe Stage | Yes | One selected original stage only, with explicit precondition checks |
| Generate Evidence Pack | Yes | No-write diagnostics output only |
| Publish | No | Blocked until Verify/Publish Gate closes |
| Run All / Country Crawl | No | Must not be exposed by default |

No Door 1 UI should expose ORX score actions, student eligibility actions, public page actions, trust badge actions, data API actions, or canonical write actions.

### Door 1 Admin Action Impact

| Admin action | Intended effect | Required safety posture | Must not do |
|---|---|---|---|
| Create / Select Run | Establish a bounded run context for diagnostics | Scope must be visible before action; duplicate-run guard must warn or block later | Must not trigger Run All, country crawl, fetch, extract, draft, ORX, publish, or canonical writes by default |
| Run Safe Stage | Execute or simulate one selected original stage later | Stage must pass precondition checks and show blocked downstream dependencies | Must not chain into publish, ORX scoring, student eligibility, or public surfaces |
| Generate Evidence Pack | Produce a no-write run evidence bundle | Must include the no-write verification statement and missing-data notices | Must not mutate Supabase, canonical tables, drafts, ORX scores, publish audit, or source content |

### No-write Runtime Evidence Contract

Every Door 1 diagnostic feature must be able to produce or point to a no-write evidence pack. The contract is diagnostic-only and must report missing unavailable fields instead of inventing them.

Required fields:

| Field | Requirement |
|---|---|
| `run_id` | Required when a run exists; otherwise explicit null reason |
| `run_item_id` | Required for item-level diagnostics; otherwise explicit null reason |
| `university_id` | Required for university-scoped diagnostics |
| `website` | Required when known from the current engine |
| `target_domain` | Required when derivable from website or selected target |
| `run_status` | Required current run status |
| `item_status` | Required current item status |
| `item_stage` | Required current item stage |
| `item_progress` | Required progress value or null reason |
| `raw_pages_count` | Required count |
| `raw_pages_latest_rows_summary` | Required compact summary of latest saved rows |
| `crawler_page_candidates_count` | Required count |
| `crawler_page_candidates_breakdown` | Required breakdown by type/status when available |
| `evidence_items_count` | Required count |
| `evidence_items_method_breakdown` | Required extraction method breakdown when available |
| `evidence_items_model_breakdown` | Required model breakdown when available |
| `crawler_telemetry_timeline` | Required timeline from available telemetry |
| `errors` | Required list, empty if none |
| `failure_reason` | Required if failed or blocked |
| `failure_detail` | Required if failed or blocked |
| `trace_id_list` | Required list, empty if unavailable |
| `timestamps` | Required created/started/updated/finished timestamps when available |
| `draft_count` | Required count if available; otherwise explicit unavailable marker |
| `orx_output_count` | Required count if available; otherwise explicit unavailable marker |
| `publish_audit_count` | Required count if available; otherwise explicit unavailable marker |
| `no_write_verification_statement` | Required statement confirming diagnostics did not write, publish, score, or mutate canonical data |

Minimum no-write verification statement:

```text
This evidence pack is diagnostic-only. It did not run crawler functions, Run All, country crawl, publish, ORX scoring, student eligibility, canonical writes, migrations, Edge Functions, workflows, scripts, external API calls, or language/i18n changes.
```

### Door 1 Diagnostic Items

#### 1. Smoke Diagnostics / Evidence Pack

| Field | Door 1 definition |
|---|---|
| Purpose | Produce a compact no-write diagnostic bundle for one run or run item so humans, Claude, Codex, or later reviewers can understand current status and missing proof. |
| Current engine component extended | 1A Control/Admin/Create Run, 1B Worker/Homepage Fetch, 1C Page Planner, 1D Basic Extract, 3 AI Extract, and read-only status from 1E/2/4/5/6 when available. |
| Dependency on runtime-open stages | Full coverage depends on 1E, 2, 4, 5, and 6. Door 1 may still report those sections as unavailable or blocked. |
| Allowed work | Define evidence pack fields, missing-data markers, status summaries, trace lists, telemetry timeline shape, and no-write verification statement. |
| Forbidden work | No crawler execution, no publish, no canonical writes, no new draft writes, no ORX score writes, no student decision writes, no external APIs. |
| Required evidence fields | All fields in the No-write Runtime Evidence Contract. |
| UI impact | Future UI may show a Generate Evidence Pack action and a read-only evidence summary. |
| Admin action impact | Admin can inspect run health without triggering downstream stages. |
| Failure modes | Missing run, missing item, partial telemetry, unavailable draft/ORX/publish counts, stale trace ids, ambiguous status names. |
| Acceptance criteria | Contract fields are complete; every unavailable value has a null reason; no-write statement is present; output is suitable for human and agent handoff. |
| What proves it runtime later | A completed or failed run item produces the pack with counts, timelines, trace ids, and no writes. |
| Blocked until 1E/2/4/5/6 close | Review decisions, queue control proof, draft impact proof, ORX mapping proof, publish audit proof. |

#### 2. Queue Controls Validation

| Field | Door 1 definition |
|---|---|
| Purpose | Specify how pause, resume, stop, retry, and lock/lease behavior must be validated before broader orchestration is trusted. |
| Current engine component extended | 2 Queue Controls, with read-only stage status from 1A through 6. |
| Dependency on runtime-open stages | Directly blocked by 2 Queue Controls runtime closure. |
| Allowed work | Define test cases, expected state transitions, refusal messages, lock/lease evidence, stale item detection, and safe retry boundaries. |
| Forbidden work | No live queue mutation in this docs gate; no Run All; no country crawl; no publish; no bypassing existing queue semantics. |
| Required evidence fields | run_id, run_item_id, item_status, item_stage, item_progress, crawler_telemetry_timeline, errors, failure_reason, failure_detail, trace_id_list, timestamps, no_write_verification_statement. |
| UI impact | Future UI may display queue state and control readiness, but Door 1 does not add controls now. |
| Admin action impact | Later admins should know whether a run is safe to pause, resume, stop, or retry before pressing any action. |
| Failure modes | Stale lock, duplicate active item, retry loop, stop not respected, resume skips prerequisite, selected stage starts with unmet dependency. |
| Acceptance criteria | Queue control tests are specified for pause, resume, stop, retry, stale lock recovery, duplicate active item handling, and blocked-stage refusal. |
| What proves it runtime later | Isolated test run demonstrates each queue control transition with telemetry and no accidental downstream publish. |
| Blocked until 1E/2/4/5/6 close | Real queue-control enforcement is blocked by 2; review/draft/ORX/publish downstream safety remains blocked by 1E/4/5/6. |

#### 3. Duplicate Run Guard

| Field | Door 1 definition |
|---|---|
| Purpose | Prevent or warn on overlapping active runs for the same target scope before duplicate evidence or conflicting outputs are created. |
| Current engine component extended | 1A Control/Admin/Create Run and 2 Queue Controls. |
| Dependency on runtime-open stages | Enforcement depends on 2 Queue Controls runtime closure. |
| Allowed work | Define duplicate identity rules by run scope, university_id, website, target_domain, active status, and stage. |
| Forbidden work | No automatic cancellation, no destructive cleanup, no canonical merge, no draft dedupe writes. |
| Required evidence fields | run_id, university_id, website, target_domain, run_status, item_status, item_stage, timestamps, trace_id_list, no_write_verification_statement. |
| UI impact | Future UI may show duplicate warnings before Create / Select Run. |
| Admin action impact | Admin sees whether to reuse an active run, wait, or explicitly create a separate bounded run later. |
| Failure modes | Same university under multiple domains, stale active run, completed run misread as active, different universities sharing a domain, manually created overlapping run. |
| Acceptance criteria | Duplicate matching behavior is specified for exact scope, same university, same domain, stale active run, completed run, and explicit override requirement. |
| What proves it runtime later | Attempted duplicate run creation returns a clear block or warning without creating conflicting queue items. |
| Blocked until 1E/2/4/5/6 close | Enforcement is blocked by 2; downstream dedupe and publish safety remain blocked by 4/5/6. |

#### 4. Failure Classifier

| Field | Door 1 definition |
|---|---|
| Purpose | Classify run failures into actionable buckets so operators know whether to retry, review, wait, or escalate. |
| Current engine component extended | 1B Worker/Homepage Fetch, 1C Page Planner, 1D Basic Extract, 3 AI Extract, 4 Draft Writer, 5 ORX Mapper, 6 Verify/Publish Gate status reads. |
| Dependency on runtime-open stages | Downstream failure classes depend on 4, 5, and 6 closure; review escalation depends on 1E. |
| Allowed work | Define taxonomy: fetch/access, planner/no candidates, extraction/no evidence, AI extraction, queue/lock, draft writer, ORX mapper, verify/publish, unknown. |
| Forbidden work | No automatic retry execution, no publish bypass, no AI repair call, no external diagnostics API. |
| Required evidence fields | run_id, run_item_id, item_status, item_stage, crawler_telemetry_timeline, errors, failure_reason, failure_detail, trace_id_list, timestamps, no_write_verification_statement. |
| UI impact | Future UI may display failure bucket, confidence, and recommended next safe action. |
| Admin action impact | Admin can distinguish safe retry candidates from review-required or blocked items. |
| Failure modes | Ambiguous error, missing telemetry, multiple failures on one item, downstream failure masked by upstream failure, unknown exception. |
| Acceptance criteria | Classifier taxonomy, fallback unknown bucket, and human-review escalation cases are specified. |
| What proves it runtime later | Historical failed run items are classified with reviewer agreement and no side effects. |
| Blocked until 1E/2/4/5/6 close | Review-based escalation waits for 1E; retry enforcement waits for 2; draft/ORX/publish failure classes remain partial until 4/5/6 close. |

#### 5. Retry Policy

| Field | Door 1 definition |
|---|---|
| Purpose | Specify when a failed or blocked item may be retried safely without hammering sites or compounding bad state. |
| Current engine component extended | 2 Queue Controls and 1B Worker/Homepage Fetch. |
| Dependency on runtime-open stages | Real retry execution depends on 2 Queue Controls runtime closure. |
| Allowed work | Define retry eligibility, retry refusal reasons, retry cooldown, maximum attempt policy, and politeness constraints. |
| Forbidden work | No live retries in this docs gate; no retry after publish; no retry that skips prerequisites; no retry that ignores 403/429/robots/politeness signals. |
| Required evidence fields | run_id, run_item_id, website, target_domain, item_status, item_stage, errors, failure_reason, failure_detail, crawler_telemetry_timeline, timestamps, trace_id_list, no_write_verification_statement. |
| UI impact | Future UI may show retry eligibility and next eligible time, not a broad retry-all control. |
| Admin action impact | Admin can see why retry is allowed, delayed, blocked, or requires review. |
| Failure modes | Infinite retry loop, retrying permanent 404, retrying blocked domain, retrying without clearing stale lock, retrying a downstream stage with missing upstream evidence. |
| Acceptance criteria | Retry matrix covers temporary fetch failure, rate limit, access denied, no candidates, extraction empty, stale lock, unknown error, and completed/published items. |
| What proves it runtime later | Isolated retry test respects cooldown, attempt limit, status transition, and no downstream publish. |
| Blocked until 1E/2/4/5/6 close | Real retry control waits for 2; review-required retry waits for 1E; retry involving draft/ORX/publish stages waits for 4/5/6. |

#### 6. Safe Selected-stage Runner

| Field | Door 1 definition |
|---|---|
| Purpose | Define how a future admin may run one selected original stage safely without triggering the full pipeline. |
| Current engine component extended | 1A Control/Admin/Create Run, 2 Queue Controls, and selected stage precondition reads from 1B through 6. |
| Dependency on runtime-open stages | Real selected-stage execution depends on 2 Queue Controls and the selected stage's runtime closure. |
| Allowed work | Define safe stage list, prerequisites, refusal messages, dry-run precheck, and action boundary. |
| Forbidden work | No Run All; no country crawl; no implicit next-stage chaining; no publish exposure; no ORX score action; no student eligibility action. |
| Required evidence fields | run_id, run_item_id, item_status, item_stage, item_progress, raw_pages_count, crawler_page_candidates_count, evidence_items_count, errors, trace_id_list, timestamps, no_write_verification_statement. |
| UI impact | Future UI may show Run Safe Stage only after a run is selected and prechecks are visible. |
| Admin action impact | Admin selects exactly one stage and sees blocked prerequisites before action. |
| Failure modes | Wrong stage selected, prerequisites missing, stale item state, stage starts multiple workers, stage silently chains, stage reaches publish boundary. |
| Acceptance criteria | Selected-stage safety rules explicitly block publish, ORX scoring, student eligibility, Run All, country crawl, and unmet prerequisites. |
| What proves it runtime later | Isolated stage test runs or refuses exactly one stage with trace evidence and no chained side effects. |
| Blocked until 1E/2/4/5/6 close | Real execution blocked by 2 and selected-stage closure; review/draft/ORX/publish selected stages remain blocked by 1E/4/5/6. |

#### 7. Full Pipeline Orchestrator as Read-only/Supervisory Plan Only

| Field | Door 1 definition |
|---|---|
| Purpose | Define a future read-only supervisory view that can show pipeline state and recommended next safe step without replacing stage internals. |
| Current engine component extended | 1A through 6 status reads only. |
| Dependency on runtime-open stages | Full accuracy depends on 1E, 2, 4, 5, and 6 runtime closure. |
| Allowed work | Define stage status summary, dependency graph, blocked-stage display, and next-safe-action recommendation wording. |
| Forbidden work | No production orchestrator, no new crawler, no automatic stage chaining, no Run All, no country crawl, no publish, no canonical writes. |
| Required evidence fields | run_id, run_status, item_status, item_stage, item_progress, crawler_telemetry_timeline, errors, trace_id_list, timestamps, no_write_verification_statement. |
| UI impact | Future UI may show read-only stage timeline and blocked next actions. |
| Admin action impact | Admin receives guidance, not automatic execution. |
| Failure modes | Supervisory plan mistaken for orchestrator, stale status, hidden blocked dependency, recommendation suggests unsafe stage. |
| Acceptance criteria | Document states read-only/supervisory only and requires every suggested action to pass selected-stage safety rules. |
| What proves it runtime later | Supervisory view correctly summarizes a run without invoking any function or mutating data. |
| Blocked until 1E/2/4/5/6 close | Any real orchestration, downstream stage execution, review routing, draft write, ORX mapping, or publish remains blocked. |

#### 8. Agent-neutral Handoff for Claude/Codex/Human

| Field | Door 1 definition |
|---|---|
| Purpose | Provide a standard handoff shape so any agent or human reviewer can resume from the same evidence and blockers. |
| Current engine component extended | Smoke Diagnostics / Evidence Pack plus 1E Review Surface when available. |
| Dependency on runtime-open stages | Reviewer workflow depends on 1E; full downstream status depends on 4, 5, and 6. |
| Allowed work | Define handoff sections: run summary, evidence pack link/body, stage state, failures, blocked items, safe next step, forbidden actions. |
| Forbidden work | No agent instruction to run crawler functions, publish, score ORX, modify canonical data, or change language/i18n. |
| Required evidence fields | All evidence pack fields plus explicit safe-next-step and blocked-action list. |
| UI impact | Future UI may provide copyable handoff text from Generate Evidence Pack output. |
| Admin action impact | Admin can pass context to Claude, Codex, or a human without losing safety constraints. |
| Failure modes | Missing evidence, stale run state, unsafe next step, agent-specific assumptions, human cannot reproduce reasoning. |
| Acceptance criteria | Handoff is tool-neutral, contains no hidden context requirement, and repeats forbidden actions. |
| What proves it runtime later | A human and an agent independently identify the same next safe action from the handoff. |
| Blocked until 1E/2/4/5/6 close | Review workflow waits for 1E; downstream actionability waits for 2/4/5/6. |

#### 9. Local Fallback vs GitHub Actions Diagnostics

| Field | Door 1 definition |
|---|---|
| Purpose | Define when diagnostics should rely on local/manual evidence versus later CI/GitHub Actions checks, without creating workflows now. |
| Current engine component extended | Documentation and evidence pack review; no runtime crawler component is changed. |
| Dependency on runtime-open stages | None for docs planning; automated runtime diagnostics remain blocked until later approved implementation. |
| Allowed work | Define fallback order: local/manual evidence pack first, then future GitHub Actions diagnostics only if a later door approves workflows. |
| Forbidden work | No workflow creation, no scripts, no CI crawler runs, no external API calls, no secret-dependent diagnostics. |
| Required evidence fields | no_write_verification_statement, timestamps, trace_id_list, errors, and explicit source of diagnostic evidence: local/manual/GitHub Actions later. |
| UI impact | Future UI may label diagnostics source, but Door 1 adds no UI. |
| Admin action impact | Admin knows whether evidence came from local/manual inspection or future CI. |
| Failure modes | CI not configured, local environment stale, diagnostic source unclear, workflow accidentally runs crawler or publish. |
| Acceptance criteria | Door 1 states no workflows are created and GitHub Actions diagnostics are future-only. |
| What proves it runtime later | Later approved diagnostic check produces no-write report without crawler execution or publish. |
| Blocked until 1E/2/4/5/6 close | Any runtime-aware CI diagnostics touching queues, drafts, ORX, or publish remain blocked until corresponding stages close. |

#### 10. No-write Runtime Evidence Contract

| Field | Door 1 definition |
|---|---|
| Purpose | Make every Door 1 diagnostic prove that it did not mutate production state. |
| Current engine component extended | All stages by read-only evidence only. |
| Dependency on runtime-open stages | Full field coverage depends on 1E/2/4/5/6, but no-write proof is required immediately. |
| Allowed work | Define required fields, unavailable markers, no-write statement, and missing evidence reporting. |
| Forbidden work | No writes to canonical universities, programs, university_media, orx_scores, drafts, publish audit, queue state, or crawler language/i18n files. |
| Required evidence fields | The complete No-write Runtime Evidence Contract listed above. |
| UI impact | Future UI must show no-write status clearly before any diagnostic output is trusted. |
| Admin action impact | Admin can distinguish evidence inspection from execution. |
| Failure modes | Missing no-write statement, hidden side effect, counts created by a live action, output lacks timestamps, unavailable fields silently omitted. |
| Acceptance criteria | Every diagnostic item requires the no-write verification statement and explicit unavailable markers. |
| What proves it runtime later | Evidence pack generation leaves crawler state, canonical tables, drafts, ORX outputs, and publish audit unchanged. |
| Blocked until 1E/2/4/5/6 close | Complete downstream counts and proof for review, queue, draft, ORX, and publish sections. |

### Door 1 Runtime Acceptance Criteria

Door 1 is accepted when:

- diagnostics contract is complete;
- queue control tests are specified;
- duplicate run guard behavior is specified;
- selected-stage safety rules are explicit;
- evidence pack fields are complete;
- local fallback vs GitHub Actions diagnostic boundaries are explicit;
- no publish, canonical, student, or ORX production path is introduced;
- no Run All or country crawl is exposed by default;
- the plan remains docs-only.

### Door 1 Blocked Items

The following remain blocked after Door 1:

| Blocked item | Blocked until |
|---|---|
| Reviewer workflow execution | 1E Review Surface closes |
| Real queue mutation controls | 2 Queue Controls closes |
| Retry execution | 2 Queue Controls closes |
| Selected-stage execution for runtime-open stages | The selected stage and 2 Queue Controls close |
| Draft writes or draft promotion | 4 Draft Writer closes |
| ORX mapping or ORX score production | 5 ORX Mapper and 6 Verify/Publish Gate close |
| Publish, canonical writes, public pages, trust badges, data APIs | 6 Verify/Publish Gate closes |
| Student eligibility production | Verified program requirements exist and 4/6 close |
| GitHub Actions runtime diagnostics | Later approved workflow door; not Door 1 |

## Door 2: Evidence & Review Workbench

Status: planned, not implemented

Purpose: define review, provenance, confidence, conflict, and benchmark planning for crawler evidence.

Depends on:

- Door 0 accepted.
- Runtime closure or simulation-only handling for 1E Review Surface and 6 Verify/Publish Gate.

Examples of features from PR #4:

- Evidence Knowledge Graph.
- Provenance model.
- Quality / Confidence Engine.
- Official Conflict Resolver.
- Weak Marketing Claim Detector.
- Human Review Triggers.
- Safe Publish Sandbox.
- Benchmarking System.

## Door 3: Extraction Expansion

Status: planned, not implemented

Purpose: define crawler expansion simulations that improve evidence coverage without replacing the current engine.

Depends on:

- Door 0 accepted.
- Door 1 diagnostics defined.
- Runtime closure or simulation-only handling for 4 Draft Writer and 6 Verify/Publish Gate where outputs affect drafts or publish decisions.

Examples of features from PR #4:

- Discovery Intelligence.
- Deep Program Extraction.
- PDF Intelligence.
- JS-render fallback.
- Multi-domain official handling.
- Media/file artifact intelligence.
- Crawl Ethics / Politeness.
- Crawler Cost Brain.
- Evidence Freshness SLA.
- Change Detection.

## Door 4: ORX Evidence Layer

Status: planned, not implemented

Purpose: define evidence-to-ORX mapping, signal benchmarking, explanation, and anti-gaming plans.

Depends on:

- Door 0 accepted.
- Door 2 evidence/provenance rules defined.
- Runtime closure of 5 ORX Mapper before score-affecting work.
- Runtime closure of 6 Verify/Publish Gate before public ORX outputs.

Examples of features from PR #4:

- ORX Evidence Integration.
- ORX Signal Candidates.
- ORX Curriculum and Future Readiness Evidence Agent.
- Curriculum updates.
- Course/module changes.
- AI/data/automation exposure.
- Accreditation and quality assurance.
- ORX Explanation Engine.
- ORX University Improvement Guidance.
- ORX Anti-gaming.
- Published ORX signal <=5% verified-error strategy.

## Door 5: Student Evaluation Layer

Status: planned, not implemented

Purpose: define simulations for student-file interpretation, requirement matching, decision confidence, and fit.

Depends on:

- Door 0 accepted.
- Door 2 evidence/provenance rules defined.
- Runtime closure of 4 Draft Writer and 6 Verify/Publish Gate before verified program requirements can support production eligibility decisions.

Examples of features from PR #4:

- Program Requirement Hardness Classifier.
- Student Evidence Parser.
- Student-Program Eligibility Matcher.
- Decision Confidence Engine.
- Negative Recommendation Engine.
- Program Substitution Engine.
- Official Apply Pack.
- Deadline Radar.
- Country/Visa/Budget risk layer.
- Psychological/person-program fit dimensions.
- Program-to-skills mapping.
- Skills-to-occupations mapping.
- Future demand.
- Student fit.

## Door 6: Product Surfaces

Status: planned, not implemented

Purpose: define when verified crawler, ORX, and student-evaluation outputs may be exposed to users, universities, CRM, public pages, or APIs.

Depends on:

- Door 0 accepted.
- Door 2 evidence/provenance rules defined.
- Door 4 ORX evidence rules for ORX-facing surfaces.
- Door 5 student evaluation rules for student-facing surfaces.
- Runtime closure of 6 Verify/Publish Gate before public or production truth surfaces.

Examples of features from PR #4:

- Student App.
- Student AI Advisor.
- Public University Pages.
- University Dashboard.
- CRM Case Handoff.
- Admin Review Queue.
- ORX Public Explanation.
- Application Checklist.
- Deadline Alerts.
- Trust Badges.
- Data Products/API.

## Next Step for Claude

Claude should continue with Door 1 only after Door 0 is accepted. Door 1 should remain docs-first and should define run-control and diagnostics acceptance criteria before any implementation work is proposed.
