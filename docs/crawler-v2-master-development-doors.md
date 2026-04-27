# Crawler v2 Master Development Doors

Status: planning gate only  
Source inventory: merged Crawler v2 expansion roadmap from PR #4  
Scope: docs-only sequencing; no implementation, crawler execution, publish, or schema work

## Executive Snapshot

This document creates the master door structure for expanding the existing Crawler v2 engine safely. It does not define a new crawler, a replacement architecture, or a production implementation plan. Every door is a controlled planning gate above the current Crawler v2 baseline.

Door 0 is fully defined as the Baseline & Safety gate. It freezes the baseline, names runtime-closed and runtime-open stages, and makes forbidden work explicit before any follow-on door can become implementation work.

Door 1 is fully defined as the Run Control & Diagnostics gate. Doors 2-6 are fully defined as planning contracts only; they establish evidence, extraction, ORX, student evaluation, and product-surface gates before any implementation begins.

## Door Structure

| Door | Name | Status | Detail level |
|---:|---|---|---|
| 0 | Baseline & Safety | Planned in this document | Fully defined |
| 1 | Run Control & Diagnostics | Planned, not implemented | Fully defined |
| 2 | Evidence & Review Workbench | Planned, not implemented | Fully defined |
| 3 | Extraction Expansion | Planned, not implemented | Fully defined |
| 4 | ORX Evidence Layer | Planned, not implemented | Fully defined |
| 5 | Student Evaluation Layer | Planned, not implemented | Fully defined |
| 6 | Product Surfaces | Planned, not implemented | Fully defined |

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

### Purpose

Door 2 defines the evidence trust layer above the existing Crawler v2 engine. It turns raw pages, page candidates, extracted facts, telemetry, drafts, and later ORX outputs into reviewable evidence with provenance, confidence, conflict handling, and benchmark expectations. It does not publish, score, write canonical data, or make student decisions.

### Included Features From Source Inventory

| Feature | Current engine component extended | Required evidence | AI role | Human review trigger | Anti-gaming risk | Expected UI impact | Admin action impact | What remains simulation-only |
|---|---|---|---|---|---|---|---|---|
| Evidence Knowledge Graph | 1D Basic Extract, 4 Draft Writer, 5 ORX Mapper | Source URL, quote, entity, field, hash, observed timestamp, trace id | Suggest claim-source-entity links from saved evidence | Orphan claim, circular support, weak citation | Evidence spam or repeated low-quality source volume | Graph context inside Review Workbench and Evidence Pack Drawer | No new primary action; visible through Open Review and Generate Evidence Pack | Graph writes, persistent graph tables, score usage |
| Provenance model | 1D, 3 AI Extract, 4, 6 | Source URL, evidence quote, source type, extraction method, model/provider, observed_at, content hash, trace id | None required; AI-derived fields must preserve model/provider | Missing provenance on any high-impact fact | Low | Provenance chips and missing-proof states | No write action; reviewer can approve/reject facts only later | Schema changes and canonical provenance enforcement |
| Quality / Confidence Engine | 1D, 3, 1E, 6 | Evidence count, source authority, recency, conflict count, extraction method, field risk | Explain confidence inputs from saved evidence | Low confidence, high impact, conflicting evidence | Confidence inflation by source repetition | Confidence lanes and risk flags | Review triage only | Automatic acceptance or public badge assignment |
| Official Conflict Resolver | 1D, 1E, 6 | Conflicting values, source URLs, page type, timestamps, official-domain relationship | Summarize conflict options; never decide high-impact conflicts alone | Fee, deadline, requirement, accreditation, ORX signal conflict | Fake partner domains, stale PDFs, page-vs-PDF contradictions | Conflicts lane and conflict drawer | Mark conflict, request source, copy handoff | Canonical resolution or publish |
| Weak Marketing Claim Detector | 1D, 3, 1E | Claim text, surrounding quote, page type, factual support | Classify factual vs marketing-only claims from saved text | Marketing claim proposed for ORX/student/public use | Very high; institutions may over-optimize language | Claim-strength badge and Needs Evidence lane | Reject or mark needs source at row level | Score or recommendation impact |
| Human Review Triggers | 1E, 6 | Risk level, confidence, conflict status, source type, affected entity, field impact | Explain why review is required | High-impact low-confidence item; conflict; missing source; AI-derived fact | Medium | Review lanes and blocked states | Open Review only; row-level decisions later | Auto-publish and automated student decisions |
| Safe Publish Sandbox | 6 Verify/Publish Gate | Draft diff, target entity, proposed field, old value, new value, provenance, no-write statement | Summarize dry-run diff | Any publish-impacting change | High if used as real publish | Dry-run Publish / Promote remains disabled until 6 closes | Future fifth primary action only after gate proof | Real publish, canonical writes, public truth |
| Benchmarking System | All stages using saved packs | Golden labels, expected outputs, reviewer agreement, error rates, cost, stop condition | Offline judge only against labels | Benchmark drift, low reviewer agreement | Low | Benchmark status in roadmap cards | No runtime action | CI/workflow automation and production gating |

