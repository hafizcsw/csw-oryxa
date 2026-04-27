# ORX and Student Evaluation Expansion Simulation Plan

Status: simulation roadmap only  
Baseline: current Crawler v2 plus ORX methodology v1.1  
Scope: evidence-only deltas; no scoring production, no publish, no canonical writes

## Executive Snapshot

This plan converts ORX, student evaluation, fit, skills, and country-layer expansion ideas into simulation experiments that sit above the existing Crawler v2 engine. The original engine remains the baseline. The simulation must not create new crawler behavior or run live extraction. It should consume only saved evidence, existing crawl outputs, local benchmarks, and manually curated labels.

The highest-value near-term work is not to score more things. It is to prove whether Crawler v2 evidence can support score explanations, student eligibility decisions, future-readiness signals, and advisor handoffs with a verified-error target of 5% or lower before public use.

## Existing Engine Baseline

| Baseline stage | What it contributes to this plan | Runtime status |
|---|---|---:|
| 1A Control/Admin/Create Run | Run identity for evidence packs and simulation cohorts | Runtime closed |
| 1B Worker/Homepage Fetch | Saved official page/PDF inputs | Runtime closed |
| 1C Page Planner | Page intent and official-source coverage | Runtime closed |
| 1D Basic Extract | Deterministic facts, snippets, hashes, field flags | Runtime closed |
| 1E Review Surface | Human judgment and dispute handling | Not runtime closed |
| 2 Queue Controls | Controlled simulation cohorts and safe retries later | Not runtime closed |
| 3 AI Extract | AI extraction candidate, but only offline from saved text in this plan | Runtime closed |
| 4 Draft Writer | Program/university draft facts for eligibility and public products | Not runtime closed |
| 5 ORX Mapper | Evidence-to-ORX signal mapping | Not runtime closed |
| 6 Verify/Publish Gate | Verified truth boundary for public/student/CRM use | Not runtime closed |

## Simulation Experiment Plan

All experiments should use the same five-step shape:

1. Select a closed snapshot: completed run output, saved source text, source evidence, and current draft rows.
2. Define labeled truth: human labels for facts, conflicts, requirements, signal applicability, and decision outcomes.
3. Run offline scoring or matching logic outside production systems.
4. Measure against acceptance thresholds: verified-error rate, unsupported-claim rate, review burden, cost per accepted fact, and reviewer agreement.
5. Produce a no-write evidence pack: proposed output, citations, conflicts, confidence, and blocked dependencies.

Minimum acceptance gates for any score/advising prototype:

- No unsupported high-stakes claim.
- Every output fact has source URL, quote/snippet, observed date or null reason, and field-level confidence.
- Public ORX signal candidate has verified-error rate at or below 5% on labeled benchmark before production discussion.
- Student eligibility decision has separate false-positive and false-negative reporting.
- Human reviewer can inspect and reverse the decision from the evidence pack alone.

## Field Legend

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

## ORX Rank Extensions

