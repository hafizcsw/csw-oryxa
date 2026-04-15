# ORX RANK Methodology v1.1

> **Status**: Contract defined · **Scoring engine**: Not yet implemented · **Version**: 1.1 (tightened from 1.0)

---

## 1. Executive Snapshot

ORX RANK is a **multi-layer future-readiness ranking** that evaluates how well a country, university, or program prepares students for the AI-era economy. It is NOT a traditional prestige ranking. It measures **forward-looking capability**: curriculum freshness, AI integration, industry linkage, and adaptability.

### Core Principles
- **Evidence-only**: No score without verifiable evidence. No fabrication.
- **Multi-layer**: Country context (ORX-C) + University readiness (ORX-U) + Program relevance (ORX-P)
- **Transparent**: Every score can be traced to evidence sources.
- **Decay-aware**: Old evidence loses weight. Freshness matters.
- **Version-locked**: Every score is tied to a methodology version.
- **Independence-aware** (v1.1): Confidence requires evidence from independent sources, not just volume.
- **Discipline-sensitive** (v1.1): Program scoring interpretation varies by discipline family.

---

## 2. Layers

| Layer | Code | Scope | Weight in Final Score |
|-------|------|-------|-----------------------|
| Country Context | ORX-C | National AI/digital readiness ecosystem | **20%** |
| University Readiness | ORX-U | Institutional capability & adaptability | **35%** |
| Program Relevance | ORX-P | Individual program future-value | **45%** |

### Weight Justification
- **Program (45%)**: Students enroll in programs, not countries. The program is the most actionable unit for student decision-making and has the most granular, verifiable signals.
- **University (35%)**: Institutional culture, infrastructure, and adaptability directly shape program quality but are harder to change quickly.
- **Country (20%)**: Provides context (regulatory environment, digital infrastructure, talent ecosystem) but is least actionable for individual student choice.

### ⚠️ Weight Status: PROVISIONAL

These weights are **provisional v1.1 values**. They MUST be calibrated against real scored entities before production scoring begins. Calibration testing will involve:
1. Scoring a representative sample across disciplines and regions
2. Comparing score distributions for intuitive alignment
3. Adjusting weights if layer dominance distorts meaningful differentiation

Do not treat 20/35/45 as final until calibration is complete.

---

## 3. Signal Families

### 3.1 ORX-C — Country Context (20%)

| Signal Family | Weight within ORX-C | Description |
|---------------|---------------------|-------------|
| `ai_ecosystem` | 25% | AI startup density, VC funding in AI, AI company headquarters |
| `government_ai_readiness` | 20% | National AI strategy existence, AI regulation maturity, public AI investment |
| `digital_infrastructure` | 20% | Internet penetration, 5G coverage, cloud infrastructure, data center density |
| `talent_skills_environment` | 20% | STEM graduate ratio, AI talent concentration, international talent attraction |
| `policy_maturity` | 15% | Education policy modernization, recognition of online/hybrid credentials, visa policies for tech talent |

### 3.2 ORX-U — University Readiness (35%)

| Signal Family | Weight within ORX-U | Description | Cap |
|---------------|---------------------|-------------|-----|
| `curriculum_update_velocity` | 20% | How frequently programs/courses are updated | — |
| `ai_integration` | 20% | AI tools in teaching, AI-specific courses/labs, AI research output | — |
| `applied_learning` | 18% | Industry partnerships, internship programs, co-ops, capstone projects | — |
| `flexible_learning` | 12% | Online/hybrid options, micro-credentials, modular pathways | — |
| `transparency_data_freshness` | 10% | Data recency on official site, published outcomes, accessible catalogs | — |
| `student_signal` | 10% | Verified student satisfaction, employment outcomes | **50% cap** |
| `research_compute` | 10% | Research labs, compute resources, AI/ML infrastructure | — |

### 3.3 ORX-P — Program Relevance (45%)

