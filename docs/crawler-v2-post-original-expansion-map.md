# Crawler v2 Post-Original Expansion Map

Status: simulation roadmap only  
Baseline: original Crawler v2 remains the engine of record  
Scope: deltas on top of current components; no new crawler, no production implementation

## Executive Snapshot

Crawler v2 should finish its original runtime closure before any expansion becomes production work. The expansion program below treats every new idea as a simulated delta on top of the existing stage model:

- 1A Control/Admin/Create Run
- 1B Worker/Homepage Fetch
- 1C Page Planner
- 1D Basic Extract
- 1E Review Surface
- 2 Queue Controls
- 3 AI Extract
- 4 Draft Writer
- 5 ORX Mapper
- 6 Verify/Publish Gate

Runtime-closed stages are usable as simulation inputs: 1A, 1B, 1C, 1D, and Order 3 AI Extract. Unclosed stages are not reliable expansion dependencies yet: 1E, 2, 4, 5, and 6.

The recommended sequence is:

1. Close original runtime tests for 1E, 2, 4, and 6.
2. Run read-only simulations over snapshots and saved evidence packs.
3. Benchmark candidate deltas against known crawl outcomes.
4. Promote only small, evidence-improving deltas to prototype tickets.
5. Keep publish, canonical data, language expansion, and Supabase schema changes blocked.

## Existing Engine Baseline

| Baseline stage | Current responsibility | Runtime status | Expansion posture |
|---|---|---:|---|
| 1A Control/Admin/Create Run | Create bounded crawl runs and admin controls | Runtime closed | Can host simulation metadata and selected-stage intent later |
| 1B Worker/Homepage Fetch | Fetch official homepage/page content and record fetch outcomes | Runtime closed | Can provide saved fetch evidence for fallback, ethics, freshness, and cost simulations |
| 1C Page Planner | Select candidate official pages for crawl/extract | Runtime closed | Main anchor for discovery, multi-domain, PDF, and page-budget simulations |
| 1D Basic Extract | Deterministic fact extraction from fetched content | Runtime closed | Main anchor for quality scoring, weak claim detection, and evidence normalization simulations |
| 1E Review Surface | Human review queue and evidence inspection | Not runtime closed | Blocks review-trigger, safe publish, handoff, and dashboard-facing simulations |
| 2 Queue Controls | Pause/resume/stop/retry/selection controls | Not runtime closed | Blocks retry policy, selected-stage runner, queue validation, and duplicate guard enforcement |
| 3 AI Extract | AI extraction over existing evidence | Runtime closed | Can support offline AI role simulation only; no external calls in this plan |
| 4 Draft Writer | Writes proposed university/program drafts | Not runtime closed | Blocks dedupe, student/apply pack, public page, and CRM draft-impact simulations |
| 5 ORX Mapper | Maps evidence/facts to ORX entities/signals | Not runtime closed | Blocks ORX signal promotion and ORX explanation production |
| 6 Verify/Publish Gate | Verifies, gates, and publishes approved facts | Not runtime closed | Blocks all publish, canonical update, trust badge, and public scoring work |

## Operating Rules

- Do not build new production code from this roadmap.
- Do not create Edge Functions, migrations, workflows, or scripts.
- Do not modify Supabase or call external APIs.
- Do not run crawler functions, Run All, country crawls, publish, or verification gates.
- Do not update canonical universities, programs, university_media, or orx_scores.
- Do not touch crawler language handling or add 12-locale crawler logic.
- Treat every future schema change as a later design note, not current work.
- Simulations must consume snapshots, saved outputs, local fixtures, or manually exported evidence packs.

## Field Legend

The expansion tables use compact columns while preserving the requested fields for every idea.

| Column | Field |
|---|---|
| Component | Current engine component extended |
| Hypothesis | What the simulation should prove |
| Why | Why it matters |
| Product | Product value |
| ORX | ORX value |
| Student | Student evaluation value |
| CRM | CRM value |
| Uni Dash | University dashboard value |
| Public | Public page value |
| Crawler data | Data required from crawler |
| Evidence | Evidence required |
| Schema delta later | Schema delta if later needed |
| AI role | AI role, if any |
| Review trigger | Human review trigger |
| Gaming risk | Anti-gaming risk |
| Cost | Expected cost |
| Accuracy | Expected accuracy gain |
| Verify diff | Verification difficulty |
| Runtime test later | Runtime test required later |
| Blocked | Whether blocked by unfinished original runtime tests |
| Rec | Keep / Prototype Later / Benchmark First / Delay / Reject |

