# Crawler v2 UI Door Mapping

Status: UI planning map only
Scope: maps Door 0-6 to future admin behavior; no UI implementation
Baseline: five-action admin contract

## Executive Snapshot

This document maps each Crawler v2 development door to the future `/admin/crawler-v2` interface. It explains what appears in the Run Header, Overview Cards, Stage Timeline, Review Workbench, Evidence Pack Drawer, and Expansion Doors Roadmap; what stays hidden; what stays disabled; and what unlocks only after runtime proof.

No feature may add a sixth global primary action.

## Door 0: Baseline & Safety

| UI area | Behavior |
|---|---|
| Run Header | Show baseline status, selected run, target domain, and global safety warnings. |
| Overview Cards | Show original engine baseline and runtime-closed/open summary. |
| Stage Timeline | Mark 1A, 1B, 1C, 1D, and 3 as runtime closed; mark 1E, 2, 4, 5, and 6 as runtime open. |
| Review Workbench | Hidden or disabled until Door 2/1E proof exists. |
| Evidence Pack Drawer | May show baseline field checklist only. |
| Expansion Doors Roadmap | Door 0 complete; future doors blocked until mapped. |
| Must stay hidden | Run All, country crawl, publish, canonical writes, ORX score production, student eligibility production, language/i18n controls. |
| Disabled and why | Product outputs disabled because Verify/Publish Gate is not closed. |
| Unlocks after runtime proof | Nothing directly; Door 0 is the safety foundation. |

## Door 1: Run Control & Diagnostics

| UI area | Behavior |
|---|---|
| Run Header | Show run_id, run_item_id, status, duplicate-run warning, no-write mode, and allowed primary actions. |
| Overview Cards | Show diagnostics counts: raw pages, candidates, evidence items, telemetry, errors, drafts/ORX/publish counts if available. |
| Stage Timeline | Show safe selected-stage eligibility, queue status, failure class, retry recommendation, and blocked gates. |
| Review Workbench | Link to Open Review remains disabled until Door 2/1E requirements are satisfied. |
| Evidence Pack Drawer | Primary diagnostic surface for no-write Evidence Pack and agent-neutral handoff. |
| Expansion Doors Roadmap | Door 1 complete; queue, retry, duplicate guard, and diagnostics are prerequisites for later runtime work. |
| Must stay hidden | Full Pipeline Orchestrator execution, GitHub Actions runtime diagnostics, Run All, country crawl, publish. |
| Disabled and why | Run Safe Stage disabled when queue controls or selected-stage prerequisites are not proven. |
| Unlocks after runtime proof | Safe selected-stage execution for approved stages; Evidence Pack generation with complete available fields. |

## Door 2: Evidence & Review Workbench

| UI area | Behavior |
|---|---|
| Run Header | Show evidence readiness, review blockers, and no-write status. |
| Overview Cards | Show confidence distribution, conflict count, weak-claim count, missing provenance count, benchmark status. |
| Stage Timeline | Link stage outputs to evidence and review lanes. |
| Review Workbench | Show Critical, Conflicts, Needs Evidence, Low Confidence, Ready for Draft, Ready for ORX, and Blocked lanes. |
| Evidence Pack Drawer | Show provenance, confidence, conflict, reviewer status, benchmark labels, and blocked reasons. |
| Expansion Doors Roadmap | Door 2 controls trust prerequisites for Doors 3-6. |
| Must stay hidden | Publish from review item, ORX score action, student eligibility action, canonical update action. |
| Disabled and why | Row-level approve/reject remains non-publishing; real review execution depends on 1E. |
| Unlocks after runtime proof | Reviewer workflow execution after 1E; dry-run publish preview after 6; draft/ORX readiness after 4/5. |

## Door 3: Extraction Expansion