| Signal Family | Weight within ORX-P | Description | Cap |
|---------------|---------------------|-------------|-----|
| `future_skill_alignment` | 25% | Alignment with projected labor market demand (5-10 years) | — |
| `curriculum_freshness` | 20% | Age of curriculum content, last major revision, emerging topics | — |
| `ai_workflow_exposure` | 18% | Hands-on AI tool usage, AI-augmented assignments, GenAI literacy | — |
| `transferability` | 15% | Cross-industry applicability, foundational vs. narrow skill balance | — |
| `applied_industry_signal` | 12% | Real project work, industry mentors, job placement pathways | — |
| `student_value_signal` | 10% | Verified outcome data: employment rate, salary uplift, time-to-employment | **50% cap** |

---

## 3.4 Program Discipline Families (v1.1)

ORX-P is NOT a generic one-size-fits-all model. Program scoring interpretation **varies by discipline family**.

### Defined Discipline Families

| Key | Scope |
|-----|-------|
| `computing_ai_data` | Computer science, AI, data science, software engineering |
| `engineering` | Mechanical, electrical, civil, chemical, industrial |
| `business_finance` | MBA, finance, accounting, management, marketing |
| `health_medicine` | Medicine, nursing, pharmacy, public health, biomedical |
| `law_policy` | Law, public policy, international relations, governance |
| `design_media` | Graphic design, UX, film, journalism, communications |
| `education` | Teaching, pedagogy, educational technology, curriculum design |
| `social_sciences` | Psychology, sociology, economics, political science |

### Discipline Impact Rules

1. **Same signal families apply** to all disciplines — no separate signal sets.
2. **Interpretation differs**: e.g., `ai_workflow_exposure` for a computing program has different evidence expectations than for a law program.
3. **Weight overrides** may be applied per discipline in future versions (scaffold exists in config but is empty for v1.1).
4. **Scoring engine MUST tag** each program with its discipline family before computing ORX-P.
5. Programs without a discipline tag default to generic interpretation but receive a **confidence penalty of -10 points**.

### What is NOT in v1.1
- Full discipline-specific rubrics (deferred to v1.2+)
- Discipline-specific weight tables
- Multi-discipline programs (e.g., "AI + Law") — handled as primary discipline only

---

## 4. Evidence Acceptance Rules

### 4.1 Valid Evidence Sources

| Source Type | Trust Level | Contextual Only? | Examples |
|-------------|-------------|-------------------|----------|
| `official_website` | HIGH | No | University/program pages, course catalogs |
| `course_catalog` | HIGH | No | Structured course listings with descriptions |
| `official_pdf` | HIGH | No | Handbooks, prospectuses, annual reports |
| `structured_data` | HIGH | No | Schema.org markup, API responses |
| `government_report` | HIGH | No | National education statistics, AI strategy documents |
| `accreditation_body` | HIGH | No | QAA, ABET, EQUIS, AACSB reports |
| `verified_student_data` | MEDIUM | No | Authenticated student reviews with enrollment verification |
| `third_party_index` | MEDIUM | **Yes** | QS, THE, Shanghai rankings |
| `news_press` | LOW | **Yes** | Press releases, news articles |

### 4.2 Third-Party Index Rule (v1.1 — EXPLICIT)

**QS, THE, Shanghai, and similar rankings are CONTEXTUAL INPUTS ONLY.**

They may inform background understanding but:
- ❌ **NEVER** serve as primary evidence for any signal family score
- ❌ **NEVER** cause direct score inheritance (e.g., "QS rank 50 → ORX score 80")
- ❌ **NEVER** substitute for first-party evidence

Valid uses:
- ✅ Corroborate research output claims
- ✅ Cross-check country-level talent density
- ✅ Validate that a university is accredited/recognized

**Violation of this rule invalidates the `scored` status.**

### 4.3 Invalid Evidence (Excluded)

- Unverified anonymous reviews
- Social media posts without institutional verification
- Marketing materials without factual claims
- AI-generated content without human verification
- Paid advertisements or sponsored content
- Outdated content (>36 months without refresh signal)
- Self-reported data without corroboration

### 4.4 Evidence Metadata Required

Every evidence item must carry:
- `source_url`: Where it was found
- `source_type`: Category from above
- `source_domain`: Registrable domain (for independence scoring)
- `observed_at`: When it was captured
- `content_hash`: For deduplication
- `trust_level`: HIGH / MEDIUM / LOW
- `freshness_date`: The date the content itself refers to (not crawl date)
- `contextual_only`: Boolean flag if source type is contextual-only