## Operations / Current Engine Extension

| Idea | Component | Hypothesis | Why | Product | ORX | Student | CRM | Uni Dash | Public | Crawler data | Evidence | Schema delta later | AI role | Review trigger | Gaming risk | Cost | Accuracy | Verify diff | Runtime test later | Blocked | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Full Pipeline Orchestrator above existing stages | 1A plus 2 plus stage status reads | A read-only supervisory plan can sequence original stages without changing stage internals | Prevents ad hoc Run All behavior | Safer admin operations | Stable ORX input lineage | More predictable eligibility data | Clear case timing | Shows crawl progress | More reliable freshness labels | run id, stage status, counts, errors | stage logs, evidence pack | `crawler_run_plan` later | Summarize stage health only | Any auto-proposed next stage after failure | Overclaiming completeness | Medium | Medium | Medium | Pilot run replays all stage states without invoking publish | Yes, blocked by 2, 4, 5, 6 | Keep |
| Duplicate Run Guard | 1A Create Run and 2 Queue Controls | Guarding active equivalent runs reduces conflicting evidence | Prevents double work and stale overwrites | Fewer admin mistakes | Cleaner score inputs | Less contradictory program data | Fewer duplicate CRM tasks | Avoids duplicate institution alerts | Avoids public data churn | target scope, active run keys, status | run ledger, timestamps | unique run intent key later | None | Duplicate active scope found | Low | Low | High | Low | Attempt duplicate create in sandbox and prove block message | Yes, blocked by 2 | Keep |
| Dedupe Engine | 4 Draft Writer plus 5 ORX Mapper | Program and evidence duplicates can be detected before draft promotion | Keeps draft queues usable | Cleaner search and pages | Prevents signal inflation | Better program matching | Fewer duplicate leads | Cleaner program inventory | Fewer duplicate listings | title, degree, URL, hashes, university id | source_evidence, program_draft | normalized entity fingerprints later | Candidate cluster explanation | High-similarity but conflicting facts | Medium, programs can keyword-stuff | Medium | High | Medium | Snapshot dedupe finds known duplicate drafts with no canonical writes | Yes, blocked by 4, 5 | Keep |
| Failure Classifier | 1B, 1C, 1D, 3, 4 | Failures can be bucketed into fetch, access, extraction, evidence, mapping, publish | Makes retries and handoffs rational | Better admin triage | Distinguishes missing evidence from bad institution | Explains missing recommendations | Better CRM expectation setting | Shows fixable gaps | None until stable | fetch status, stage errors, flags | ingest_errors, logs, snippets | failure taxonomy field later | Classify error messages offline | Unknown or severe stage failure | Low | Low | Medium | Medium | Replay failure pack and classify with reviewer agreement | Partly, blocked by 4, 5, 6 for downstream classes | Keep |
| Retry Policy | 2 Queue Controls plus 1B fetch | Evidence-based retries improve coverage without hammering sites | Controls cost and politeness | Higher successful crawl completion | Fresher ORX evidence | More complete requirements | Less manual follow-up | Transparent retry state | Better freshness claims | HTTP status, retry_at, attempts, robot hints | fetch logs, response codes | retry policy fields later | None or classify retry reason | Repeated failure after threshold | Medium if aggressive | Low-Medium | Medium | Medium | Simulate retry decisions against historical failed URLs | Yes, blocked by 2 | Benchmark First |
| Smoke Diagnostics / Evidence Pack | 1A through 6 read-only | A standard pack makes every run auditable by humans and agents | Speeds closure of original plan | Faster admin QA | ORX provenance basis | Student-data trust | CRM handoff confidence | Institution dispute support | Trust labels later | run stats, pages, drafts, evidence rows, flags | saved snippets, hashes, screenshots if available | evidence pack artifact table later | Summarize pack and missing proof | Any pack missing source URL or snippet | Low | Low | High | Low | Generate pack from a completed test run snapshot | Partly, full pack blocked by 1E, 4, 5, 6 | Keep |
| Queue Controls Validation | 2 Queue Controls | Pause/resume/stop/retry can be proven independently of extraction quality | Original plan needs closure | Admin safety | Prevents partial ORX updates | Prevents partial student advice | Prevents bad case state | Shows stable crawl controls | None | queue status, locks, lease timestamps | queue event logs | None first | None | Lock stuck or skipped control event | Low | Low | Medium | Medium | Runtime test each control on isolated run | Yes, blocked by 2 | Keep |
| Safe Selected-Stage Runner | 1A plus 2, read-only until closure | Admin can run one selected original stage without accidental full pipeline | Prevents unsafe expansion execution | Better testing ergonomics | Enables isolated ORX mapper tests | Enables isolated draft tests | Reduces surprise CRM changes | Better support tooling | None | run id, stage choice, dry-run flag | stage preconditions | stage intent log later | None | Selected stage has unmet prerequisites | Low | Low | Medium | Medium | Prove selected stage refuses publish/dangerous actions unless explicitly allowed | Yes, blocked by 2, 4, 5, 6 | Keep |
| Agent-neutral handoff for Claude/Codex/human | 1E Review Surface plus diagnostics | A normalized handoff lets any reviewer continue without hidden context | Reduces continuity loss | Faster review cycles | Better methodology audit | Better admissions decisions | Better CRM continuity | Better dashboard support notes | None | run summary, changed entities, blockers | evidence pack, reviewer notes | handoff markdown artifact later | Summarize unresolved decisions | Conflicting recommendations between agents | Medium if agents overtrust weak evidence | Low | Medium | Low | Human can resume from pack and reach same next action | Yes, blocked by 1E and evidence pack completeness | Keep |