| Idea | Component | Hypothesis | Why | Product | ORX | Student | CRM | Uni Dash | Public | Crawler data | Evidence | Schema delta later | AI role | Review trigger | Gaming risk | Cost | Accuracy | Verify diff | Runtime test later | Blocked | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ORX Evidence Integration | 5 ORX Mapper plus 1D evidence | Existing evidence can map to ORX-C/U/P without changing crawler | Makes ORX evidence-first | Score backbone | High | Better comparisons | Advisor proof | Improvement gaps | Explanation base | snippets, source type, entity ids | source_evidence, official PDFs | ORX evidence link table later | Suggest signal mapping | Missing source or weak signal | Medium | Medium | High | High | Mapper simulation links every signal to evidence | Yes, blocked by 5 | Keep |
| ORX Signal Candidates | 5 ORX Mapper | Candidate signals can be benchmarked before scoring | Prevents weak scoring | Product differentiation | High | Better program ranking | Sales proof | Roadmap gaps | Public ranking later | signal evidence candidates | labeled signal packs | signal catalog later | Classify candidate support | Weak evidence used as signal | High | Medium | Medium | High | Benchmark each signal candidate vs labels | Yes, blocked by 5 | Benchmark First |
| ORX Curriculum and Future Readiness Evidence Agent | 3 AI Extract plus 5 Mapper | Offline AI can extract curriculum-readiness evidence from saved text | Hard to do manually at scale | Future-readiness insights | High | Better program fit | Advisor evidence | Curriculum improvement | Score explanations | course/catalog text | catalog snippets, outcomes | agent output audit later | Extract and cite only | AI infers beyond evidence | High | Medium-High | High | High | Agent output reaches <=5% verified error on golden pack | Yes, blocked by 5, 6 | Benchmark First |
| Curriculum updates | 1D/3 plus 5 | Last-updated curriculum evidence predicts adaptability | ORX-U/P core | Freshness indicator | High | Warns stale programs | Advisor context | Improvement metric | Public freshness | dates, catalog versions | handbook/catalog dates | curriculum version field later | Extract update date | Date absent or contradictory | Medium | Medium | High | Medium | Detect update dates against labels | Yes, blocked by 5 | Keep |
| Course/module changes | 1B hash plus 1D/5 | Semantic diffs reveal real curriculum change | Tracks modernization | Update alerts | High | Better current advice | Follow-up reason | Change log | Public update signal | old/new page text, hashes | old/new catalog snippets | change events later | Summarize module diff | Changed title affects score | Medium | Medium | High | Medium | Replay two catalog snapshots | Yes, blocked by 4, 5 | Keep |
| Learning outcomes | 1D/3 plus 5 | Outcomes reveal skill and applied-readiness signals | More precise than titles | Better program copy | High | Fit/skills matching | Advisor explanation | Curriculum improvement | Rich program pages | outcome text | official outcomes | outcome facts later | Extract structured outcomes | Generic or unverifiable outcomes | Medium | Medium | High | Medium | Label outcomes by skill family | Yes, blocked by 4, 5 | Benchmark First |
| AI/data/automation exposure | 1D/3 plus 5 | Course content can show AI-era exposure | ORX differentiation | Strong ranking value | High | Future-readiness advice | Advisor proof | Curriculum gap | Public ORX explainer | course descriptions | official module text | AI exposure tags later | Classify exposure level | Buzzword stuffing | High | Medium | High | High | <=5% verified-error signal benchmark | Yes, blocked by 5, 6 | Benchmark First |
| Industry advisory boards | 1D plus 5 | Advisory board evidence signals industry linkage | Applied-readiness proof | Useful institutional signal | Medium-High | Better confidence | Employer context | Partnership proof | Public trust | board pages, member lists | official board pages | advisory board fact later | Extract members/sector | Unverified names or old board | High | Low-Medium | Medium | Medium | Evidence pack verifies current official board | Yes, blocked by 5 | Prototype Later |
| Internships/co-op/capstone | 1D/3 plus 4/5 | Applied learning evidence improves program value | Student decision factor | High | High | High | Advisor talking point | Program improvement | Program pages | program text, requirements | official internship/capstone pages | applied learning field later | Extract requirement vs option | Optional marketed as required | High | Medium | High | High | Label required/optional applied learning | Yes, blocked by 4, 5 | Benchmark First |
| Employer partnerships | 1D plus 5 | Verified employer links show market connection | Valuable but gameable | Strong sales story | Medium-High | Fit/career context | CRM proof | Partnership display | Public trust | partner pages, logos | official partnership pages | partnership facts later | Normalize partner evidence | Logo wall without proof | High | Medium | Medium | High | Detect verified vs marketing-only partner claims | Yes, blocked by 5, 6 | Benchmark First |
| Career outcomes | 1D plus 5/6 | Outcomes evidence improves ORX confidence and student decisions | High-stakes value | Strong product value | High | Very high | Advisor proof | Outcome transparency | Public trust | employment stats, dates | official outcomes reports | outcome metrics later | Extract metrics with denominator | Missing denominator or old data | High | Medium | High | High | Outcomes pack verifies year, cohort, denominator | Yes, blocked by 5, 6 | Benchmark First |
| Employment reports | 1B PDF plus 1D/5 | Official reports offer stronger outcome evidence than pages | Better reliability | High | High | High | CRM proof | Transparency benchmark | Public citations | PDF text, page refs | official employment PDFs | report artifact facts later | Extract tables offline | Table extraction uncertainty | Medium | Medium-High | High | High | PDF benchmark extracts metrics with page refs | Yes, blocked by 5, 6 | Benchmark First |
| Accreditation and quality assurance | 1D plus 5/6 | Accreditation supports recognition and quality signals | High trust evidence | Trust surface | High | Eligibility/recognition | Advisor assurance | Institution proof | Public badges later | accreditation text, body names | official/accreditor pages | accreditation links later | Normalize bodies | Expired or non-program accreditation | High | Medium | High | High | Verify status/date/body from official source | Yes, blocked by 5, 6 | Keep |
| Annual reports | 1B PDF plus 5 | Annual reports provide institution-level evidence | ORX-U support | Rich evidence | High | Context | CRM proof | Improvement analysis | Public explanation | PDF links, text | annual report PDFs | report index later | Extract strategic facts | Old or unaudited report | Medium | Medium | Medium | High | Extract target facts with page refs | Yes, blocked by 5 | Prototype Later |
| Strategic plans | 1B/1D plus 5 | Strategy docs show future orientation but need cautious weighting | Can be aspirational | Differentiation | Medium | Context only | Sales context | Improvement themes | Public context | strategy page/PDF | official strategy docs | strategy facts later | Summarize commitments | Aspirational claim scored as achieved | Very high | Medium | Low-Medium | High | Classify commitment vs delivered evidence | Yes, blocked by 5, 6 | Benchmark First |
| Research labs and AI centers | 1D plus 5 | Active labs indicate research/AI infrastructure | ORX-U signal | Good public story | High | Fit for research students | Advisor proof | Institution showcase | Public content | lab pages, activity dates | official lab pages | lab facts later | Extract lab domain/activity | Dormant lab marketed as active | High | Medium | Medium | Medium | Active lab evidence requires recent activity | Yes, blocked by 5 | Prototype Later |
| Startup incubators | 1D plus 5 | Incubator evidence supports entrepreneurship readiness | Useful niche signal | Product differentiation | Medium | Entrepreneurial fit | Advisor context | Institution showcase | Public content | incubator pages | official incubator pages | incubator facts later | Extract program features | Naming-only incubator | Medium | Low-Medium | Medium | Medium | Verify services, dates, outputs | Yes, blocked by 5 | Prototype Later |
| Faculty development | 1D plus 5 | Faculty upskilling supports future-ready teaching | Hard but valuable | Quality insight | Medium | Indirect | Advisor context | Improvement metric | Limited | training pages, news | official development docs | faculty development facts later | Summarize evidence | Vague training claims | Medium | Medium | Low-Medium | High | Human labels distinguish policy vs evidence | Yes, blocked by 5 | Delay |
| Digital learning infrastructure | 1D plus 5 | LMS/hybrid/digital infrastructure indicates adaptability | Student experience | Useful filter | Medium | Learning preference fit | Advisor context | Improvement metric | Public page | online learning pages | official IT/learning pages | infrastructure facts later | Classify capability | Vendor logos without deployment proof | Medium | Medium | Medium | Medium | Verify active infrastructure claims | Yes, blocked by 5 | Prototype Later |
| Career services | 1D plus 5 | Career service depth predicts support quality | Student value | Strong value | Medium-High | High | CRM proof | Improvement path | Public content | career service pages | official career pages | career service facts later | Extract services | Generic support pages | Medium | Low-Medium | Medium | Medium | Label concrete vs generic services | Yes, blocked by 5 | Prototype Later |
| Student/international support | 1D plus 5 | International support evidence improves student risk advice | Important for target users | High | Medium | High | Advisor proof | Improvement gaps | Public content | support pages | official international pages | support facts later | Extract services | Vague support claims | Medium | Low-Medium | Medium | Medium | Verify concrete support services | Yes, blocked by 5 | Prototype Later |
| ORX Explanation Engine | 5 plus 6 | Every score component can be explained with evidence | Required before public ORX | High trust | Very high | Better decisions | Sales proof | Improvement guidance | High | mapped signals, evidence | citations | explanation artifacts later | Draft explanation | Unsupported score reason | High | Medium | High | High | Explanation has no uncited score claim | Yes, blocked by 5, 6 | Delay |
| ORX University Improvement Guidance | 5 plus Uni Dashboard | Evidence gaps can become university action guidance | B2B value | Dashboard value | High | Indirect | Account management | High | Indirect | missing signals, weak evidence | benchmark gaps | guidance records later | Draft action items | Guidance based on wrong benchmark | Medium | Medium | Medium | Medium | Human validates guidance from evidence gaps | Yes, blocked by 5, 1E | Prototype Later |
| ORX Anti-gaming | 5 plus trust engine | Signal rules can detect over-optimized claims and source concentration | Protects ranking | Trust moat | Very high | Safer advice | Sales credibility | Fairness | Public trust | source diversity, claim style, conflicts | evidence graph | anti-gaming flags later | Detect suspicious patterns | Gaming suspicion affects score | High, adversarial | Medium | Medium | High | Benchmark detects known synthetic gaming cases | Yes, blocked by 5, 6 | Keep |
| Published ORX signal <=5% verified-error strategy | 5 plus 6 | Public signals can be limited to those below error threshold | Safer launch | Public-ready subset | Very high | Reliable comparisons | Advisor trust | Fair dashboard | Public confidence | labeled benchmark results | reviewer-verified packs | signal release status later | Error analysis | Any signal exceeds threshold | Medium | Medium | High | High | Holdout benchmark proves <=5% verified error | Yes, blocked by 5, 6 | Keep |