### Current Engine Components Extended

Door 2 extends 1D Basic Extract, 3 AI Extract, 1E Review Surface, 4 Draft Writer, 5 ORX Mapper, and 6 Verify/Publish Gate by defining evidence contracts around their outputs. It does not replace any stage or add a new crawler path.

### Dependencies On Runtime-Open Stages

| Runtime-open stage | Door 2 dependency |
|---|---|
| 1E Review Surface | Required before reviewer workflow execution, lane persistence, reviewer decisions, or dispute handling can be runtime closed |
| 4 Draft Writer | Required before draft fields can be reviewed as production candidates |
| 5 ORX Mapper | Required before ORX evidence graph links can affect score signals |
| 6 Verify/Publish Gate | Required before safe publish sandbox can promote anything beyond no-write diff preview |

### Allowed Work

- Define evidence pack fields, review lanes, confidence inputs, conflict classes, provenance requirements, and benchmark acceptance rules.
- Use saved snapshots, manually exported evidence packs, and labeled local examples for simulation planning.
- Define UI contracts for review and evidence inspection without implementing UI code.
- Define no-write dry-run publish contracts that explicitly prove zero canonical updates.

### Forbidden Work

- No publish, canonical writes, trust badges, ORX scores, student eligibility decisions, or public-page updates.
- No schema migrations, Supabase changes, Edge Functions, scripts, workflows, or crawler execution.
- No AI call that fetches or extracts new live evidence.
- No automatic resolution of high-impact conflicts.

### Required Evidence

Every Door 2 item must preserve run_id, run_item_id, university_id when applicable, entity type, entity id or candidate id, field, value, source_url, evidence quote, source type, extraction method, model/provider if AI-derived, confidence, risk level, conflict status, trace_id, observed_at, content hash if available, reviewer status, and blocked reason when blocked.

### Review Lanes

| Lane | Purpose | Entry criteria | Exit criteria | Blocked until |
|---|---|---|---|---|
| Critical | High-impact facts that could harm publish, ORX, or student decisions | High risk, missing provenance, policy-sensitive, publish-impacting | Human-approved, rejected, or escalated | 1E and 6 for execution |
| Conflicts | Contradictory official facts | Multiple official values for same field | Winner selected with cited rationale or item blocked | 1E and 6 |
| Needs Evidence | Claims lacking sufficient official support | Missing quote, missing source URL, marketing-only support | Source added or claim rejected | 1E |
| Low Confidence | Extracted fact below confidence threshold | Low model/deterministic confidence or weak source | Accepted with human rationale, improved evidence, or rejected | 1E |
| Ready for Draft | Fact has enough evidence for Draft Writer simulation | Provenance complete, no critical conflict | Draft preview only until 4 closes | 4 |
| Ready for ORX | Evidence candidate may feed ORX mapping simulation | Provenance complete, signal candidate labeled, no weak marketing basis | ORX mapper simulation only until 5 closes | 5 |
| Blocked | Item cannot proceed due to missing runtime gate or safety rule | Any unmet gate, forbidden action, unresolved high-risk issue | Gate closes or item removed | Relevant gate |

### Expected UI Impact

Door 2 introduces the Review Workbench, review lanes, evidence drawers, provenance chips, confidence labels, conflict flags, benchmark status, and no-write publish preview states. It must not add global primary actions beyond the five-action contract.

### Admin Action Impact

Door 2 may use Open Review, Generate Evidence Pack, and later Dry-run Publish / Promote. Row-level review actions are secondary and must stay inside the workbench or drawer.

### Acceptance Criteria

- Review lanes are defined with entry, exit, and blocked states.
- Every review item field is traceable to provenance.
- Confidence, conflict, weak-claim, and human-review trigger rules are specified.
- Safe Publish Sandbox remains no-write and disabled for real promotion until 6 closes.
- Benchmarking uses labeled packs and does not require crawler execution.

### Runtime Proof Required Later

- A reviewer can inspect an evidence item, source quote, trace id, confidence, conflict status, and recommended action from the Review Surface.
- Review decisions preserve provenance and do not publish.
- A dry-run publish preview proves zero writes and lists blocked canonical effects.
- Benchmarks reproduce expected labels and flag regressions.