| UI area | Behavior |
|---|---|
| Run Header | Show extraction expansion mode as planning/benchmark only. |
| Overview Cards | Show discovery coverage, PDF/artifact inventory, JS-render-needed flags, domain alias warnings, freshness summary, change summary, cost/yield estimate. |
| Stage Timeline | Show which original stage would own each expansion: 1B fetch, 1C planner, 1D/3 extraction, 2 queue controls, 4 draft, 6 gate. |
| Review Workbench | Route extraction uncertainty, stale evidence, domain conflicts, weak PDFs, and change items into lanes. |
| Evidence Pack Drawer | Show artifact details, file hashes, page refs, source officialness, freshness, and change diffs. |
| Expansion Doors Roadmap | Show Door 3 features as simulation/benchmark/prototype candidates. |
| Must stay hidden | Live discovery expansion, JS render button, PDF crawl/OCR button, media publish, country crawl. |
| Disabled and why | Extraction prototypes disabled until required runtime gate closes; media/public use disabled until 6. |
| Unlocks after runtime proof | Selected-stage extraction tests after 2/4 as applicable; public-safe freshness enforcement after 6. |

## Door 4: ORX Evidence Layer

| UI area | Behavior |
|---|---|
| Run Header | Show ORX evidence as candidate-only and score-disabled. |
| Overview Cards | Show ORX candidate count, signal benchmark status, anti-gaming flags, unsupported-signal count. |
| Stage Timeline | Mark 5 ORX Mapper and 6 Verify/Publish Gate as required before score/public effects. |
| Review Workbench | Use Ready for ORX lane plus Critical/Conflicts/Needs Evidence for weak or risky signals. |
| Evidence Pack Drawer | Show signal candidate, evidence quote, source type, confidence, anti-gaming flag, benchmark label, verified-error status. |
| Expansion Doors Roadmap | Show ORX release strategy, <=5% verified-error target, explanation and guidance as blocked. |
| Must stay hidden | ORX score production, public ORX explanation, score badge, orx_scores update, university guidance output. |
| Disabled and why | ORX actions disabled until 5 and 6 close and benchmark threshold is met. |
| Unlocks after runtime proof | ORX Mapper evidence links after 5; public explanation/dry-run score preview only after 6 and benchmark proof. |

## Door 5: Student Evaluation Layer

| UI area | Behavior |
|---|---|
| Run Header | Show student evaluation as blocked until verified requirements exist. |
| Overview Cards | Show requirement hardness benchmark status, deadline freshness, apply-pack completeness, skills/fit evidence coverage, country-risk policy status. |
| Stage Timeline | Mark 4 Draft Writer and 6 Verify/Publish Gate as required for verified requirements; mark external policy dependencies. |
| Review Workbench | Route requirements, deadlines, apply pack items, skills, fit, and risk items to appropriate lanes. |
| Evidence Pack Drawer | Show requirement source, student evidence source if later available, hardness, confidence, missing fields, blocked reason. |
| Expansion Doors Roadmap | Show eligibility, fit, skills, and country layer as benchmark/prototype/delayed work. |
| Must stay hidden | Student eligibility action, student AI decision, CRM automation, country policy ingestion, public recommendation. |
| Disabled and why | Eligibility disabled until verified requirements exist and 4/6 close; country risk disabled until external source policy exists. |
| Unlocks after runtime proof | Requirement and apply-pack prototypes after 4/6; student-facing decisions only after verified requirements plus review proof. |

## Door 6: Product Surfaces

| UI area | Behavior |
|---|---|
| Run Header | Show product-surface gate state and public/student/CRM lock status. |
| Overview Cards | Show preview readiness for Student App, Student AI Advisor, Public University Pages, University Dashboard, CRM Case Handoff, ORX Public Explanation, Application Checklist, Deadline Alerts, Trust Badges, Data Products/API. |
| Stage Timeline | Highlight Verify/Publish Gate as final blocker for product truth. |
| Review Workbench | Product-impacting items enter Critical or Blocked unless verified and gate-approved. |
| Evidence Pack Drawer | Show public-safe citations, verified status, blocked product effects, and dry-run publish diff when later enabled. |
| Expansion Doors Roadmap | Show product surfaces as delayed until gates close. |
| Must stay hidden | Real publish, public page write, trust badge display, data API launch, CRM automation, student AI advisor production decision. |
| Disabled and why | Dry-run Publish / Promote disabled until 6 closes; real publish not part of this planning contract. |
| Unlocks after runtime proof | No-write dry-run preview after 6; production/public outputs only in later approved implementation PRs. |

