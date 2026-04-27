# Crawler v2 Development Roadmap

Status: staged planning roadmap only
Scope: implementation order and stop conditions; no implementation
Baseline: original Crawler v2 remains the engine of record

## Executive Snapshot

This roadmap turns the completed Door 0-6 planning layer into staged implementation order. It does not authorize production work. Every item is tied to a Door, blocked runtime stage, implementation type, evidence requirement, UI surface, human-review need, acceptance criteria, and rollback/stop condition.

Priority order is evidence and safety first, simulation and benchmarks second, prototypes third, and production/public/student/CRM/data products last.

## P0: Close Original Engine And Safety Enablers

| Roadmap item | Required Door | Blocked-by stage | Implementation type | Allowed before runtime closure? | Required evidence | Required UI surface | Human review needed? | Acceptance criteria | Rollback/stop condition |
|---|---|---|---|---|---|---|---|---|---|
| Close original runtime-open stages | Door 0 | 1E, 2, 4, 5, 6 | runtime later | No, closure itself is the prerequisite | Stage telemetry, expected outputs, errors, publish audit where relevant | Stage Timeline | Yes for 1E/6 proof | Each original stage passes bounded runtime proof without unsafe side effects | Any crawler execution path risks Run All, country crawl, publish, or canonical writes |
| Evidence Pack implementation | Door 1, Door 2 | partial 1E/4/5/6 | runtime later | Yes, only for closed-stage no-write diagnostics | run_id, run_item_id, university_id, website, target_domain, counts, telemetry, errors, traces, no-write statement | Evidence Pack Drawer | Yes when high-impact facts are included | Pack covers all available fields and clearly marks unavailable stage sections | Any missing no-write proof or unsupported fact presented as verified |
| Queue Controls validation | Door 1 | 2 | runtime later | No for mutation; docs/tests can be specified | Queue status, leases, control events, retry attempts, lock state | Stage Timeline, Run Header | Yes for failure cases | Pause, resume, stop, retry, selected-stage refusal behavior is proven on isolated runs | Stuck lock, skipped state, unsafe retry, or unbounded stage run |
| Provenance model audit | Door 2 | 4/6 for full enforcement | benchmark | Yes, against saved rows/packs only | Source URL, quote, observed_at, content hash, extraction method, trace id | Review Workbench, Evidence Pack Drawer | Yes for missing high-impact provenance | Every proposed fact has provenance or explicit null reason | Any high-impact fact lacks source URL/quote/trace and is not blocked |
| No-write diagnostics | Door 1, Door 2 | 6 for publish preview | runtime later | Yes, when read-only | No-write statement, operation log, target effects list, blocked writes | Evidence Pack Drawer, Stage Timeline | Yes for publish-impacting previews | Diagnostics prove zero writes and identify blocked effects | Any diagnostic mutates canonical data or triggers crawler execution |

## P1: Simulation And Benchmarkable Evidence Improvements

| Roadmap item | Required Door | Blocked-by stage | Implementation type | Allowed before runtime closure? | Required evidence | Required UI surface | Human review needed? | Acceptance criteria | Rollback/stop condition |
|---|---|---|---|---|---|---|---|---|---|
| Confidence Engine benchmark | Door 2 | 1E/6 for production use | benchmark | Yes, saved packs only | Human labels, confidence inputs, source strength, conflicts, freshness | Review Workbench, Overview Cards | Yes | Confidence predicts reviewer agreement and routes low-confidence facts correctly | High-confidence unsupported facts exceed threshold |
| Conflict Resolver benchmark | Door 2 | 1E/6 | benchmark | Yes, saved packs only | Conflicting official values, source type, recency, page type, reviewer label | Review Workbench Conflicts lane | Yes | Known conflicts route to review with both sources preserved | Resolver silently chooses a winner for high-impact conflict |
| Weak Marketing Claim benchmark | Door 2, Door 4 | partial 1E | benchmark | Yes, saved text only | Claim text, source page type, factual support labels | Review Workbench Needs Evidence lane | Yes for score/advice candidates | Marketing-only claims are blocked from ORX and student use | Marketing-only claim is accepted as evidence |
| ORX Signal Candidate benchmark | Door 4 | 5/6 | benchmark | Yes, saved evidence only | Signal labels, citations, benchmark pack, error rate, anti-gaming flags | Ready for ORX lane, Roadmap | Yes | Candidate signal has measurable support and publishable subset targets <=5% verified error | Unsupported or high-error signal proposed for score |
| Program Requirement Hardness benchmark | Door 5 | 4/6 | benchmark | Yes, saved requirement snippets only | Requirement text, hardness label, source URL, reviewer label | Review Workbench, Roadmap | Yes | Hard/soft/conditional/unclear classes are reliable with low false-positive eligibility risk | Hard requirement is missed or soft requirement blocks a student |
| Deadline Radar benchmark | Door 5 | 4/6 | benchmark | Yes, saved deadline snippets only | Date text, intake, observed_at, source year, freshness | Review Workbench, Overview Cards | Yes | Old-year and ambiguous dates are blocked; current deadlines cite source | Stale date accepted as current |
| Anti-gaming benchmark | Door 4 | 5/6 | benchmark | Yes, synthetic and saved examples only | Source diversity, claim strength, repeated language, weak signal flags | Ready for ORX lane, Roadmap | Yes | Source-volume, buzzword, stale-source, and logo-wall inflation are flagged | Gaming examples pass as strong signals |

## P2: Prototypes After Relevant Runtime Gates Close