### Blocked Items

Reviewer workflow execution is blocked by 1E. Draft promotion is blocked by 4. ORX score-affecting use is blocked by 5 and 6. Publish, trust badges, public pages, data APIs, and student-facing truth are blocked by 6.

### Promotion Criteria

Door 2 is accepted when the evidence model, review lanes, provenance requirements, confidence/conflict/weak-claim rules, benchmark plan, and no-write publish sandbox contract are explicit and still docs-only.

### What Must Remain Simulation-only

Evidence graph persistence, confidence automation, conflict auto-resolution, safe publish promotion, benchmark automation, public trust badges, ORX score effects, and student recommendation effects.

## Door 3: Extraction Expansion

Status: planned, not implemented

### Purpose

Door 3 defines crawler evidence-coverage expansions as deltas above the current Crawler v2 engine. It improves what the existing stages could discover, fetch, parse, and monitor later, while keeping the original engine as the baseline and avoiding any live crawler execution in this PR.

### Included Features From Source Inventory

| Feature | Current engine component extended | Required evidence | AI role | Human review trigger | Anti-gaming risk | Expected UI impact | Admin action impact | What remains simulation-only |
|---|---|---|---|---|---|---|---|---|
| Discovery Intelligence | 1C Page Planner | URL candidates, anchor text, page intent, source officialness, known-useful labels | Rank page intent from saved candidates | Non-official or irrelevant page selected | SEO-stuffed navigation | Candidate coverage card and discovery gaps | No new primary action | Live discovery changes |
| Deep Program Extraction | 1D Basic Extract, 3 AI Extract, 4 Draft Writer | Program pages, catalog text, requirement snippets, degree/title/field evidence | Extract structured candidates from saved text only | Requirement, tuition, deadline, or admission condition has low confidence | Program clones and marketing pages | Program evidence detail in Review Workbench | Review only; no draft write | Program draft persistence |
| PDF Intelligence | 1B artifacts, 1D, 3 | PDF URL, file hash, page refs, extracted text, quote with page number | Summarize/extract from saved PDF text | OCR uncertainty, page conflict, stale PDF | Old brochures reused as current truth | Artifact view and page-ref citations | Open source/copy handoff only | PDF crawler, OCR service, artifact tables |
| JS-render fallback | 1B Homepage Fetch | Static text length, rendered capture comparison, render-needed reason | None first; summarize diff later | Rendered content materially differs from static source | Low-medium | Fetch diagnostics flag | No visible Run All or render button | Browser rendering execution |
| Multi-domain official handling | 1C Planner, 6 Gate | Root-domain links, redirects, domain alias rationale, source ownership hint | Explain domain relationship | Alias not linked from official root or conflicts | High; fake partner domains | Official-domain warning and alias status | Review only | Official alias persistence |
| Media/file artifact intelligence | 1B artifacts, 1D | Media URL, type, hash, source page, official-domain status | Classify artifact type from saved inventory | Non-official, low-quality, or promotional-only asset | Medium | Artifact inventory in Evidence Pack Drawer | No media publish action | university_media writes |
| Crawl Ethics / Politeness | 1B Fetch, 2 Queue Controls | robots hints, response codes, per-host counts, retry attempts, 403/429 spikes | None | Robots disallow, rate-limit spike, repeated failure | Low | Ethics status card and blocked-state message | No country crawl or Run All | Enforced queue policy |
| Crawler Cost Brain | 1A, 1B, 3 | Page count, render attempts, AI extraction count, accepted-fact count, cost estimate | Estimate value from saved run stats | High cost with low evidence yield | Low | Cost/yield card | No execution action | Automated budget decisions |
| Evidence Freshness SLA | 1D, 6 | observed_at, page date, PDF date, content hash, freshness class | Extract date references from saved text | Missing, ambiguous, stale, or old-year date | Medium | Freshness badge and stale evidence lane | Review only | Gate-enforced expiration |
| Change Detection | 1B content hash, 4 Draft Writer, 6 | Old/new content hash, semantic diff, affected fields, prior evidence | Summarize material diff from saved snapshots | Material change affects verified fact | Medium; tiny text churn | Change summary and recrawl-needed flag | No recrawl button by default | Automated recrawls or draft writes |

### Dependencies On Runtime-Open Stages

Door 3 production use is blocked by 2 for queue enforcement, 4 for draft persistence, and 6 for official domain/freshness/publish gates. Simulations may use 1B, 1C, 1D, and 3 saved outputs now.

### Allowed Work

