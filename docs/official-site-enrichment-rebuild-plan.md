# Official-Site-Only University Enrichment Lane — Rebuild Plan

## Executive Summary

The existing `official-site-crawl-orchestrator` + `official-site-crawl-worker` pipeline is **structurally sound** and will serve as the base. It already has: job lifecycle, official-domain-only validation, evidence-backed observations, lane-based publish gating (A/B/C), anti-bot detection, coverage tracking, and special queue for failures.

**What needs to change**: Expand field coverage, add country-level job targeting, expand page discovery, add completeness scoring, and remove all UniRanks/QS/Door5 from active publish paths.

---

## 1. CURRENT ARCHITECTURE vs TARGET ARCHITECTURE

### What EXISTS and is REUSABLE (✅):

| Component | Location | Status |
|---|---|---|
| Job lifecycle (create→crawl→verify→publish→done) | `official-site-crawl-orchestrator` | ✅ Reuse |
| Official domain validation + blocked domains | `official-site-crawl-worker` L51-59 | ✅ Reuse |
| Firecrawl Map (page discovery) | `official-site-crawl-worker` L70-83 | ✅ Expand |
| Firecrawl Scrape | `official-site-crawl-worker` L87-103 | ✅ Reuse |
| Anti-bot detection | Both files | ✅ Reuse |
| Deterministic extraction | `official-site-crawl-worker` L116-153 | ⚠️ Expand significantly |
| URL categorization | `official-site-crawl-worker` L161-171 | ⚠️ Expand |
| Observation storage | `official_site_observations` table | ✅ Reuse |
| Lane-based publish (A/B/C risk) | `official-site-crawl-orchestrator` L673-782 | ✅ Reuse + tighten |
| Verify rules (7 rules) | `official-site-crawl-orchestrator` L533-671 | ✅ Reuse |
| Coverage tracking per row | `official-site-crawl-worker` L196-198 | ⚠️ Expand |
| Special queue | `official_site_special_queue` table | ✅ Reuse |
| Auto-run (cron handler) | `official-site-crawl-orchestrator` L889-999 | ✅ Reuse |
| Tick-based dispatch with lease | `official-site-crawl-orchestrator` L331-407 | ✅ Reuse |
| Publish batches audit trail | `official_site_publish_batches` table | ✅ Reuse |

### What MUST BE ADDED (🔨):

| Component | Description |
|---|---|
| Country-level job targeting | `handleCreate` must accept `country_codes[]` filter |
| Expanded field contract (12 groups) | From 7 fields → 12 field groups |
| Expanded page discovery | From `search: \"about programs tuition\"` → targeted multi-keyword map |
| Page budget control | Configurable `max_pages_per_uni` at job level |
| Completeness scoring | Per-university + per-section completeness model |
| Admissions/deadlines extraction | New extractors |
| Scholarship extraction | New extractor |
| Language requirements extraction | New extractor |
| Program inventory extraction | Deep program list extraction |
| Student life / facilities extraction | New extractor |
| Media/brochure link extraction | New extractor |
| Apply/CTA link extraction | New extractor |

### What MUST BE FROZEN/REMOVED (❌):

| Component | Location | Action |
|---|---|---|
| UniRanks active crawl in crawl-runner-tick | `crawl-runner-tick` L162 (`door2Source: \"uniranks\"`) | Freeze: add policy gate |
| QS active crawl in crawl-runner-tick | `crawl-runner-tick` + `qs-full-crawl-orchestrator` | Freeze: add policy gate |
| Door5 direct university writes | `door5-enrich-worker` | ✅ Already frozen (Phase 1) |
| Door5 mapDraftsToPrograms | `door5-enrich-worker` | ✅ Already frozen (Phase 1) |
| admin-publish-qs-drafts unverified publish | `admin-publish-qs-drafts` | ✅ Already gated (Phase 1) |
| UniRanks snapshot direct writes | `admin-backfill-uniranks-snapshots` | ✅ Already frozen (Phase 1) |
| bulk-import-enrichment direct writes | `bulk-import-enrichment` L177 | Freeze |
| publish-qs-programmes direct writes | `publish-qs-programmes` L142 | Freeze |