## Cross-Door Hidden And Disabled Controls

| Control or output | UI state | Reason |
|---|---|---|
| Run All | Hidden by default | Unsafe broad execution; not part of planning contract |
| Country crawl | Hidden by default | Broad crawler action and country layer is delayed |
| Publish | Hidden/disabled | Verify/Publish Gate is runtime-open and this PR is no-write |
| Canonical writes | Hidden | Forbidden until explicit later implementation and gate closure |
| ORX scoring | Hidden/disabled | ORX Mapper and Verify/Publish Gate are not closed for score production |
| Student eligibility | Hidden/disabled | Verified program requirements do not yet support production decisions |
| Trust badges | Hidden/disabled | Public evidence threshold depends on Verify/Publish Gate |
| Public data API | Hidden/disabled | Requires verified facts, provenance, legal/source review, and 6 closure |
| Language/i18n crawler controls | Hidden | Explicitly out of scope |

## UI Unlock Rules

| Unlock | Required proof |
|---|---|
| Generate Evidence Pack | Door 1 no-write contract fields are available for the selected run or run item |
| Run Safe Stage | Queue Controls and selected-stage refusal rules are runtime-proven for the requested stage |
| Open Review | Door 2 review item contract is available and 1E behavior is runtime-proven for reviewer execution |
| Dry-run Publish / Promote | Verify/Publish Gate runtime closes and dry-run proves zero writes |
| Ready for Draft lane execution | Draft Writer closes and draft output preserves provenance |
| Ready for ORX lane execution | ORX Mapper closes and signal candidate has benchmark evidence |
| Student evaluation preview | Verified requirements exist and Door 5 benchmark thresholds are met |
| Public/CRM/student outputs | Verify/Publish Gate closes and later implementation PR explicitly approves the surface |

## Expansion Idea Coverage

| Expansion family | UI home | Door |
|---|---|---|
| Smoke diagnostics, queue validation, duplicate run guard, failure classifier, retry policy, selected-stage runner, read-only orchestrator, agent-neutral handoff | Run Header, Stage Timeline, Evidence Pack Drawer | Door 1 |
| Evidence graph, provenance, confidence, conflict resolver, weak claim detector, review triggers, safe publish sandbox, benchmarks | Review Workbench, Evidence Pack Drawer, Overview Cards | Door 2 |
| Discovery, deep extraction, PDFs, JS fallback, multi-domain, media artifacts, ethics, cost, freshness, change detection | Overview Cards, Stage Timeline, Review Workbench, Evidence Pack Drawer | Door 3 |
| ORX evidence, ORX signals, curriculum/future readiness, applied learning, outcomes, accreditation, anti-gaming, <=5% strategy | Ready for ORX lane, Overview Cards, Roadmap | Door 4 |
| Student eligibility, requirements, apply pack, deadlines, fit, skills, country/visa/budget risk | Review Workbench, Overview Cards, Roadmap | Door 5 |
| Student App, Student AI Advisor, public pages, university dashboard, CRM handoff, admin queue, ORX explanation, checklist, alerts, badges, API | Expansion Doors Roadmap, blocked product cards | Door 6 |

## Contract Summary

The UI is not a feature launcher. It is a controlled evidence and safety surface. New expansion ideas appear as status, evidence, review, benchmark, blocked, or roadmap states until the original Crawler v2 runtime gates close and later implementation PRs are explicitly approved.