## Crawler Expansions

| Idea | Component | Hypothesis | Why | Product | ORX | Student | CRM | Uni Dash | Public | Crawler data | Evidence | Schema delta later | AI role | Review trigger | Gaming risk | Cost | Accuracy | Verify diff | Runtime test later | Blocked | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Discovery Intelligence | 1C Page Planner | Better page candidate ranking increases useful evidence per page | Page budget is scarce | Higher coverage | More signal coverage | More complete program advice | Fewer manual searches | Shows missing sections | Fresher pages | URL candidates, anchor text, page type | official links and page snippets | page intent score later | Rank page intents offline | Planner selects non-official or irrelevant page | SEO stuffing of nav text | Medium | High | Medium | Compare discovered pages vs known useful pages | No for simulation; production blocked by 2, 4 | Keep |
| Deep Program Extraction | 1D Basic Extract plus 3 AI Extract and 4 Draft Writer | Detail pages and catalogs yield stronger program fields | Program-level value is core | Better program catalog | ORX-P coverage | Eligibility, fit, apply pack | Better case matching | Better program inventory | Rich program pages | program URLs, detail text, catalog tables | official program pages, catalog PDFs | expanded draft fields later | Extract structured fields from saved text | Low-confidence requirement or tuition | High, marketing/program clones | High | High | High | Snapshot benchmark against manually labeled programs | Yes, blocked by 4 | Benchmark First |
| PDF Intelligence | 1B fetch artifacts plus 1D/3 extract | Official PDFs contain high-value requirements and outcomes | Many universities bury facts in PDFs | More complete facts | High-trust evidence | Requirements/deadlines | Better document checklist | Brochure proof | Downloadable source proof | PDF URL, text, file hash, page refs | official PDF snippets with page number | artifact text index later | Parse/summarize saved PDFs only | OCR failure or conflicting PDF/page | Medium, old PDFs reused | Medium-High | High | High | Offline PDF pack extracts known facts with page refs | Partly blocked by 4 and 6 | Benchmark First |
| JS-render fallback | 1B Worker/Homepage Fetch | Render fallback recovers pages with empty static HTML | Important for modern sites | Better crawl success | More evidence | More programs visible | Less manual lookup | Better visibility into blocked pages | Fewer empty pages | static text length, render need flag | before/after rendered text | render_attempts later | None first | Rendered content differs materially | Low-Medium | High | Medium | Medium | Compare static vs rendered saved captures on known JS sites | No for simulation; production blocked by 2 | Prototype Later |
| Multi-domain official handling | 1C planner plus 6 gate | Official subdomains and country campuses can be validated safely | Universities use admissions/program microsites | Better coverage | More complete institutional evidence | Better apply/deadline links | Fewer missing official links | Lets universities justify domains | More official links | domain, redirects, ownership hints | official root links to secondary domains | official_domain_aliases later | Explain domain relationship | Domain not linked from root or conflicts | High, fake partner domains | Medium | High | High | Prove alias acceptance only when root links out | Yes, blocked by 6 | Benchmark First |
| Media/file artifact intelligence | 1B artifacts plus 1D extract | Brochures, images, videos, and logos can be inventoried without publishing | Improves public and dashboard assets | Better media readiness | Some ORX transparency evidence | Brochure/apply docs | CRM collateral | Institution asset review | Richer pages later | media URLs, file types, hashes | official media and brochure URLs | media artifact table later | Classify artifact type | Low-quality or non-official asset | Medium, promotional images | Medium | Medium | Medium | Snapshot artifact inventory on official domains | Yes, blocked by 6 for publish use | Prototype Later |
| Crawl Ethics / Politeness | 1B fetch plus 2 queue | Politeness constraints reduce blocking and reputational risk | Must crawl responsibly | Safer operations | Stable evidence access | Fewer missing data due to bans | Better client trust | Institution trust | Public trust posture | robots hints, rate limits, host counts | response codes, robots text | crawl_policy table later | None | 403/429 spike or robots disallow | Low | Low-Medium | Medium | Medium | Simulated schedule respects per-domain budget and stop rules | Yes, blocked by 2 | Keep |
| Crawler Cost Brain | 1A plus 1B/3 counters | Cost forecasting can choose cheaper evidence paths first | Controls AI and render spend | Lower operating cost | More scalable ORX | Affordable student evaluations | Predictable case cost | Clear crawl budget | None | pages fetched, AI calls, render flags | run stats | cost ledger later | Estimate extraction benefit | High cost with low evidence yield | Low | Low | Medium | Medium | Backtest cost per accepted fact by run | Partly blocked by 4, 5, 6 | Benchmark First |
| Evidence Freshness SLA | 1D evidence plus 6 gate | Facts should expire or downgrade based on evidence age | Prevents stale advice | Freshness badges | Core ORX confidence | Deadline and fee reliability | Better follow-up timing | Shows recrawl needed | Public trust labels | observed_at, freshness_date, content hash | dated official pages/PDFs | freshness fields later | Extract date references | Missing or ambiguous date | Medium, pages hide dates | Low | High | Medium | Snapshot identifies stale evidence correctly | Yes, blocked by 6 for gating | Keep |
| Change Detection | 1B content hash plus 4 drafts | Hash and semantic diff can isolate changed pages | Enables efficient recrawls | Fewer unnecessary runs | Tracks curriculum changes | Alerts for deadlines/fees | CRM follow-up alerts | University change inbox | Public update signals | content_hash, prior hash, extracted facts | old/new snippets | change events later | Summarize semantic diff | Material change affects published fact | Medium, tiny text churn | Medium | High | Medium | Replay two snapshots and detect real fact changes | Yes, blocked by 4, 6 | Keep |