- Define extraction benchmark inputs, output contracts, no-write artifact inventories, freshness classifications, change-detection evidence, and politeness/cost simulations.
- Compare saved snapshots against manually labeled expected outputs.
- Define review triggers for extraction uncertainty.

### Forbidden Work

- No live crawl, Run All, country crawl, JS render execution, PDF fetch, OCR service, queue mutation, or draft write.
- No media publish, canonical writes, language/i18n expansion, 12-locale crawler logic, or new crawler architecture.
- No default UI action for broad crawl or country crawl.

### Required Evidence

Door 3 evidence must include source URL, official-domain status, page or artifact type, fetch timestamp, content hash when available, extraction method, page/PDF location reference, quote/snippet, confidence, conflict status, trace id, and no-write statement.

### Expected UI Impact

Door 3 adds evidence-coverage indicators: discovery gaps, PDF/artifact inventory, JS-render-needed flags, domain alias warnings, freshness status, change summary, ethics status, and cost/yield estimates. These appear as status cards, review facts, drawer details, or roadmap items, not as new global buttons.

### Admin Action Impact

Door 3 may be inspected through Generate Evidence Pack and Open Review. Run Safe Stage remains bounded by Door 1 and cannot become Run All, country crawl, or unbounded discovery.

### Acceptance Criteria

- Each extraction expansion has an input pack, expected output pack, review trigger, blocked gate, and stop condition.
- Deep extraction, PDF intelligence, freshness, and change detection preserve field-level provenance.
- Politeness and cost planning define limits before any runtime enforcement is proposed.
- No feature requires new production code in this PR.

### Runtime Proof Required Later

- Discovery ranking improves useful-page coverage on labeled snapshots.
- Deep program and PDF extraction match human labels with complete citations.
- JS fallback proves benefit on saved captures before any render runtime.
- Domain alias logic rejects non-official domains.
- Freshness and change detection identify stale or changed facts without writes.

### Blocked Items

Queue-enforced retries, selected-stage execution, JS render fallback, and politeness enforcement are blocked by 2. Draft-affecting extraction is blocked by 4. Publish/freshness enforcement, media exposure, official alias acceptance, and public facts are blocked by 6.

### Promotion Criteria

Door 3 is accepted when extraction-expansion simulations are fully specified, reviewable, cost-aware, provenance-preserving, and blocked from production effects.

### What Must Remain Simulation-only

Discovery changes, deep extraction, PDF parsing, JS rendering, multi-domain alias handling, media artifact use, cost policy, freshness expiration, and change-detection alerts.

## Door 4: ORX Evidence Layer

Status: planned, not implemented

### Purpose

Door 4 defines how crawler evidence may later support ORX signal candidates, explanations, improvement guidance, and anti-gaming controls. It does not create ORX scores, publish ORX outputs, update orx_scores, or expose public rankings.

### Included Features From Source Inventory

| Feature group | Included ideas | Current components extended | Required evidence | AI role | Human review trigger | Anti-gaming risk | Expected UI impact | What remains simulation-only |
|---|---|---|---|---|---|---|---|---|
| ORX evidence backbone | ORX Evidence Integration; ORX Signal Candidates | 5 ORX Mapper, 1D evidence, Door 2 provenance | Signal id, entity, source URL, quote, source type, confidence, label, benchmark result | Suggest candidate mapping from saved evidence | Missing source, weak signal, low benchmark support | Ready for ORX lane and ORX signal candidate card | Very high | Mapping persistence and score effects |
| Curriculum and future readiness | ORX Curriculum and Future Readiness Evidence Agent; curriculum updates; course/module changes; learning outcomes; AI/data/automation exposure | 3 AI Extract, 4 Draft Writer, 5 ORX Mapper | Catalog text, course/module pages, outcomes, version dates, old/new diffs | Extract and cite only from saved text | AI infers beyond evidence; buzzword-only support | Curriculum signal preview and benchmark status | High | Score contribution |
| Applied and industry evidence | Industry advisory boards; internships/co-op/capstone; employer partnerships | 1D, 3, 4, 5 | Official board, internship, capstone, co-op, partner pages with dates and scope | Normalize evidence and optional/required status | Optional marketed as required; logo wall without proof | Applied-learning and partnership review facts | High | Public ORX claims |
| Outcomes and quality evidence | Career outcomes; employment reports; accreditation and quality assurance | 1B PDFs, 1D, 5, 6 | Outcome year, cohort, denominator, PDF page refs, accreditor, scope, status date | Extract tables from saved text only | Missing denominator, expired accreditation, non-program scope | Outcome/accreditation conflict and confidence cards | High | Public trust badge or score |
| Institution strategy and infrastructure | Annual reports; strategic plans; research labs and AI centers; startup incubators; faculty development; digital learning infrastructure; career services; student/international support | 1B, 1D, 5 | Official reports/pages, dates, activity proof, concrete services | Summarize and classify evidence strength | Aspirational claim scored as delivered; dormant assets | Improvement evidence preview | Medium-high | ORX guidance and scoring |
| Explanation and governance | ORX Explanation Engine; ORX University Improvement Guidance; ORX Anti-gaming; Published ORX signal <=5% verified-error strategy | 5 ORX Mapper, 6 Gate, Door 2 benchmarks | Signal labels, citations, error rate, source diversity, gaming flags | Draft explanation from evidence only | Unsupported score reason or signal above error threshold | Explanation preview remains blocked | Very high | Public ORX explanation, production score, university guidance |

