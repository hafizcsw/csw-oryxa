# Crawler v2 Review Workbench Contract

Status: planning contract only
Scope: future review section behavior; no UI or backend implementation
Baseline: current Crawler v2 evidence remains the source of truth

## Executive Snapshot

The Review Workbench is the evidence inspection and human judgment layer for Crawler v2. It organizes facts, conflicts, low-confidence extractions, weak claims, ORX candidates, draft candidates, and blocked items into review lanes. It must preserve provenance for every reviewed fact and must not publish, score ORX, or produce student eligibility decisions.

The workbench is a Door 2 contract that supports later Doors 3-6. Row-level actions are secondary review controls, not global primary buttons.

## Review Lanes

| Lane | Purpose | Typical items | Required exit | Blocked outputs |
|---|---|---|---|---|
| Critical | Capture high-impact facts that could harm publish, ORX, student, CRM, or public outputs | Fees, deadlines, requirements, accreditation, outcome metrics, publish-impacting conflicts | Human decision, escalation, or rejection | Publish, ORX scoring, student advice |
| Conflicts | Resolve contradictory official evidence without silent overwrite | Page-vs-PDF conflict, old-vs-new deadline, different tuition values, domain alias conflict | Review rationale with selected source or blocked reason | Canonical writes and public display |
| Needs Evidence | Block claims that lack sufficient official support | Missing quote, missing source URL, marketing-only claim, unsupported AI-derived fact | Source added, claim rejected, or item remains blocked | ORX, student, CRM, public outputs |
| Low Confidence | Triage facts whose extraction or source strength is weak | Low model confidence, low deterministic confidence, ambiguous field, OCR issue | Human approval with rationale, improved evidence, or rejection | Automatic promotion |
| Ready for Draft | Facts that may support draft simulation when Draft Writer closes | Program fields, apply links, requirements, media/artifacts with complete provenance | Draft preview only until 4 closes | Draft writes before 4 closes |
| Ready for ORX | Evidence candidates that may feed ORX mapping simulation | AI exposure, applied learning, accreditation, outcomes, skills, support evidence | ORX candidate label only until 5 closes | ORX score production |
| Blocked | Items stopped by a runtime gate, missing evidence, or safety rule | Publish candidate before 6, eligibility before verified requirements, country policy before source policy | Gate closes or item is rejected/removed | Any production effect |

## Review Item Contract

Each review item must show the following fields.

| Field | Requirement |
|---|---|
| field | The fact field under review, such as tuition, deadline, requirement, accreditation, AI exposure, or career outcome |
| value | The proposed value exactly as extracted or normalized |
| entity type | University, program, page candidate, evidence item, ORX signal candidate, student match candidate, artifact, or publish candidate |
| entity id or candidate id | Stable id when available; candidate id when not yet persisted |
| source_url | Official source URL or blocked reason if missing |
| evidence quote | Short source quote or PDF page reference supporting the value |
| source type | Official page, PDF, catalog, report, media artifact, root domain, subdomain, partner domain, student document, external policy later |
| confidence | Field-level confidence plus reason inputs when available |
| conflict status | None, possible conflict, confirmed conflict, resolved in review, blocked conflict |
| risk level | Low, medium, high, critical |
| trace_id | Trace id or list of trace ids connecting the item to crawler telemetry |
| extraction method | Basic Extract, AI Extract, PDF extraction, manual label, benchmark label, future matcher |
| model/provider if AI-derived | Model and provider for AI-derived values; blank for deterministic extraction |
| recommended action | Approve, reject, needs source, mark conflict, open source, copy handoff, or keep blocked |
| blocked reason if blocked | Missing gate, missing provenance, low confidence, unresolved conflict, external source policy missing, safety rule |

## Row-Level Secondary Actions

| Action | Purpose | Allowed scope | Forbidden effect |
|---|---|---|---|
| approve | Mark a reviewed fact as acceptable for the next blocked stage | Row or drawer only | Publish, canonical write, ORX score, student decision |
| reject | Remove an unsupported or unsafe proposed fact from consideration | Row or drawer only | Deleting source evidence or canonical data |
| needs source | Require stronger official evidence | Row or drawer only | Live crawl or external API call |
| mark conflict | Record that official evidence disagrees | Row or drawer only | Automatic conflict winner |
| open source | Inspect the official source in context | Row or drawer only | Fetching new crawler content |
| copy handoff | Copy a reviewer/agent-neutral summary | Row or drawer only | CRM automation or public output |