## Evidence / Trust

| Idea | Component | Hypothesis | Why | Product | ORX | Student | CRM | Uni Dash | Public | Crawler data | Evidence | Schema delta later | AI role | Review trigger | Gaming risk | Cost | Accuracy | Verify diff | Runtime test later | Blocked | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Evidence Knowledge Graph | 1D evidence plus 5 mapper | Linking sources, facts, entities, and claims improves traceability | Makes expansion auditable | Better search/explain | ORX trace backbone | Explains recommendations | CRM can cite proof | University can dispute facts | Public explanations | entity ids, source URLs, snippets, hashes | source_evidence, drafts | graph tables later | Link claim to evidence | Orphan claim or circular support | Medium, evidence spamming | High | High | High | Offline graph has no unsupported claims | Yes, blocked by 5 | Prototype Later |
| Provenance model | 1D, 4, 6 | Every proposed output can carry source URL, quote, date, hash, and stage lineage | Prevents unverifiable facts | Trust layer | Required for ORX | Required for student advice | Strong CRM notes | Dispute resolution | Source citations | source_url, snippet, observed_at, extractor | source_evidence rows | provenance envelope later | None | Missing required provenance field | Low | Medium | High | Medium | Verify every draft field has source or null reason | Yes, blocked by 4, 6 | Keep |
| Quality / Confidence Engine | 1D, 3, 6 | Quality scores can route facts to auto, quick, deep, reject | Controls review load | Better review queue | ORX confidence | Better eligibility confidence | Case risk labels | Data quality dashboard | Trust badges later | flags, evidence count, conflicts | evidence snippets, field validation | confidence fields later | Assist scoring explanation | Low confidence or high impact | Medium, confidence gaming | Medium | High | Medium | Benchmark confidence against human labels | Yes, blocked by 1E, 6 | Benchmark First |
| Official Conflict Resolver | 1D plus 1E/6 | Conflicts can be resolved by trust, recency, and page type | Official sites contradict themselves | Better facts | Lower conflict rate | Safer admissions advice | Escalation clarity | Institution correction flow | Public avoids contradictions | conflicting values, URLs, dates | official snippets | conflict records later | Summarize conflict options | Material conflicting fee/deadline/requirement | High | Medium | High | High | Known conflict pack routes to review | Yes, blocked by 1E, 6 | Keep |
| Weak Marketing Claim Detector | 1D/3 extract plus 1E | Vague superlatives can be filtered from factual evidence | Prevents trust pollution | Cleaner copy | ORX anti-hype | Safer recommendations | Better advisor scripts | Helps universities improve claims | More honest public pages | claim text, page type | snippets around claim | claim type field later | Classify claim strength | Claim drives score or advice | High, marketing pages | Low-Medium | Medium | Medium | Label benchmark of factual vs marketing claims | Partly blocked by 1E | Benchmark First |
| Human Review Triggers | 1E Review Surface plus 6 gate | Explicit trigger rules reduce arbitrary review | Needed for safe scaling | Better admin workload | Better score governance | Better high-stakes advice | Clear CRM escalation | University correction queue | Trust labels later | flags, confidence, conflicts, impact | evidence pack | review reason codes later | Explain trigger | Any high-impact low-confidence fact | Medium | Low | High | Medium | Trigger rules match human triage on sample pack | Yes, blocked by 1E and 6 | Keep |
| Safe Publish Sandbox | 6 Verify/Publish Gate | Publish effects can be simulated without writes | De-risks gate closure | Preview changes | ORX score impact preview | Student advice impact preview | CRM impact preview | Institution preview before publish | Public diff preview | draft changes, target rows | publish candidate pack | sandbox diff artifact later | Summarize diff | Any canonical overwrite or conflict | High | Medium | High | High | Dry-run publish produces diff and zero writes | Yes, blocked by 6 | Keep |
| Benchmarking System | All stages using saved packs | Golden packs can compare extraction and scoring deltas | Prevents regressions | Safer iteration | ORX calibration | Student matcher calibration | CRM case QA | Quality reporting | Public trust QA | snapshots, expected outputs | labeled evidence packs | benchmark registry later | Judge extraction only against labels | Benchmark drift or low agreement | Low | Medium | High | Medium | Run offline benchmark with stable expected outputs | No for simulation | Keep |