### Dependencies On Runtime-Open Stages

Door 4 depends on Door 2 evidence/provenance rules. ORX signal mapping is blocked by 5. Public explanations, score effects, trust badges, and published signal releases are blocked by 6. Draft-dependent program evidence is blocked by 4.

### Allowed Work

- Define ORX evidence fields, signal candidate benchmarks, <=5% verified-error strategy, anti-gaming tests, explanation requirements, and improvement-guidance contracts.
- Use saved evidence packs and labeled holdout sets.
- Separate delivered evidence from aspirations, marketing claims, and source-volume inflation.

### Forbidden Work

- No ORX score production, orx_scores writes, public ORX pages, score badges, automated mapper execution, or score-affecting AI output.
- No university improvement guidance shown to external users.
- No marketing-only claim may contribute to ORX.

### Required Evidence

ORX evidence must include signal candidate id, ORX level or dimension if known, entity type, entity id/candidate id, source URL, quote, source type, officialness, date, extraction method, model/provider if AI-derived, confidence, conflict status, anti-gaming flags, benchmark label, reviewer status, and trace id.

### Expected UI Impact

Door 4 appears as Ready for ORX review lane items, ORX candidate scorecards, benchmark status, anti-gaming warnings, explanation previews, and blocked public-output states. It must not expose ORX score actions.

### Admin Action Impact

Admins may inspect ORX evidence candidates and copy handoffs. They may not produce scores, publish ORX outputs, or promote ORX explanations until 5 and 6 close.

### Acceptance Criteria

- All ORX signal candidates have required evidence and benchmark requirements.
- Curriculum, AI exposure, applied learning, outcomes, accreditation, and support signals define review triggers and anti-gaming risks.
- Published ORX signals require <=5% verified-error on a labeled holdout before public consideration.
- ORX explanations cite every score-relevant claim and remain blocked until 5/6.

### Runtime Proof Required Later

- ORX Mapper links every score input to supported evidence.
- Signal benchmarks hold at or below the verified-error threshold.
- Anti-gaming tests block weak, repeated, stale, or marketing-only evidence.
- Explanation preview contains no uncited score claim.

### Blocked Items

All score-affecting ORX work is blocked by 5. Public ORX explanations, trust badges, rankings, university guidance, and orx_scores updates are blocked by 6. Draft-dependent ORX program evidence is blocked by 4.

### Promotion Criteria

Door 4 is accepted when ORX evidence, signal benchmarking, anti-gaming, explanation, improvement guidance, and <=5% verified-error contracts are explicit and remain no-write.

### What Must Remain Simulation-only

ORX Evidence Agent output, candidate signals, future-readiness rollups, explanations, improvement guidance, anti-gaming flags, public ORX outputs, and score release decisions.

## Door 5: Student Evaluation Layer

Status: planned, not implemented

### Purpose

Door 5 defines how verified crawler evidence may later support student-file parsing, program eligibility, application readiness, fit, skills, and risk planning. It does not create production eligibility decisions, student AI advice, public recommendations, CRM automation, or country policy ingestion.

### Included Features From Source Inventory