## Student File Evaluation Extensions

| Idea | Component | Hypothesis | Why | Product | ORX | Student | CRM | Uni Dash | Public | Crawler data | Evidence | Schema delta later | AI role | Review trigger | Gaming risk | Cost | Accuracy | Verify diff | Runtime test later | Blocked | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Program Requirement Hardness Classifier | 4 Draft Writer plus 6 | Requirements can be classed as hard, soft, conditional, or unclear | Prevents bad eligibility advice | Better matching | Indirect | Very high | High | Shows unclear requirements | Useful public filter | requirement text, fields | official requirement pages | requirement hardness field later | Classify hardness | Ambiguous wording | Medium | Medium | High | High | Human-labeled requirement benchmark | Yes, blocked by 4, 6 | Benchmark First |
| Student Evidence Parser | Student file lane plus 4 facts | Student documents can be normalized for matching | Enables evaluation | Core value | None | Very high | High | None | None | no crawler data except program reqs | student docs plus requirements | student evidence facts later | Parse transcripts/docs | Low OCR or unofficial doc | Medium | High | High | High | Parser labels match human review | No crawler block, but product blocked by verified reqs | Prototype Later |
| Student-Program Eligibility Matcher | 4 plus 6 verified requirements | Verified requirements plus student evidence produce explainable eligibility | Main advising value | High | Low | Very high | High | None | Could show requirements | requirements, deadlines, fees | official requirements + student evidence | match decision table later | Compare and explain | Any reject/accept edge case | Medium | Medium | High | High | False-positive rate below agreed threshold | Yes, blocked by 4, 6 | Benchmark First |
| Decision Confidence Engine | 1E plus matcher | Confidence separates advice from review-needed cases | Reduces harm | High | Low | Very high | High | None | None | fact confidence, missing fields | evidence and student docs | decision confidence later | Explain uncertainty | Low confidence high-stakes decision | Medium | Medium | High | Medium | Confidence correlates with reviewer agreement | Yes, blocked by 1E, 6 | Keep |
| Negative Recommendation Engine | matcher plus CRM | System should safely say no when evidence supports it | Avoids wasting applications | High | Low | High | High | None | None | hard requirements, deadlines | official rules, student evidence | negative reasons later | Draft safe explanation | Borderline rejection | Medium | Low | High | High | No negative rec without hard evidence | Yes, blocked by 4, 6 | Benchmark First |
| Program Substitution Engine | matcher plus search | If not eligible, suggest close verified alternatives | Practical value | High | ORX can rank alternatives | High | High | None | Public search value | program facts, skills, country | verified program facts | substitution graph later | Rank alternatives | Alternative lacks verified data | Medium | Medium | Medium | High | Substitution accepted by advisors on labeled cases | Yes, blocked by 4, 6 | Prototype Later |
| Official Apply Pack | 4 plus 6 | Verified apply links, docs, deadlines, fees can become checklist | Converts advice to action | High | Low | Very high | Very high | Institution accuracy | Public utility | apply URLs, docs, deadlines | official apply pages/PDFs | apply pack items later | Normalize checklist | Missing or conflicting apply requirement | High | Medium | High | High | Pack fully traceable to official evidence | Yes, blocked by 4, 6 | Benchmark First |
| Deadline Radar | 1D/4 plus freshness | Deadlines can be detected and monitored with freshness safeguards | Time sensitive | High | Low | Very high | High | Correction path | Public deadline value | date text, observed_at | official deadline pages | deadline events later | Extract date windows | Old year or ambiguous intake | High | Medium | High | High | Current-year deadline benchmark | Yes, blocked by 4, 6 | Benchmark First |
| Country/Visa/Budget risk layer | Country layer plus matcher | Country risks materially change recommendation quality | Student decision reality | High | ORX-C context | High | High | Dashboard context | Public country pages | country/cost fields from official/external sources later | policy, costs, visa evidence | country risk facts later | Summarize risk | Outdated policy or cost | High | Medium | Medium | High | Risk output cites dated source and review status | Yes for crawler-fed data; external policy source later | Delay |

