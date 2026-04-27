# Crawler v2 Admin UI Five-Action Contract

Status: planning contract only
Scope: future `/admin/crawler-v2` behavior; no UI implementation
Baseline: current Crawler v2 engine remains the system of record

## Executive Snapshot

The future admin UI must stay status-first, evidence-first, review-first, and actions-minimal. Expansion features must not create a crowded control panel. The interface may expose at most five primary visible actions, and several of those actions remain disabled until original Crawler v2 runtime gates close.

Door 0 and Door 1 define the baseline and run diagnostics. Doors 2-6 define evidence, extraction, ORX, student evaluation, and product-surface planning. This UI contract binds those doors to a single admin surface without adding production behavior.

## Five Primary Visible Actions

| # | Primary action | Earliest door | Purpose | Enabled when | Forbidden before enablement |
|---:|---|---|---|---|---|
| 1 | Create / Select Run | Door 1 | Start from a bounded run identity or select an existing run | Door 1 safety rules and duplicate-run behavior are respected | Run All, country crawl, unbounded scope |
| 2 | Run Safe Stage | Door 1 | Run one approved original stage with prerequisites and refusal rules | Queue Controls and selected-stage runtime proof exist for the requested stage | Running runtime-open stages unsafely; triggering publish |
| 3 | Generate Evidence Pack | Door 1 | Produce a no-write diagnostic pack for a run/item | Evidence Pack contract fields are available | Canonical writes, crawler execution beyond selected safe stage |
| 4 | Open Review | Door 2 | Inspect review lanes, evidence, provenance, conflicts, and blocked facts | Review Surface runtime behavior exists for the needed lane | Publishing from review, ORX scoring, student eligibility decisions |
| 5 | Dry-run Publish / Promote | Door 2 and Door 6 | Preview publish/promote effects with zero writes | Verify/Publish Gate runtime closes and dry-run proof exists | Real publish, canonical writes, public pages, trust badges, ORX scores |

Hard rules:

- No more than five primary visible buttons.
- No Run All visible by default.
- No country crawl visible by default.
- No publish button before Verify/Publish Gate runtime closes.
- No ORX scoring action before ORX Mapper plus Verify/Publish Gate runtime close.
- No student eligibility action before verified program requirements exist.
- Extra actions must go into a kebab menu, drawer, or collapsed advanced area.
- The interface must never become crowded with per-feature buttons.

## Action Placement Rules

| Action type | Placement | Examples | Rule |
|---|---|---|---|
| Primary run actions | Top-level primary action area | Create / Select Run; Run Safe Stage; Generate Evidence Pack; Open Review; Dry-run Publish / Promote | Maximum five visible actions |
| Secondary review actions | Row or drawer level | Approve, reject, needs source, mark conflict, open source, copy handoff | Never promoted to global primary buttons |
| Diagnostic details | Drawer, card, or collapsed advanced area | trace ids, logs, benchmark inputs, failure detail, source hashes | Visible only when context is selected |
| Dangerous or broad actions | Hidden by default | Run All, country crawl, publish, ORX score production, student eligibility production | Not available in this planning contract |

## Layout Contract

### Run Header

| Field | Contract |
|---|---|
| Purpose | Anchor the UI around one run or run item and make safety state visible before actions. |
| Data shown | run_id, run_item_id, university_id, website, target_domain, run status, current stage, progress, created_at, updated_at, active blockers, duplicate-run warning, no-write status. |
| Allowed actions | Create / Select Run; Generate Evidence Pack when a run is selected; Run Safe Stage only when prerequisites are met. |
| Forbidden actions | Run All, country crawl, publish, ORX scoring, student eligibility, canonical writes. |
| Empty state | Prompt to select an existing run or create a bounded run shell when allowed. |
| Loading/error state | Show run-loading state, fetch failure, missing run, or stale local state without triggering crawler execution. |
| Blocked state | Show blocker reason such as Queue Controls not closed, Verify/Publish not closed, duplicate active run, or missing target domain. |
| Proof required before enabling actions | Door 1 duplicate guard behavior; selected-stage prerequisites; no-write Evidence Pack contract; queue control runtime proof for stage execution. |

### Overview Cards

| Field | Contract |
|---|---|
| Purpose | Summarize health, evidence coverage, freshness, confidence, conflicts, and blocked gates at a glance. |
| Data shown | Raw pages count, crawler_page_candidates count and breakdown, evidence_items count and extraction method/model breakdown, telemetry summary, draft count if available, ORX output count if available, publish audit count if available, confidence distribution, conflict count, freshness status, cost/yield estimate. |
| Allowed actions | Open Evidence Pack Drawer; Open Review filtered to a lane; copy handoff from drawer. |
| Forbidden actions | Per-card execution buttons, publish buttons, ORX score buttons, student eligibility buttons. |
| Empty state | Show "No evidence yet for selected run" and list missing stage outputs. |
| Loading/error state | Show count loading, stale count warning, or failed count query as diagnostic state. |
| Blocked state | Show closed/open gate labels: 1E, 2, 4, 5, 6. |
| Proof required before enabling actions | Counts must come from saved run/evidence outputs; each card must link to source detail or blocked reason. |