| Feature group | Included ideas | Current components extended | Required evidence | AI role | Human review trigger | Anti-gaming or safety risk | Expected UI impact | What remains simulation-only |
|---|---|---|---|---|---|---|---|---|
| Eligibility and requirements | Program Requirement Hardness Classifier; Student Evidence Parser; Student-Program Eligibility Matcher; Decision Confidence Engine; Negative Recommendation Engine | 4 Draft Writer, 6 Gate, student file lane later | Verified requirement text, student document evidence, hardness label, confidence, source quote | Parse and compare only in offline benchmark | Any accept/reject edge case, missing source, low OCR confidence | Student evaluation preview blocked from production | False eligibility positives | Eligibility decisions and student-facing advice |
| Program alternatives and apply readiness | Program Substitution Engine; Official Apply Pack; Deadline Radar | 4, 6, Door 2 freshness | Apply links, documents, fees, deadlines, intakes, freshness date | Normalize checklist and date windows from saved evidence | Missing/ambiguous document or old-year deadline | Apply-pack and deadline review facts | Medium-high | Checklist/action automation |
| Country and risk | Country/Visa/Budget risk layer | Country layer later, verified program facts | Dated official policy/cost/visa/budget evidence, source policy | Summarize risk only after source policy exists | Outdated policy, sensitive risk, cost mismatch | Country risk remains blocked/delayed | High | External country policy ingestion |
| Psychological/person-program fit | Interests; work values; learning preference; risk tolerance; language/culture tolerance; financial risk tolerance; career orientation; technical vs human-facing preference; solo vs team preference; research vs applied preference | 4 verified program facts, Door 2 confidence, Door 4 outcomes/labs/applied evidence | Program facts, student preference inputs, advisor labels, sensitive wording rules | Explain fit cautiously from verified facts | Sensitive inference, stereotyping, high-risk recommendation | Fit signals stay advisor-reviewed | Medium-high | Automated ranking or advice |
| Skills and future of work | Program-to-skills mapping; skills-to-occupations mapping; future demand; AI exposure; skill durability; transferability; student fit; ORX program future readiness | 4 program facts, 5 ORX Mapper, external taxonomy later | Outcomes/modules, skill labels, occupation taxonomy later, demand source policy | Map skills from evidence and explain uncertainty | Hallucinated skill, unsupported job promise, speculative demand | Skills preview and benchmark cards | High | Career promises and public future-demand claims |

### Dependencies On Runtime-Open Stages

Door 5 depends on Door 2 provenance and review rules. Verified program requirements require 4 and 6. ORX/future-readiness inputs require 5 and 6. Student-facing production decisions require verified requirements plus human-review rules. Country policy and labor-market facts require an external source policy before any production use.

### Allowed Work

- Define classifier labels, benchmark datasets, decision confidence rules, apply-pack fields, deadline freshness rules, fit dimensions, skills mapping contracts, and country-risk source requirements.
- Simulate eligibility and fit only with saved evidence and manually labeled examples.
- Define negative recommendation safety: no negative recommendation without hard evidence and human-review path.

### Forbidden Work

- No production student eligibility decisions, CRM case automation, student AI advisor decisions, public match recommendations, or country policy ingestion.
- No claim that marketing-only, low-confidence, or unverified facts support eligibility, affordability, ORX, or fit.
- No sensitive psychological/cultural inference without human-approved framing.

### Required Evidence

Door 5 evidence must include verified requirement source, requirement hardness, student evidence source, extraction method, confidence, missing fields, deadline freshness, risk classification, human review trigger, recommended action, blocked reason, and full provenance for every cited program fact.

### Expected UI Impact

Door 5 appears as blocked student-evaluation preview states, requirement hardness benchmark cards, apply-pack/deadline review items, skills and fit candidate labels, and country-risk disabled states. It must not expose student eligibility actions.

### Admin Action Impact

Admins may review evidence and copy handoffs. They may not trigger eligibility production, student advice, CRM automation, or application checklist production before the required gates close.

### Acceptance Criteria

- Requirement hardness, eligibility matching, negative recommendations, apply pack, deadline radar, fit, skills, and country risk have explicit evidence contracts.
- High-stakes student outputs require verified program facts and human-review triggers.
- Fit and skills work cannot override eligibility or verified requirements.
- Country layer is delayed until official source policy, update cadence, and legal/human review requirements exist.

### Runtime Proof Required Later

- Requirement hardness benchmark separates hard, soft, conditional, and unclear rules with low false-positive eligibility risk.
- Eligibility matcher explains every decision from verified requirements and student evidence.
- Deadline radar blocks stale or ambiguous deadlines.
- Fit/skills recommendations are advisor-reviewable and avoid unsupported promises.

### Blocked Items

Student eligibility production, application checklist production, substitutions, negative recommendations, and student advice are blocked by 4 and 6. Decision confidence workflows are blocked by 1E and 6. Country policy, future demand, visa, work rights, safety, and labor-market layers are blocked by external source policy and review.

### Promotion Criteria

Door 5 is accepted when student evaluation, fit, skills, and country-risk contracts are explicit, evidence-first, human-reviewable, and blocked from production decisions.

### What Must Remain Simulation-only