---

## 5. Confidence Logic

Confidence is a 0-100 score indicating how reliable the ORX score is.

### 5.1 Confidence Factors (v1.1 — updated)

| Factor | Weight | Description |
|--------|--------|-------------|
| `evidence_count` | 20% | Total evidence pieces (diminishing returns above 10) |
| `evidence_diversity` | 20% | Evidence from multiple source types |
| `source_independence` | **20%** | Evidence from multiple independent domains (v1.1) |
| `evidence_freshness` | 15% | Average age of evidence items |
| `signal_completeness` | 15% | % of signal families with at least one evidence item |
| `conflict_rate` | 10% | Low conflict between evidence items = higher confidence |

### 5.2 Source Independence (v1.1 — NEW)

**Problem solved**: Prevent confidence inflation from crawling many pages on the same university website. 100 pages from `example-university.edu` should not produce higher confidence than 5 pages from 3 different domains.

**Rules**:
- Each unique **registrable domain** counts as one independent source
- Multiple pages on the same domain count as **ONE source** for independence scoring
- Same-domain evidence can contribute at most **40%** of the independence factor
- Minimum **2 independent sources** required for confidence > 50
- Minimum **3 independent sources** required for confidence > 70

### 5.3 Confidence Thresholds

| Confidence Range | Interpretation |
|------------------|----------------|
| 80-100 | Strong: multiple fresh, diverse, independent sources |
| 60-79 | Moderate: adequate evidence, some gaps |
| 40-59 | Weak: limited sources, staleness concerns |
| 0-39 | Insufficient: triggers `insufficient` status |

### 5.4 Conflict Handling

When evidence items disagree:
1. Prefer higher trust-level sources
2. Prefer more recent sources
3. If still ambiguous, average and reduce confidence by 10 points
4. Flag for human review if conflict is material (>20% score swing)

---

## 6. Student Signal Cap (v1.1 — NEW)

### Problem

No verified student enrollment/identity pipeline exists in v1.x. Allowing student-based signals at full weight risks inflating scores with unverified or low-quality data.

### Rule

Until a verified student pipeline is operational:
- `student_signal` (ORX-U) is capped at **50% of its nominal weight contribution**
- `student_value_signal` (ORX-P) is capped at **50% of its nominal weight contribution**

### Effect

- `student_signal` effective weight: 10% × 50% = **5% of ORX-U**
- `student_value_signal` effective weight: 10% × 50% = **5% of ORX-P**
- Remaining weight is redistributed proportionally across uncapped signals in the same layer

### Lift Condition

This cap is lifted when:
- Verified enrollment + identity pipeline is operational
- At least 100 verified student data points exist across 10+ institutions
- Documented in a methodology version bump (v1.2+)

---

## 7. Status Thresholds (v1.1 — TIGHTENED)

| Status | Criteria |
|--------|----------|
| `scored` | ALL of: confidence ≥ 40, ≥ 3 signal families have evidence, ≥ 5 total evidence items, ≥ 1 HIGH trust source, ≥ 2 independent sources, core families covered, score computation completed |
| `evaluating` | Entity known but evidence collection in progress OR confidence < 40 but trending up |
| `insufficient` | Entity evaluated but fewer than 3 signal families have evidence AND confidence < 40 after full evaluation attempt |

### v1.1 Scored Requirements (all must be met)

| Requirement | Threshold | Rationale |
|-------------|-----------|-----------|
| Minimum confidence | ≥ 40 | Prevents scoring with weak evidence |
| Signal families with evidence | ≥ 3 | Ensures multi-dimensional coverage |
| Total evidence items | ≥ 5 | Prevents scoring from a single page scrape |
| HIGH trust sources | ≥ 1 | At least one authoritative source required |
| Independent sources | ≥ 2 | Prevents single-origin inflation |
| Core families covered | Per layer (see below) | Key signals must not be missing |

### Required Core Families

| Layer | Must-have families |
|-------|-------------------|
| University | `curriculum_update_velocity`, `ai_integration` |
| Program | `future_skill_alignment`, `curriculum_freshness` |
| Country | `ai_ecosystem` |