### Stage Timeline

| Field | Contract |
|---|---|
| Purpose | Show original Crawler v2 stage progress without implying a new pipeline or orchestrator. |
| Data shown | 1A, 1B, 1C, 1D, 1E, 2, 3, 4, 5, 6 status, latest telemetry, errors, failure_reason, failure_detail, trace ids, timestamps. |
| Allowed actions | Run Safe Stage for an eligible selected stage only; Generate Evidence Pack. |
| Forbidden actions | Full Pipeline Orchestrator execution, Run All, hidden publish, automatic next-stage chaining. |
| Empty state | Show baseline stages and which are runtime-closed vs runtime-open. |
| Loading/error state | Show missing telemetry or unreadable stage status as diagnostics, not as a reason to auto-run. |
| Blocked state | Mark runtime-open stages that cannot be promoted yet. |
| Proof required before enabling actions | Stage-specific prerequisites, queue-control proof, and refusal rules from Door 1. |

### Review Workbench

| Field | Contract |
|---|---|
| Purpose | Let reviewers inspect evidence, confidence, conflicts, weak claims, and blocked reasons. |
| Data shown | Critical, Conflicts, Needs Evidence, Low Confidence, Ready for Draft, Ready for ORX, Blocked lanes; row-level provenance; recommended action; risk level. |
| Allowed actions | Row-level approve, reject, needs source, mark conflict, open source, copy handoff when later implemented. |
| Forbidden actions | Global publish, ORX score production, student eligibility production, public page updates. |
| Empty state | Show "No review items for this lane" with the lane entry criteria. |
| Loading/error state | Show lane-loading and evidence-loading states separately. |
| Blocked state | Show runtime gate or missing provenance reason per item. |
| Proof required before enabling actions | 1E runtime closure for reviewer execution; Door 2 provenance and review contracts. |

### Evidence Pack Drawer

| Field | Contract |
|---|---|
| Purpose | Provide a compact no-write packet that a human, Claude, Codex, or another reviewer can use to continue the run safely. |
| Data shown | run_id, run_item_id, university_id, website, target_domain, run status, item stage/progress, raw_pages count/latest summary, page candidates count/breakdown, evidence_items count/method/model breakdown, telemetry timeline, errors, trace ids, timestamps, draft count, ORX output count, publish audit count, no-write verification statement. |
| Allowed actions | Copy handoff; download/export later only if approved; open source URL. |
| Forbidden actions | Trigger stage execution, publish, update canonical data, create ORX score, create student decision. |
| Empty state | Show missing pack fields and which stage must close before full pack coverage exists. |
| Loading/error state | Show pack generation error with trace id and no-write status. |
| Blocked state | Mark unavailable draft/ORX/publish sections until stages 4/5/6 close. |
| Proof required before enabling actions | Evidence Pack contract completeness and no-write verification. |

### Expansion Doors Roadmap

| Field | Contract |
|---|---|
| Purpose | Show future expansion gates without turning them into runnable product controls. |
| Data shown | Door 0-6 status, dependencies, blocked gates, examples of features, allowed next planning step, and promotion criteria. |
| Allowed actions | View door contract; copy planning handoff. |
| Forbidden actions | Feature launch buttons, crawler expansion execution, public surface enablement, country policy ingestion. |
| Empty state | Show Door 0/1 baseline and mark Doors 2-6 as planning-only until accepted. |
| Loading/error state | Show docs unavailable or version mismatch; never execute code to rebuild docs. |
| Blocked state | Show dependencies on 1E, 2, 4, 5, 6, external source policy, or legal review. |
| Proof required before enabling actions | Runtime proof listed in the relevant door and explicit implementation approval later. |

## Feature Expansion Placement

| Expansion family | UI placement | Must stay hidden or disabled |
|---|---|---|
| Operations diagnostics | Run Header, Overview Cards, Stage Timeline, Evidence Pack Drawer | Full Pipeline Orchestrator execution, Run All, country crawl |
| Evidence/trust | Review Workbench, Evidence Pack Drawer | Auto publish, automatic conflict resolution |
| Crawler extraction | Overview Cards, Stage Timeline, Review Workbench | Live discovery expansion, JS render execution, media publish |
| ORX evidence | Review Workbench Ready for ORX lane, Roadmap | ORX scoring and public explanation actions |
| Student evaluation | Roadmap, blocked preview cards | Eligibility production, student AI advisor decisions |
| Product surfaces | Expansion Doors Roadmap | Public pages, trust badges, CRM automation, data API |

## Production Boundary

The admin UI may show blocked and preview states, but it must not expose product outputs as truth until Verify/Publish Gate closes. Public, CRM, student, ORX score, trust badge, and data API actions remain blocked even if evidence appears complete.