## Product Surfaces

These are not production surfaces yet. They describe where simulated outputs would create value after the original runtime gates are closed.

| Idea | Component | Hypothesis | Why | Product | ORX | Student | CRM | Uni Dash | Public | Crawler data | Evidence | Schema delta later | AI role | Review trigger | Gaming risk | Cost | Accuracy | Verify diff | Runtime test later | Blocked | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Student App | 4 drafts plus 6 gate | Verified crawler data improves shortlist quality | Core user surface | Better search and recommendations | Shows ORX where valid | High | Lower support load | Indirect | Better conversion | published-safe fields only | verified evidence | profile-to-program links later | Explain matches | Any unverified high-stakes fact | Medium | Medium | High | High | App consumes sandboxed verified facts only | Yes, blocked by 4 and 6 | Delay |
| Student AI Advisor | 3 AI Extract plus verified data | Advisor can cite evidence instead of improvising | Reduces hallucination | Higher trust assistant | ORX explanations | High | Better handoff notes | Indirect | Public Q&A later | verified facts, citations | evidence snippets | advisor citation log later | Answer with citations | Unsupported advice | High | Medium | High | High | Advisor refuses facts absent from evidence pack | Yes, blocked by 6 | Prototype Later |
| Public University Pages | 6 gate plus media artifacts | Verified data can enrich university pages | Main public trust surface | Better SEO/content | ORX transparency | Better exploration | Better lead context | Institution proof | High | verified facts, media | official citations | page fact provenance later | Summarize citations | Conflict or stale claim | High | Medium | High | High | Public page preview from sandbox diff only | Yes, blocked by 6 | Delay |
| University Dashboard | 1E plus evidence graph | Institutions can see evidence gaps and corrections | Builds partner trust | Data correction loop | ORX improvement path | Indirect | Better account management | High | Better public accuracy | gaps, conflicts, stale facts | evidence pack | dashboard issue records later | Summarize gaps | Institution disputes evidence | High | Medium | High | Medium | Dashboard preview shows only review-safe facts | Yes, blocked by 1E, 6 | Prototype Later |
| CRM Case Handoff | 1E plus handoff pack | Verified facts and gaps improve advisor case work | Operational leverage | Better internal workflow | ORX context | High | High | Indirect | None | shortlisted programs, risks, evidence | handoff pack | CRM handoff object later | Generate concise case summary | Missing requirement or deadline | Medium | Low | High | Medium | CRM pack matches reviewer-approved facts | Yes, blocked by 1E, 4, 6 | Prototype Later |
| Admin Review Queue | 1E Review Surface | Prioritized evidence review reduces closure time | Needed before expansion | Faster QA | Better ORX governance | Better eligibility facts | Better escalations | Better correction review | Safer publish | flags, confidence, impact | evidence snippets | review priority fields later | Summarize issue | High-impact or low-confidence fact | Medium | Low-Medium | High | Medium | Queue displays triggers and preserves decisions | Yes, blocked by 1E | Keep |
| ORX Public Explanation | 5 mapper plus 6 gate | Public scores need source-backed explanations | Avoids black-box ranking | Differentiation | High | Helps compare programs | Sales proof | Improvement roadmap | High | ORX signal evidence | citations and methodology | explanation artifact later | Draft explanation from evidence | Missing source or weak confidence | High | Medium | High | High | Explanation cites every score contribution | Yes, blocked by 5, 6 | Delay |
| Application Checklist | 4 Draft Writer plus 6 gate | Verified requirements become student action lists | High student utility | Better conversion | Low | High | Better case tasks | Program readiness | Useful public preview | requirements, documents, deadlines | official apply pages/PDFs | checklist items later | Normalize checklist | Ambiguous required document | Medium | Medium | High | High | Checklist agrees with official apply pack labels | Yes, blocked by 4, 6 | Prototype Later |
| Deadline Alerts | 1D/4 plus freshness SLA | Deadlines can trigger timely alerts only when verified fresh | Time-sensitive value | Retention | Low-Medium | High | Better follow-up timing | Better deadline corrections | Public deadline trust | deadline dates, intakes, observed_at | official deadline pages | alert schedule later | Extract date windows | Date conflict or old year | High | Medium | High | High | Alert generated only for current-year verified deadline | Yes, blocked by 4, 6 | Benchmark First |
| Trust Badges | 6 gate plus quality engine | Public badges can communicate verified source quality | Builds confidence | Differentiator | ORX confidence signal | Helps students compare | Helps advisors | Helps institutions improve | High | provenance completeness, freshness | evidence counts and source type | badge state later | None | Badge threshold edge case | High | Low | Medium | Medium | Badge withheld when provenance incomplete | Yes, blocked by 6 | Delay |
| Data Products/API | 6 gate plus evidence graph | Evidence-backed data products need strict provenance and licensing | Potential revenue, high risk | External value | ORX distribution | Indirect | Partner integrations | Institutional reports | Public/API | verified facts only | source and license review | API contracts later | Summarize fields | Any licensing/provenance ambiguity | High | High | Medium | High | API sandbox returns only approved fields | Yes, blocked by 6 and legal review | Delay |