| Roadmap item | Required Door | Blocked-by stage | Implementation type | Allowed before runtime closure? | Required evidence | Required UI surface | Human review needed? | Acceptance criteria | Rollback/stop condition |
|---|---|---|---|---|---|---|---|---|---|
| Discovery Intelligence prototype | Door 3 | 2/4 for production use | prototype | Simulation yes; runtime no | URL candidates, anchor text, officialness, known-useful labels | Overview Cards, Stage Timeline | Yes for alias/officialness exceptions | Useful-page lift beats baseline without non-official drift | Candidate ranking favors non-official or irrelevant pages |
| PDF Intelligence prototype | Door 3 | 4/6 | prototype | Simulation yes; runtime no | PDF URL, file hash, page ref, extracted text, quote, date | Evidence Pack Drawer, Review Workbench | Yes | Extracted facts cite page refs and match labels | Page reference missing or old PDF treated as current |
| Change Detection prototype | Door 3 | 4/6 | prototype | Simulation yes; runtime no | Old/new hashes, semantic diff, affected fields, prior evidence | Overview Cards, Stage Timeline | Yes for material changes | Material changes are detected; noise is ignored | Diff creates false publish/update pressure |
| ORX Evidence Agent prototype | Door 4 | 5/6 | prototype | Simulation yes; runtime no | Catalog text, outcomes, signal labels, citations, benchmark error | Ready for ORX lane | Yes | AI output cites evidence and meets signal benchmark threshold | AI infers unsupported curriculum or future-readiness claim |
| Student Eligibility prototype | Door 5 | 4/6 and verified requirements | prototype | Simulation yes; production no | Verified requirements, student evidence, hardness labels, decision confidence | Review Workbench, Roadmap | Yes | Decisions explain requirements and student evidence with false-positive tracking | Eligibility decision lacks verified requirement support |
| Program-to-skills prototype | Door 5 | 4/5 | prototype | Simulation yes; production no | Outcomes/modules, skill labels, reviewer labels | Review Workbench, Roadmap | Yes | Skill labels are traceable and reviewer-approved | Hallucinated skill or unsupported occupation promise |
| Official Apply Pack prototype | Door 5 | 4/6 | prototype | Simulation yes; production no | Apply URLs, documents, deadlines, fees, requirement proof | Review Workbench, Roadmap | Yes | Every checklist item cites official evidence | Missing or conflicting requirement becomes student task |
| University Dashboard preview | Door 6 | 1E/6 | prototype | Preview only after review proof | Evidence gaps, conflicts, stale facts, improvement candidates | Expansion Doors Roadmap | Yes | Institution-facing preview shows only review-safe facts | Disputed or weak claim shown externally |

## P3: Delayed Production/Public/Student/CRM/Data Products

| Roadmap item | Required Door | Blocked-by stage | Implementation type | Allowed before runtime closure? | Required evidence | Required UI surface | Human review needed? | Acceptance criteria | Rollback/stop condition |
|---|---|---|---|---|---|---|---|---|---|
| Public ORX scores | Door 4, Door 6 | 5/6 | production | No | Mapped signals, citations, <=5% verified-error holdout, anti-gaming result | ORX Public Explanation surface later | Yes | Every score contribution is cited and benchmarked | Any public signal exceeds error threshold |
| Student AI Advisor production decisions | Door 5, Door 6 | 4/6 and verified requirements | production | No | Verified facts, citations, refusal rules, student evidence, confidence | Student App later | Yes | Advisor refuses unsupported advice and cites verified facts only | Unsupported or hallucinated high-stakes advice |
| CRM automation | Door 6 | 1E/4/6 | production | No | Approved evidence pack, requirements, risks, reviewer status | CRM Case Handoff later | Yes | CRM handoff matches reviewer-approved facts | Automation sends unverified or stale advice |
| Public trust badges | Door 2, Door 6 | 6 | production | No | Provenance completeness, freshness, confidence, source diversity, review status | Public University Pages later | Yes for threshold changes | Badge withheld when provenance incomplete | Badge appears on weak or stale evidence |
| Data Products/API | Door 6 | 6/legal | production | No | Verified facts, provenance, licensing/source-rights review, field contract | Data Products/API later | Yes plus legal/source review | API returns only approved verified fields | Licensing ambiguity or unsupported public field |
| Country layer external policy | Door 5, Door 6 | External/6 | production | No | Official source policy, update cadence, dated policy evidence, legal/human review | Country/product surfaces later | Yes | Policy facts are current, sourced, and neutral | Policy stale, sensitive, or unsupported |
| Public University Pages | Door 6 | 6 | production | No | Verified facts, citations, media provenance, freshness, conflict status | Public University Pages later | Yes | Page contains only verified, public-safe facts | Page exposes draft or unverified data |
| Deadline Alerts | Door 5, Door 6 | 4/6 | production | No | Current-year deadline, intake, observed_at, confidence, source URL | Deadline Alerts later | Yes for ambiguous dates | Alert fires only for verified current deadline | Old or ambiguous date triggers alert |

## Roadmap Stop Rules

- Stop if an item requires a new crawler, separate simulation lab, migration, Edge Function, workflow, script, external API call, crawler execution, Run All, country crawl, publish, canonical write, language/i18n change, or ORX score production.
- Stop if an output would be visible to students, public users, universities, CRM, or data customers before Verify/Publish Gate closes.
- Stop if high-impact evidence lacks source URL, quote, trace id, confidence, and review status.
- Stop if marketing-only claims influence ORX, eligibility, fit, CRM, or public trust.

## Next Implementation Candidate

The first implementation candidate after this planning PR should be the smallest no-write Evidence Pack implementation plan, because it supports Door 1 diagnostics, Door 2 review, and every later benchmark. It must remain bounded to docs-approved fields and must not run crawler functions or publish.