Eligibility matching, student document parsing, negative recommendations, apply packs, deadline alerts, substitutions, fit ranking, skills/occupation mapping, future demand, country/visa/budget risk, and student-facing explanations.

## Door 6: Product Surfaces

Status: planned, not implemented

### Purpose

Door 6 defines the product-surface boundaries for exposing crawler, ORX, and student-evaluation outputs after the original runtime gates close. It is the last door because it converts internal evidence into user-visible, CRM-visible, university-visible, public, or API-visible claims.

### Included Features From Source Inventory

| Surface | Current engine component extended | Required evidence | AI role | Human review trigger | Anti-gaming / safety risk | Expected UI impact | Admin action impact | What cannot be exposed until gates close |
|---|---|---|---|---|---|---|---|---|
| Student App | 4, 6, Door 5 | Verified program facts, citations, freshness, requirement confidence | Explain with citations only later | Any unverified high-stakes fact | Medium-high | Verified-data contract only | No student action in admin | Shortlists, eligibility, public truth |
| Student AI Advisor | 3, 6, Door 5 | Evidence pack, citations, refusal rules | Answer only with verified citations later | Unsupported advice | High | Advisor blocked state | No advisor launch action | Production decisions or advice |
| Public University Pages | 6, Door 2, Door 3 media | Verified facts, public-safe citations, media provenance | Summarize citations later | Conflict, stale claim, weak provenance | High | Public preview/diff only | Dry-run only after 6 | Public page writes |
| University Dashboard | 1E, 6, Door 4 guidance | Evidence gaps, conflicts, stale facts, improvement candidates | Summarize gaps later | Institution dispute | High | Dashboard roadmap card | No external dashboard action | Institution-facing claims |
| CRM Case Handoff | 1E, 4, 6, Door 5 | Approved evidence pack, risks, missing facts, next action | Generate concise handoff from approved facts later | Missing requirement or deadline | Medium | Copy handoff only | No CRM automation | Case automation |
| Admin Review Queue | 1E, Door 2 | Review lanes, triggers, provenance, confidence | Summarize issue | High-impact low-confidence fact | Medium | Review Workbench | Open Review only | Publish from queue |
| ORX Public Explanation | 5, 6, Door 4 | Mapped signals, citations, benchmark error, anti-gaming flags | Draft explanation only from evidence later | Unsupported score reason | High | Explanation preview blocked | No ORX score action | Public ORX scores/explanations |
| Application Checklist | 4, 6, Door 5 | Apply links, docs, deadlines, fees, requirement proof | Normalize checklist later | Ambiguous required document | Medium-high | Checklist preview blocked | No checklist production | Student checklist actions |
| Deadline Alerts | 4, 6, Door 5 | Current-year deadline, observed date, freshness class | Extract date window later | Old year or ambiguous intake | High | Deadline radar blocked state | No alert action | Alert delivery |
| Trust Badges | 6, Door 2 confidence | Provenance completeness, freshness, source diversity, review status | None required | Badge threshold edge case | High | Badge threshold roadmap card | No badge action | Public badges |
| Data Products/API | 6, legal/source policy | Verified facts, source rights, provenance, license review | Summarize field coverage later | Licensing/provenance ambiguity | High | API delayed state | No API action | External API/data products |

### Dependencies On Runtime-Open Stages

Door 6 depends on Door 2 evidence/provenance rules, Door 4 ORX rules for ORX-facing surfaces, Door 5 student evaluation rules for student-facing surfaces, and runtime closure of 6 Verify/Publish Gate before any public or production truth surface.

### Allowed Work

- Define surface contracts, disabled states, preview-only behavior, handoff fields, citation requirements, and production boundaries.
- Define what each surface may show as internal, draft, blocked, preview, or verified.
- Define review and source requirements for future enablement.

### Forbidden Work

- No production UI code, public page writes, CRM automation, student AI advisor launch, trust badge display, data API, or ORX public score.
- No exposing unverified crawler facts as student/public/CRM truth.
- No publish button before Verify/Publish Gate runtime closes.

### Required Evidence

All product surfaces require verified provenance, freshness status, confidence, conflict status, source type, review status, gate status, and a clear distinction between internal preview, draft, verified, public, and blocked.

### Expected UI Impact

Door 6 adds roadmap-visible surface states, blocked public/student/CRM labels, preview-only dry-run states, and future enablement requirements. It must preserve the maximum five primary admin actions.

### Admin Action Impact

The fifth primary action, Dry-run Publish / Promote, remains disabled until Verify/Publish Gate runtime proof exists. Even after dry-run unlocks, real publish remains blocked until the gate is closed and explicit implementation work is approved later.