## Blocked Until Runtime Closed

The following expansion categories must not become implementation work until original runtime closure is complete:

- Anything using 1E Review Surface as a reviewer-facing workflow.
- Anything using 2 Queue Controls for real pause/resume/retry/selected-stage execution.
- Anything using 4 Draft Writer for new program or university draft persistence.
- Anything using 5 ORX Mapper for score-affecting mappings.
- Anything using 6 Verify/Publish Gate for publish, canonical updates, trust badges, or public claims.
- Any surface that consumes crawler facts as user-visible truth.

## What Must Not Be Built Yet

- Full production orchestrator above existing Crawler v2.
- New crawler or separate simulation lab.
- Edge Functions, migrations, database changes, workflows, or automated runs.
- Country crawl, Run All, publish, or canonical updates.
- Language expansion or 12-locale crawler logic.
- Public ORX scores, trust badges, or public university page writes.
- Student AI Advisor facts that are not traceable to verified evidence.

## Recommended Next 5 Prototypes

1. Smoke Diagnostics / Evidence Pack using completed run snapshots.
2. Queue Controls Validation as the next original-runtime closure aid.
3. Provenance Model audit over existing draft/evidence rows.
4. Benchmarking System with manually labeled golden evidence packs.
5. Change Detection simulation using saved old/new page snapshots.