---

## 2. SOURCE POLICY (HARD RULE)

### Allowed sources (this lane):
- Official university root domain
- Official university subdomains (admissions, programs, international, etc.)
- Official PDF/brochure links on official domain

### Blocked sources:
- `uniranks.com` — already in BLOCKED_DOMAINS
- `topuniversities.com` (QS) — already in BLOCKED_DOMAINS
- `4icu.org` — already in BLOCKED_DOMAINS
- `webometrics.info` — already in BLOCKED_DOMAINS
- `studyinrussia.ru` (Door5) — **add to BLOCKED_DOMAINS**
- All aggregator/directory domains in existing denylist

### Legacy data policy:
- UniRanks/QS/Door5 data remains in `program_draft`, `uniranks_page_snapshots`, etc. as **reference only**
- No active crawl, no active extraction, no publish path from these sources

---

## 3. JOB FILTERS (TARGET)

Current `handleCreate` accepts: `rank_mode: \"all\" | \"top500\" | \"top1000\" | \"pilot10\"`

### Target job parameters:
```typescript
{
  // Targeting
  country_codes?: string[];      // NEW: ["TR", "DE", "RU"] or empty = all
  university_ids?: string[];     // NEW: specific IDs (for re-crawl)
  max_universities?: number;     // NEW: optional cap
  
  // Page budget
  max_pages_per_uni?: number;    // NEW: default 8, max 20
  
  // Existing
  rank_mode?: string;            // KEEP: "all" | "top500" | "top1000" | "pilot10"
}
```

### Implementation: Modify `handleCreate` in orchestrator
- Add `.in("country_id", countryIds)` join filter via `geo_countries`
- Add `max_universities` as `.limit()`
- Store `max_pages_per_uni` in `stats_json` on job row
- Pass to worker via `official_site_crawl_rows` or job config

---

## 4. REQUIRED FACT GROUPS (12 sections)

### Current coverage (7 fields):
`description, logo, images, contact, housing, programs, fees`

### Target coverage (12 field groups):

| # | Group | Field Names | Page Keywords |
|---|---|---|---|
| 1 | **Identity** | `description, official_name, established_year, type, accreditation` | about, overview, profile |
| 2 | **Contact/Location** | `email, phone, address, campus_location, map_link` | contact, about, campus |
| 3 | **Admissions** | `admission_requirements, documents_required, application_process` | admission, apply, requirements |
| 4 | **Deadlines/Intakes** | `deadlines, intake_months, academic_calendar` | admission, calendar, deadlines, apply |
| 5 | **Tuition/Fees** | `tuition_fee, fee_structure, payment_info, currency, billing_period` | tuition, fees, cost, price |
| 6 | **Scholarships** | `scholarship_names, eligibility, amounts, application_links` | scholarship, financial-aid, funding |
| 7 | **Language** | `language_of_instruction, language_requirements, ielts_min, toefl_min` | language, requirements, international |
| 8 | **Programs** | `program_list, degree_levels, faculties` | programs, courses, faculties, departments |
| 9 | **Housing** | `housing_info, dorm_details, pricing, availability` | accommodation, housing, dormitor, residence |
| 10 | **Student Life** | `facilities, clubs, sports, student_services` | student-life, campus, facilities, clubs |
| 11 | **Media/Brochures** | `gallery_images, brochure_links, video_links` | gallery, media, downloads, brochures |
| 12 | **Apply/CTA** | `apply_link, inquiry_link, portal_link` | apply, admission, contact, international |

### Completeness model:

```typescript
interface UniversityCompleteness {
  university_id: string;
  overall_score: number;        // 0-100, weighted
  sections: {
    [group: string]: {
      score: number;            // 0-100
      fields_found: string[];
      fields_missing: string[];
      source_urls: string[];
      evidence_quality: 'strong' | 'weak' | 'none';
    }
  };
  total_fields_found: number;
  total_fields_required: number;
  crawled_pages: number;
  official_source_confirmed: boolean;
}
```