## Psychological / Person-Program Fit

These dimensions should not override eligibility or verified requirements. They are preference signals for ranking, explanation, and advisor conversation.

| Idea | Component | Hypothesis | Why | Product | ORX | Student | CRM | Uni Dash | Public | Crawler data | Evidence | Schema delta later | AI role | Review trigger | Gaming risk | Cost | Accuracy | Verify diff | Runtime test later | Blocked | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Interests | 4 verified program facts | Program descriptions and modules can map to student interests | Improves relevance | Better ranking | ORX-P context | High | Advisor talking points | Program positioning | Program tags | program descriptions, modules | official program pages | interest tags later | Map interests | Thin program evidence | Medium | Low | Medium | Medium | Advisor-labeled fit benchmark | Yes, blocked by 4, 6 | Prototype Later |
| Work values | 4 plus skills/outcomes | Career outcomes and learning style imply values fit | Better counseling | Personalization | Low | Medium-High | CRM context | None | None | outcomes, career services, applied learning | official outcome/service pages | value tags later | Explain fit | Stereotyping risk | Medium | Low | Low-Medium | High | Human advisor review of explanations | Yes, blocked by 4, 6 | Delay |
| Learning preference | 4 plus digital learning facts | Modality and assessment style can support preference matching | Reduces mismatch | Better UX | Low | High | Advisor guidance | Dashboard improvement | Program filters | delivery mode, assessment hints | official program/course pages | learning mode tags later | Classify mode | Vague hybrid claims | Medium | Low | Medium | Medium | Verify mode labels on sample programs | Yes, blocked by 4, 6 | Prototype Later |
| Risk tolerance | 6 verified uncertainty | Student risk profile can adjust shortlist conservatism | Safer decisions | Better recommendations | Low | High | CRM prioritization | None | None | confidence, missing fields, visa risk | evidence confidence | risk preference field later | Explain uncertainty | High-risk rec without consent | Low | Low | Medium | Medium | Simulate conservative vs ambitious recommendations | Yes, blocked by 6 | Prototype Later |
| Language/culture tolerance | Country layer plus program language | Language and support data can rank comfort fit | Important for international students | Better matching | Low | High | Advisor context | Support improvement | Country/program info | instruction language, support facts | official language/support pages | fit tags later | Summarize fit | Inferring culture unfairly | Medium | Low | Medium | High | Human review for sensitive wording | Yes, blocked by 4, 6 | Delay |
| Financial risk tolerance | Tuition, scholarships, country cost | Cost uncertainty should affect recommendation order | Avoids unaffordable matches | High | Low | Very high | CRM budget triage | Scholarship gaps | Cost transparency | tuition, fees, scholarships | official fee/scholarship pages | affordability risk later | Normalize ranges | Missing fee treated as affordable | Medium | Medium | High | High | Budget benchmark rejects unsupported affordability | Yes, blocked by 4, 6 | Keep |
| Career orientation | outcomes and skills | Career-directed students need outcome/applied signals | Better fit | High | ORX-P support | High | Advisor context | Career services value | Program pages | outcomes, applied learning | official outcomes/career pages | career orientation tags later | Map outcomes | Weak outcomes overinterpreted | Medium | Medium | Medium | Medium | Advisor-labeled career fit test | Yes, blocked by 4, 5, 6 | Prototype Later |
| Technical vs human-facing preference | module and occupation mapping | Curriculum can infer role orientation | Better matching | Medium | ORX-P context | Medium | Advisor context | None | Program tags | modules, outcomes | official course text | orientation tags later | Classify orientation | Stereotyping programs | Medium | Low | Medium | Medium | Human labels on discipline examples | Yes, blocked by 4, 6 | Prototype Later |
| Solo vs team preference | pedagogy/applied project evidence | Team project evidence can support fit | Fine-grained value | Medium | Low | Medium | Advisor context | Pedagogy improvement | None | project/capstone descriptions | official module text | collaboration tags later | Extract project mode | Optional project overread | Low | Low | Low-Medium | High | Reviewer agrees on project evidence | Yes, blocked by 4, 6 | Delay |
| Research vs applied preference | labs vs capstone/internship evidence | Research/applied balance improves fit | Strong counseling axis | High | ORX-U/P | High | Advisor context | Program positioning | Program tags | labs, thesis, capstone, internship | official program/lab pages | orientation score later | Classify balance | Marketing claims | Medium | Medium | Medium | Medium | Human labels research/applied balance | Yes, blocked by 4, 5, 6 | Prototype Later |

