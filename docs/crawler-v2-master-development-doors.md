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

Purpose: define safe run-control, diagnostic, and handoff planning above the current Crawler v2 stages.

Depends on:

- Door 0 accepted.
- Runtime closure or explicit simulation-only handling for 2 Queue Controls.

Examples of features from PR #4:

- Full Pipeline Orchestrator above existing stages.
- Duplicate Run Guard.
- Failure Classifier.
- Retry Policy.
- Smoke Diagnostics / Evidence Pack.
- Queue Controls validation.
- Safe selected-stage runner.
- Agent-neutral handoff for Claude/Codex/human.

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