Section weights for overall score:
- Identity: 15%
- Contact: 10%  
- Admissions: 10%
- Deadlines: 5%
- Tuition: 15%
- Scholarships: 5%
- Language: 5%
- Programs: 15%
- Housing: 5%
- Student Life: 5%
- Media: 5%
- Apply/CTA: 5%

---

## 5. EXPANDED PAGE DISCOVERY

### Current:
```typescript
firecrawlMap(website, 30, \"about programs tuition\")  // single search
```

### Target:
```typescript
// Multi-pass discovery with targeted keywords per section
const DISCOVERY_PASSES = [
  { search: \"admissions requirements apply\", category: \"admissions\" },
  { search: \"tuition fees cost price\", category: \"fees\" },
  { search: \"programs courses degrees faculties\", category: \"programs\" },
  { search: \"scholarships financial aid funding\", category: \"scholarships\" },
  { search: \"accommodation housing dormitory residence\", category: \"housing\" },
  { search: \"international students language requirements\", category: \"language\" },
  { search: \"contact about campus location\", category: \"contact\" },
  { search: \"student life facilities services\", category: \"student_life\" },
  { search: \"deadlines calendar intake dates\", category: \"deadlines\" },
];
```

### Page budget enforcement:
- Default: 8 pages per university
- Max: 20 pages
- Priority: 1 homepage + top pages by section priority
- Deduplicate URLs across passes
- Stay within official domain only

---

## 6. PUBLISH RULES (TIGHTENED)

### Current lanes:
- Lane A (low risk): description, logo, images, contact → fill-empty only
- Lane B (medium risk): programs, housing → obs_published_only (no direct write)
- Lane C (high risk): fees → quarantined (never applied)

### Target lanes:
- **Lane A** (auto-apply, fill-empty): identity (description only), logo, media → fill-empty, evidence required
- **Lane B** (obs-only, admin review): contact, admissions, deadlines, programs, language, housing, student life, apply/CTA
- **Lane C** (quarantine, never auto): tuition/fees, scholarships (financial claims)
- **Lane D** (never write): any field that conflicts with existing published data → stays `review`

### Hard rules:
1. No fact publishes without `source_url` + `evidence_snippet`
2. No destructive overwrite — fill-empty only for Lane A
3. Conflicting facts → `review` status
4. `confidence < 0.4` → quarantined
5. Anti-bot page → entire page skipped
6. Non-official source URL → quarantined

---

## 7. DATA MODEL (NO SCHEMA CHANGES NEEDED)

All required tables already exist:

| Table | Purpose | Status |
|---|---|---|
| `official_site_crawl_jobs` | Job lifecycle | ✅ Exists |
| `official_site_crawl_rows` | Per-university crawl state | ✅ Exists |
| `official_site_observations` | Extracted facts with evidence | ✅ Exists |
| `official_site_publish_batches` | Publish audit trail | ✅ Exists |
| `official_site_special_queue` | Failed/special cases | ✅ Exists |
| `university_field_provenance` | Per-field source tracking | ✅ Exists |
| `raw_pages` | Raw page content storage | ✅ Exists |

### Only addition needed:
- Store `completeness_result` JSON on `official_site_crawl_rows` (already has `coverage_result` — can extend)
- Add `country_codes` filter column to `official_site_crawl_jobs` (via migration)

---

## 8. FREEZE/REMOVE LIST

### Already frozen (Phase 1 safety repair):
- ✅ Door5 → `universities` direct writes
- ✅ Door5 → `programs` direct writes (mapDraftsToPrograms)
- ✅ admin-publish-qs-drafts → unverified publish
- ✅ admin-backfill-uniranks-snapshots → website direct write