## Skills / Future of Work

| Idea | Component | Hypothesis | Why | Product | ORX | Student | CRM | Uni Dash | Public | Crawler data | Evidence | Schema delta later | AI role | Review trigger | Gaming risk | Cost | Accuracy | Verify diff | Runtime test later | Blocked | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Program-to-skills mapping | 4 plus 5 | Outcomes/modules can map programs to skill clusters | Core future-readiness | High | High | High | Advisor proof | Curriculum gaps | Program pages | outcomes, modules | official course pages | skill facts later | Extract/map skills | Thin evidence or hallucinated skills | High | Medium | High | High | Skill labels validated by human benchmark | Yes, blocked by 4, 5 | Benchmark First |
| Skills-to-occupations mapping | external taxonomy later plus 5 | Skills can connect to occupations without claiming guaranteed jobs | Improves career paths | High | ORX-P | High | Advisor context | Program positioning | Public career paths | skill tags | occupational taxonomy later | occupation mappings later | Map taxonomy | Unsupported job promise | High | Medium | Medium | High | Taxonomy mapping review by advisors | Not crawler-blocked, but product blocked by skill evidence | Prototype Later |
| Future demand | country/occupation layer | Demand forecasts can contextualize skills | Student value but external dependency | High | ORX-C/P | High | Advisor context | Market guidance | Country pages | skill/occupation tags | labor market sources later | demand facts later | Summarize forecasts | Outdated or biased forecasts | High | High | Medium | High | Dated-source forecast benchmark | External data dependency; delay | Delay |
| AI exposure | 1D/3 plus 5 | Programs with real AI workflow exposure can be distinguished from buzzwords | ORX differentiator | High | High | High | Advisor proof | Curriculum improvement | ORX explanation | modules, tools, outcomes | official course text | AI exposure facts later | Classify exposure | Buzzword stuffing | Very high | Medium | High | High | <=5% verified-error AI exposure signal | Yes, blocked by 5, 6 | Benchmark First |
| Skill durability | skills plus future demand | Foundational vs tool-specific skill balance predicts durability | Useful future lens | Medium | High | Medium-High | Advisor context | Curriculum improvement | Explanation | modules/outcomes | official course text | durability score later | Classify skill type | Speculative claims | Medium | Medium | Low-Medium | High | Expert review of durability labels | Yes, blocked by 5 | Benchmark First |
| Transferability | skills plus discipline | Cross-industry skill breadth improves resilience | ORX-P core | High | High | High | Advisor context | Curriculum guidance | Program comparison | modules/outcomes | official course text | transferability tags later | Classify breadth | Overbroad claims | Medium | Medium | Medium | Medium | Label broad/narrow skill mix | Yes, blocked by 5 | Keep |
| Student fit | skills plus psych profile | Skill evidence plus preferences improves personalized ranking | Product core | High | Indirect | Very high | High | None | None | verified skills, program facts | skill evidence + student profile | fit decision records later | Explain match | Sensitive/personality overreach | Medium | Medium | Medium | High | Advisor review of ranked shortlist | Yes, blocked by 4, 6 | Prototype Later |
| ORX program future readiness | 5 ORX-P | Skill, AI, transferability, applied learning combine into ORX-P | Ranking pillar | High | Very high | High | Advisor proof | Improvement guidance | Public score later | mapped signals | signal evidence | ORX-P score artifacts later | Score explanation | Low confidence score | High | Medium | High | High | Holdout benchmark and <=5% signal error | Yes, blocked by 5, 6 | Benchmark First |