### Acceptance Criteria

- Each product surface defines its source dependencies, blocked gates, and public/student/CRM boundaries.
- No surface can expose ORX score, student eligibility, trust badge, public page, CRM automation, or API output before its gates close.
- Internal previews preserve provenance and review status.
- Admin UI remains status-first, evidence-first, review-first, and actions-minimal.

### Runtime Proof Required Later

- Verify/Publish Gate proves verified facts can be promoted safely with audit trail.
- Public preview contains only verified facts and citations.
- Student/CRM outputs refuse missing or unverified facts.
- Trust badges and public ORX explanations are withheld when provenance is incomplete.

### Blocked Items

All public, student, CRM, trust badge, ORX public explanation, and data API surfaces are blocked by 6. ORX public surfaces are also blocked by 5. Student eligibility surfaces are blocked by verified requirements, 4, and 6. Country/public policy surfaces are blocked by external source policy and review.

### Promotion Criteria

Door 6 is accepted when product-surface contracts are explicit, blocked outputs are named, and every future surface is bound to verified evidence and runtime gates.

### What Must Remain Simulation-only

Student App outputs, Student AI Advisor decisions, Public University Pages, University Dashboard, CRM automation, ORX public explanations, application checklists, deadline alerts, trust badges, and Data Products/API.

## Expansion Assignment Register

| Door or bucket | Assigned expansion ideas |
|---|---|
| Door 1 already defined | Full Pipeline Orchestrator above existing stages as read-only/supervisory plan; Duplicate Run Guard; Failure Classifier; Retry Policy; Smoke Diagnostics / Evidence Pack; Queue Controls Validation; Safe selected-stage runner; Agent-neutral handoff; Local fallback vs GitHub Actions diagnostics; No-write runtime evidence contract |
| Door 2 | Evidence Knowledge Graph; Provenance model; Quality / Confidence Engine; Official Conflict Resolver; Weak Marketing Claim Detector; Human Review Triggers; Safe Publish Sandbox; Benchmarking System; Admin Review Queue evidence behavior |
| Door 3 | Discovery Intelligence; Deep Program Extraction; PDF Intelligence; JS-render fallback; Multi-domain official handling; Media/file artifact intelligence; Crawl Ethics / Politeness; Crawler Cost Brain; Evidence Freshness SLA; Change Detection |
| Door 4 | Dedupe Engine where ORX/entity candidate duplication affects mapped evidence; ORX Evidence Integration; ORX Signal Candidates; ORX Curriculum and Future Readiness Evidence Agent; curriculum updates; course/module changes; learning outcomes; AI/data/automation exposure; industry advisory boards; internships/co-op/capstone; employer partnerships; career outcomes; employment reports; accreditation and quality assurance; annual reports; strategic plans; research labs and AI centers; startup incubators; faculty development; digital learning infrastructure; career services; student/international support; ORX Explanation Engine; ORX University Improvement Guidance; ORX Anti-gaming; Published ORX signal <=5% verified-error strategy |
| Door 5 | Program Requirement Hardness Classifier; Student Evidence Parser; Student-Program Eligibility Matcher; Decision Confidence Engine; Negative Recommendation Engine; Program Substitution Engine; Official Apply Pack; Deadline Radar; Country/Visa/Budget risk layer; interests; work values; learning preference; risk tolerance; language/culture tolerance; financial risk tolerance; career orientation; technical vs human-facing preference; solo vs team preference; research vs applied preference; program-to-skills mapping; skills-to-occupations mapping; future demand; AI exposure; skill durability; transferability; student fit; ORX program future readiness |
| Door 6 | Student App; Student AI Advisor; Public University Pages; University Dashboard; CRM Case Handoff; Admin Review Queue product surface; ORX Public Explanation; Application Checklist; Deadline Alerts; Trust Badges; Data Products/API |
| Blocked/delayed bucket | Public ORX scores; student eligibility production; CRM automation; public trust badges; data APIs; country policy, visa, work rights, cost-of-living, safety/stability, labor-market-demand, tech-ecosystem, international-student-policy production; any output requiring external source policy, legal review, or Verify/Publish closure |
| Not in scope yet | New crawler/system rewrite; separate simulation lab; production orchestrator; Run All; country crawl; crawler language/i18n changes; 12-locale crawler logic; migrations; Edge Functions; workflows; scripts; Supabase changes |

## Next Step for Claude

After this master planning layer is accepted, Claude should move only to implementation planning for the first approved P0 item, starting with no-write Evidence Pack implementation details. Door 2-6 feature work should remain blocked until the relevant original Crawler v2 runtime gates close.