### Must still freeze:
1. `publish-qs-programmes/index.ts` L142: writes `publish_status: 'published'` directly
2. `bulk-import-enrichment/index.ts` L177: writes to `universities` directly
3. `crawl-runner-tick` L162: UniRanks/QS as active source → add policy gate to skip when `crawl_policy.mode === \"official_only\"`

### Must add to BLOCKED_DOMAINS:
- `official-site-crawl-worker` L51: add `\"studyinrussia.ru\"`

---

## 9. MINIMAL SAFE EXECUTION ORDER

### Phase 2a: Freeze remaining paths (1 day)
1. Freeze `publish-qs-programmes` direct publish
2. Freeze `bulk-import-enrichment` direct university writes
3. Add `studyinrussia.ru` to BLOCKED_DOMAINS in worker
4. Add `crawl_policy.mode === \"official_only\"` gate in `crawl-runner-tick`

### Phase 2b: Expand orchestrator + worker (2-3 days)
1. Add `country_codes` filter to `handleCreate`
2. Add `max_pages_per_uni` job-level config
3. Expand page discovery (multi-pass keyword search)
4. Expand URL categorization (12 categories)
5. Expand field extraction (12 field groups)
6. Add completeness scoring to crawl_rows

### Phase 2c: Verify + test (1 day)
1. Run pilot: 1 country (e.g., Turkey — ~200 universities with websites)
2. Verify: observations stored with evidence
3. Verify: no direct writes to `universities`
4. Verify: completeness scores computed
5. Verify: publish only applies Lane A fill-empty

### Phase 2d: Scale (after verification)
1. Run: multi-country batch
2. Monitor: completeness distribution
3. Monitor: special queue size
4. Admin review: Lane B observations

---

## 10. RUNTIME VERIFICATION POINTS

After each phase, verify:

```sql
-- V1: No direct writes from non-official sources
SELECT COUNT(*) FROM university_field_provenance 
WHERE source_url LIKE '%uniranks%' OR source_url LIKE '%topuniversities%' 
  OR source_url LIKE '%studyinrussia%'
AND created_at > '[deploy_time]';
-- Expected: 0

-- V2: All observations have evidence
SELECT COUNT(*) FROM official_site_observations 
WHERE job_id = '[new_job_id]' AND evidence_snippet IS NULL;
-- Expected: 0

-- V3: All source URLs are within official domain
SELECT o.id, o.source_url, r.website
FROM official_site_observations o
JOIN official_site_crawl_rows r ON r.id = o.row_id
WHERE o.job_id = '[new_job_id]'
AND o.source_url NOT LIKE '%' || REPLACE(r.website, 'https://', '') || '%';
-- Expected: 0

-- V4: Completeness distribution
SELECT 
  CASE 
    WHEN (coverage_result->>'_meta'->>'fields_found')::int >= 10 THEN 'high'
    WHEN (coverage_result->>'_meta'->>'fields_found')::int >= 5 THEN 'medium'
    ELSE 'low'
  END as completeness_tier,
  COUNT(*)
FROM official_site_crawl_rows
WHERE job_id = '[new_job_id]'
GROUP BY 1;

-- V5: No publish without provenance
SELECT COUNT(*) FROM official_site_observations
WHERE status = 'published' AND evidence_snippet IS NULL;
-- Expected: 0
```

---

## 11. WHAT CAN BE REUSED vs REPLACED

### Reuse entirely (no changes):
- Job lifecycle tables + RPC counters
- Anti-bot detection
- Domain validation
- Verify rules (7 rules)
- Lane-based publish logic
- Special queue
- Auto-run handler
- Tick + dispatch + lease system

### Expand in-place (modify existing code):
- `handleCreate`: add country filter + page budget
- `deterministicExtract`: expand from 7 to 12 field groups
- `categorizeUrl`: expand categories
- `firecrawlMap`: multi-pass discovery
- `ALL_FIELDS` constant: expand
- `coverage` tracking: expand to match new fields

### Replace nothing.
The official-site-crawl pipeline is architecturally correct. It needs expansion, not replacement.