## Country Layer

Country-layer work should be simulation-only until source policy, update cadence, and legal review are defined. Most country facts are time-sensitive and may require external official sources later.

| Idea | Component | Hypothesis | Why | Product | ORX | Student | CRM | Uni Dash | Public | Crawler data | Evidence | Schema delta later | AI role | Review trigger | Gaming risk | Cost | Accuracy | Verify diff | Runtime test later | Blocked | Rec |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Post-study work policy | Country layer plus matcher | Policy affects student ROI | High decision value | High | ORX-C | Very high | Advisor proof | Country positioning | Country pages | none from crawler unless university cites it | official gov policy later | policy facts later | Summarize dated rules | Policy changed or ambiguous | Medium | Medium | Medium | High | Dated official source verification | External source dependency | Delay |
| Visa difficulty | Country layer plus CRM | Risk grading helps case planning | Operational value | Medium | ORX-C context | High | High | None | Country pages | none | official visa rules plus case data later | visa risk facts later | Summarize risk | Stereotyping or outdated rule | High | Medium | Low-Medium | High | Advisor-labeled risk calibration | External source dependency | Delay |
| Work rights | Country layer | Student work eligibility affects budget and fit | High | High | ORX-C | High | High | None | Country pages | none | official gov sources later | work rights facts later | Extract limits | Policy date missing | Medium | Medium | Medium | High | Verify hours/conditions/date | External source dependency | Delay |
| Cost of living | Country/city layer | Budget fit needs living cost context | High | High | ORX-C context | Very high | High | Country positioning | Country pages | university housing/fee pages if available | official/institution cost pages later | cost facts later | Normalize ranges | Outdated or city mismatch | Medium | High | Medium | High | Cost source date and city match benchmark | Partly crawler-dependent; external dependency | Delay |
| Safety/stability | Country layer | Students and parents need risk context | Sensitive | Medium | ORX-C context | High | CRM risk | Country positioning | Country pages | none | official advisories later | safety risk facts later | Summarize neutrally | Political/sensitive error | Medium | Medium | Low | High | Human/legal review required | External source dependency | Delay |
| Language barrier | Country plus program support | Language context affects fit | High | Medium | Low | High | Advisor context | International support | Country/program pages | language of instruction, support pages | official support pages | language risk later | Explain barriers | Cultural overgeneralization | Medium | Low | Medium | High | Reviewer checks sensitive phrasing | Yes for program facts; country source later | Delay |
| Labor market demand | Country plus skills | Demand context improves future-readiness | High but external | High | ORX-C/P | High | Advisor proof | Country positioning | Country pages | skill mappings | official labor sources later | labor demand facts later | Summarize trends | Forecast overclaim | High | High | Medium | High | Dated forecast benchmark | External dependency | Delay |
| Tech ecosystem | Country layer | Tech ecosystem supports ORX-C and career pathways | ORX value | Medium | High | Medium | Advisor context | Country positioning | Country pages | institution incubator/lab pages | official reports later | ecosystem facts later | Summarize | Startup hype | High | Medium | Medium | High | Source diversity benchmark | External dependency | Delay |
| International student policy | Country layer | Policy posture affects student risk and conversion | High | High | ORX-C | High | High | University recruitment context | Country pages | university international pages | government/university policy pages | policy facts later | Summarize changes | Policy stale | Medium | Medium | Medium | High | Current policy/date verified | External dependency | Delay |
| Recognition/accreditation environment | Country plus accreditation | Recognition affects credential value | High-stakes | Medium | ORX-C | High | Advisor risk | University proof | Public trust | accreditation pages | official recognition bodies | recognition facts later | Normalize bodies | Unrecognized body | High | Medium | High | High | Verify body, date, scope | Partly blocked by 5, 6 | Benchmark First |