Missing a required core family → entity cannot reach `scored` status regardless of other evidence.

### Status Transitions
```
[new entity] → evaluating → scored (when ALL thresholds met)
[new entity] → evaluating → insufficient (after full evaluation, thresholds not met)
insufficient → evaluating (when new evidence arrives)
scored → evaluating (when methodology version changes, pending re-evaluation)
```

---

## 8. Freshness & Decay

### 8.1 Decay Model

| Evidence Age | Weight Multiplier |
|-------------|-------------------|
| 0-6 months | 1.0 (full weight) |
| 6-12 months | 0.9 |
| 12-18 months | 0.75 |
| 18-24 months | 0.6 |
| 24-36 months | 0.4 |
| 36+ months | 0.0 (excluded) |

### 8.2 Score Staleness

- A score is marked **stale** if no evidence has been refreshed in 12 months
- Stale scores remain visible but display a staleness indicator
- After 24 months without refresh, score reverts to `evaluating`

### 8.3 Re-evaluation Triggers

- New evidence arrives for the entity
- Methodology version changes
- 6 months since last evaluation (periodic refresh)
- Manual admin trigger

---

## 9. Versioning Contract

| Field | Value |
|-------|-------|
| `methodology_version` | `"1.1"` |
| `version_date` | `"2026-03-15"` |
| `breaking_change` | Major version bump (1.x → 2.0) = full re-evaluation |
| `non_breaking` | Minor version (1.1 → 1.2) = recalculate with new weights, no re-crawl |

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-15 | Initial methodology contract |
| 1.1 | 2026-03-15 | Discipline families, source independence, tightened status thresholds, third-party index rule, student signal cap, provisional weight marking |

---

## 10. Badge Criteria

| Badge | Criteria |
|-------|----------|
| `future_ready` | Overall ORX score ≥ 75 |
| `high_future_relevance` | ORX-P score ≥ 80 |
| `ai_era_ready` | `ai_integration` (ORX-U) ≥ 70 AND `ai_workflow_exposure` (ORX-P) ≥ 70 |
| `strong_industry_link` | `applied_learning` (ORX-U) ≥ 75 AND `applied_industry_signal` (ORX-P) ≥ 75 |
| `fast_adapter` | `curriculum_update_velocity` (ORX-U) ≥ 80 |
| `transparent` | `transparency_data_freshness` (ORX-U) ≥ 80 |

---

## 11. Unresolved Questions / Constraints

1. **Country data sourcing**: Where exactly do ORX-C signals come from? Need specific index/API sources (OECD, ITU, etc.).
2. **Student signal verification**: How do we authenticate student enrollment for verified reviews? Pipeline not yet designed.
3. **Cross-country normalization**: Should scores be globally absolute or regionally normalized? v1.1 uses global absolute.
4. **Language coverage for evidence**: Evidence in non-English languages needs translation/extraction pipeline. Not in v1.1 scope.
5. **Historical evidence**: Should we score based on trajectory (improving/declining) or snapshot? v1.1 uses snapshot only.
6. **Discipline rubric depth**: v1.1 scaffolds discipline families but full rubrics are deferred to v1.2+.
7. **Weight calibration**: 20/35/45 split is provisional. Must be tested against real scored entities before production launch.
8. **Multi-discipline programs**: Programs spanning multiple disciplines (e.g., "AI + Law") currently use primary discipline only. Needs design work.
9. **Student signal cap lift**: What is the minimum viable student verification pipeline? Needs specification before cap can be lifted.
10. **Source independence edge cases**: How to handle CDN-hosted PDFs, government portals that aggregate multiple institutions, etc.

---

## 12. Verdict: Safe for Evidence Ingestion?

**YES — with constraints.**

v1.1 is safe to begin evidence ingestion because:
- Status thresholds are strict enough to prevent premature `scored` status
- Source independence prevents single-origin inflation
- Student signal caps prevent unverified data inflation
- Third-party index guardrails prevent score inheritance
- Discipline family scaffold prevents one-size-fits-all ORX-P

**Not yet safe for**:
- Production scoring (weights are provisional)
- Public display of scores (no calibration testing done)
- Student-sourced data at full weight (no verification pipeline)