Rules:

- These actions are row-level or drawer-level actions, not global primary buttons.
- No publish from a review item before Verify/Publish Gate closes.
- No ORX score production from a review item.
- No student eligibility production from a review item.
- High-impact, low-confidence, or conflict items must require human review.
- Marketing-only claims must not affect ORX or student recommendations.
- Every reviewed fact must preserve provenance.

## Lane Entry Rules

| Trigger | Lane |
|---|---|
| High-impact fact with missing source, low confidence, conflict, or publish effect | Critical |
| Two or more official sources disagree | Conflicts |
| Source URL, quote, date, or officialness is missing | Needs Evidence |
| Confidence below threshold or extraction uncertainty present | Low Confidence |
| Provenance complete and draft-dependent output is next | Ready for Draft |
| Provenance complete and ORX signal candidate is next | Ready for ORX |
| Runtime gate, source policy, legal review, or safety rule prevents progress | Blocked |

## Human Review Triggers

Human review is required when any of the following are true:

- Fact affects tuition, fees, deadline, admission requirement, visa/country risk, accreditation, outcomes, ORX signal, public page, trust badge, CRM handoff, or student eligibility.
- Source is a PDF with uncertain page reference or extraction quality.
- AI-derived value lacks deterministic corroboration.
- Evidence is marketing-only, aspirational, stale, or unsupported by official pages.
- Domain officialness is not established.
- Confidence is low or conflict status is possible/confirmed.
- The item could lead to a negative recommendation or exclusion of a student.

## Evidence And Provenance Rules

| Rule | Contract |
|---|---|
| Source preservation | Keep source_url, source type, observed_at, quote, and trace_id attached to every fact |
| AI transparency | Store extraction method and model/provider for AI-derived facts |
| Conflict preservation | Do not overwrite conflicting values without retaining both sources and review rationale |
| Weak claim isolation | Marketing-only claims can be copied as context but cannot power ORX, student, CRM, or public outputs |
| No-write review | Review actions in this contract do not publish or update canonical entities |
| Blocked reason | Every blocked item must explain which gate or evidence rule blocks it |

## Workbench Output States

| State | Meaning | Allowed next step |
|---|---|---|
| Reviewed approved | Human accepts evidence for a later blocked stage | Remain internal until target stage closes |
| Reviewed rejected | Human rejects claim or candidate | Keep audit note, do not promote |
| Needs source | More official evidence required | Return to evidence collection planning; no live crawl in this PR |
| Conflict open | Contradiction unresolved | Stay in Conflicts or Critical |
| Ready internal | Suitable for no-write draft/ORX simulation | Use only in simulation or benchmark |
| Blocked by gate | Runtime or policy gate prevents use | Wait for gate closure |

## Door Dependencies

| Door | Workbench relationship |
|---|---|
| Door 1 | Evidence Pack and diagnostics feed workbench context |
| Door 2 | Defines lanes, provenance, confidence, conflict, weak-claim, and benchmark behavior |
| Door 3 | Sends extraction uncertainty, freshness, artifact, domain, and change items into lanes |
| Door 4 | Sends ORX candidate evidence into Ready for ORX, Critical, Conflicts, or Blocked |
| Door 5 | Sends requirement, student match, fit, skills, deadline, and country-risk items into review lanes |
| Door 6 | Consumes only verified, gate-approved facts for product surfaces later |

## Acceptance Criteria

- Every lane has entry criteria, exit criteria, blocked outputs, and evidence requirements.
- Every item shows the full review item contract.
- Row-level actions are secondary and cannot become global primary buttons.
- No review action publishes, scores ORX, creates student eligibility decisions, writes canonical data, or calls external APIs.
- High-impact and low-confidence facts require human review.
- Provenance is preserved for approved, rejected, conflicted, and blocked facts.

## Runtime Proof Required Later

- A reviewer can open a lane, inspect a fact, source quote, source URL, confidence, conflict status, trace id, method, and recommendation.
- Approve/reject/needs-source/mark-conflict actions preserve audit detail and do not publish.
- Blocked items clearly explain the missing runtime gate.
- Review outcomes can be included in a no-write Evidence Pack.