## Blocked Until Runtime Closed

Blocked by 1E Review Surface:

- Human review triggers for ORX and student decisions.
- Reviewer agreement benchmarks that depend on production review queues.
- University dispute or improvement guidance loops.

Blocked by 4 Draft Writer:

- Program requirement hardness, apply packs, deadline radar, eligibility matching, substitutions, and public program facts.

Blocked by 5 ORX Mapper:

- ORX evidence integration, signal scoring, ORX explanations, anti-gaming score actions, and future-readiness rollups.

Blocked by 6 Verify/Publish Gate:

- Public ORX explanations, public trust badges, student-facing advice, CRM-ready recommendations, and any canonical/public updates.

## What Must Not Be Built Yet

- ORX scoring production jobs.
- Public ORX score pages or badges.
- Student eligibility automation that writes decisions to production.
- Country policy ingestion from external sources.
- AI advisor behavior that cites unverified crawler outputs.
- Schema, Edge Functions, migrations, or crawler language expansion.

## Recommended Next 5 Prototypes

1. ORX signal candidate benchmark for AI exposure, applied learning, accreditation, and curriculum freshness.
2. Program Requirement Hardness Classifier on saved official requirement snippets.
3. Official Apply Pack simulation using verified apply/deadline/document evidence.
4. Program-to-skills mapping benchmark using outcomes and module descriptions.
5. Published ORX signal <=5% verified-error strategy with a labeled holdout pack.
