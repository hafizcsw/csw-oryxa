# Phase 1: Official-Site-Only Freeze + Rewire Plan

## Status: EXECUTION PLAN — Not yet implemented

---

## 1. EXACT CODE PATHS TO FREEZE NOW

### 1A. `publish-qs-programmes/index.ts` — FREEZE ENTIRE FUNCTION
- **Risk**: Direct upsert into `programs` table with `publish_status: 'published'` (L176-216)
- **Source**: QS `qs_programme_details` → direct to production `programs`
- **No provenance, no approval_tier, no evidence**
- **Action**: Add early return with freeze message. Log telemetry.

### 1B. `bulk-import-enrichment/index.ts` — FREEZE PRODUCTION WRITES
- **Risk**: Direct `.update()` on `universities` table for website, country_code, city (L166-177)
- **Source**: Spreadsheet data from external sources
- **Action**: Block the `universities.update()` path. Keep staging-only mode.

### 1C. `crawl-uniranks-harvest-worker/index.ts` — FREEZE DIRECT WRITES
- **Risk**: Direct `.update()` on `universities` table (L139-140):
  - `name_en`, `description`, `logo_url`, `website`
  - ALL `uniranks_*` columns (rank, score, verified, recognized, world_rank, region_rank, etc.)
  - `enrolled_students`, `acceptance_rate`, `university_type`
  - `uniranks_snapshot`, `uniranks_snapshot_hash`, `uniranks_snapshot_at`
- **Action**: Remove the `universities.update()` call. Keep snapshot storage in `uniranks_page_snapshots` only.

### 1D. `crawl-runner-tick/index.ts` — DISABLE NON-OFFICIAL LANES
- **Risk**: Active lanes that crawl/publish from non-official sources:
  - **LANE 1** (L348): `runUniranksDirectLane()` — calls `crawl-uniranks-direct-worker`
  - **LANE 2** (L354): `runDoor2HarvestLane()` — calls `crawl-uniranks-harvest-worker`
  - **QS lane** (L209): `runQsHarvestLane()` — calls QS workers
  - **QS detail** (L219): `runQsDetailLane()` — calls QS detail workers  
  - **STAGE 1** (L360): `resolveWebsitesViaWorker()` — calls `uniranks-website-resolver-worker`
  - **STAGE 1.5** (L365): `seedProgramUrls()` — calls `crawl-uniranks-seed-worker`
  - **STAGE 6** (L423/449): `publishAuto()` / `publishAutoBatchless()` — auto-publishes drafts from ANY source
  - **STAGE 7** (L455): `fetchLogos()` — calls `crawl-logo-worker` (from UniRanks data)
- **Action**: Disable all non-official lanes. Keep only official batch stages if batch exists.

### 1E. `admin-publish-qs-drafts/index.ts` — ALREADY PARTIALLY FROZEN
- Currently requires `approval_tier = 'auto'` and `status = 'verified'`
- **Additional action**: Add explicit source check — only allow official-site schema versions.

### 1F. `door5-enrich-worker/index.ts` — VERIFY FREEZE HOLDS
- University direct writes already frozen (previous Phase 1)
- Programs action still exists but routes through `program_draft`
- **Action**: Confirm Door5 drafts cannot auto-publish. Add `schema_version` block.

---

## 2. EXACT NON-OFFICIAL SOURCE PATHS TO DISABLE

### Functions to disable entirely (no active crawl/extract role in official-only lane):
| Function | Source | Action |
|----------|--------|--------|
| `crawl-uniranks-direct-worker` | UniRanks | Disable dispatch from tick |
| `crawl-uniranks-harvest-worker` | UniRanks | Disable dispatch from tick + freeze direct writes |
| `crawl-uniranks-seed-worker` | UniRanks | Disable dispatch from tick |
| `uniranks-website-resolver-worker` | UniRanks/Google | Disable dispatch from tick |
| `crawl-logo-worker` | UniRanks | Disable dispatch from tick |
| `crawl-qs-profile-worker` | QS | Disable dispatch from tick |
| `crawl-qs-programme-detail` | QS | Disable dispatch from tick |
| `qs-full-crawl-orchestrator` | QS | No change needed (manual trigger only) |
| `qs-matched-crawl-launch` | QS | No change needed (manual trigger only) |
| `publish-qs-programmes` | QS | Freeze entire function |
| `admin-publish-qs-drafts` | QS | Block non-official schema versions |
| `door5-orchestrator` | StudyInRussia | No change (manual only) |
| `door5-enrich-worker` | StudyInRussia | Already frozen for direct writes |
| `firecrawl-uniranks` | UniRanks | Disable dispatch from tick |
| `uniranks-enrich-university` | UniRanks | No change (manual only) |
| `bulk-import-enrichment` | Spreadsheet | Freeze production writes |

### Functions that remain LEGACY/REFERENCE (not actively dispatched):
- `uniranks-qa-dashboard` — read-only dashboard, safe
- `uniranks-data-repair` — manual one-off, safe
- `admin-backfill-uniranks-snapshots` — already frozen for writes
- `admin-bridge-qs-to-drafts` — manual bridging tool, safe as reference

---

## 3. EXACT OFFICIAL-SITE CRAWL COMPONENTS TO REUSE

### ✅ Safe and reusable as-is:

| Component | Location | What it does | Reuse status |
|-----------|----------|-------------|--------------|
| **OSC Orchestrator** | `official-site-crawl-orchestrator/index.ts` | Job lifecycle, seeding, tick, verify, publish | ✅ Core — reuse entirely |
| **OSC Worker** | `official-site-crawl-worker/index.ts` | Domain validation, page discovery, extraction, observation storage | ✅ Core — expand extraction |
| **Job table** | `official_site_crawl_jobs` | Job state machine | ✅ Reuse |
| **Row table** | `official_site_crawl_rows` | Per-university crawl tracking | ✅ Reuse |
| **Observations table** | `official_site_observations` | Candidate facts with provenance | ✅ Reuse — expand fields |
| **Special queue** | `official_site_special_queue` | Anti-bot / failed universities | ✅ Reuse |
| **Publish batches** | `official_site_publish_batches` | Publish audit trail | ✅ Reuse |
| **Domain validation** | Worker L51-67 | BLOCKED_DOMAINS list, same-domain check | ✅ Reuse |
| **Anti-bot detection** | Worker L33-48 | Pattern-based interstitial detection | ✅ Reuse |
| **Firecrawl Map** | Worker L70-84 | URL discovery via sitemap | ✅ Reuse — expand searches |
| **Firecrawl Scrape** | Worker L87-103 | Page acquisition | ✅ Reuse |
| **Verify logic** | Orchestrator L533-671 | 7-rule verification (official source, evidence, confidence, etc.) | ✅ Reuse |
| **Publish lanes** | Orchestrator L675-782 | Lane A (low risk) / Lane B (medium) / Lane C (deferred) | ✅ Reuse |
| **Counter sync** | RPC `sync_osc_job_counters` | Job progress tracking | ✅ Reuse |
| **Row claim** | RPC `rpc_osc_claim_rows` | Atomic worker lease | ✅ Reuse |
| **Tick lease** | RPC `rpc_osc_claim_tick_lease` | Tick concurrency control | ✅ Reuse |

### ⚠️ Needs expansion (but structurally sound):

| Component | Current state | What needs to change |
|-----------|--------------|---------------------|
| **handleCreate** (orchestrator L228) | Seeds by `rank_mode` only | Add `country_codes` filter, `max_pages_per_uni` param |
| **categorizeUrl** (worker L161) | 8 categories | Add: scholarships, deadlines, student-life, media |
| **deterministicExtract** (worker L116) | 7 fields | Expand to 12 fact groups |
| **firecrawlMap** (worker L70) | Single search query | Multi-pass discovery per fact group |
| **Completeness scoring** | Not implemented | Add per-section + overall scoring |
| **Country targeting** | Not implemented | Filter universities by country_code at seed time |

---

## 4. DATA MODEL CHANGES NEEDED

### 4A. Job-level: Add country targeting + budget (ALTER `official_site_crawl_jobs`)
```sql
-- Already has: mode, total_universities, stats_json
-- Need: country_codes filter, max_pages_per_uni, completeness_target
ALTER TABLE official_site_crawl_jobs 
  ADD COLUMN IF NOT EXISTS country_codes text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_pages_per_uni integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS completeness_summary jsonb DEFAULT NULL;
```

### 4B. Row-level: Add completeness per university (ALTER `official_site_crawl_rows`)
```sql
-- Already has: coverage_result jsonb
-- coverage_result already stores per-field {attempted, found, source_url}
-- Need: structured completeness score
ALTER TABLE official_site_crawl_rows
  ADD COLUMN IF NOT EXISTS completeness_score numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS completeness_by_section jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS missing_fields text[] DEFAULT NULL;
```

### 4C. Observation-level: Already sufficient
- `official_site_observations` already has: field_name, value_raw, evidence_snippet, source_url, confidence, trace_id, fetched_at, parser_version, status, reason_code
- **No structural changes needed** — just expand the set of `field_name` values

### 4D. New fact groups to add as observation `field_name` values:
| Current | New additions |
|---------|--------------|
| description | admissions_requirements |
| logo | deadlines_intakes |
| images | scholarships_financial_aid |
| contact | language_requirements |
| housing | student_life_facilities |
| fees | media_brochures |
| programs | apply_cta_links |
|  | accreditation |
|  | campus_facilities |

---

## 5. MINIMAL SAFE PILOT ORDER

### Step 1: FREEZE (immediate — no new features)
1. Freeze `publish-qs-programmes` — add early return
2. Freeze `bulk-import-enrichment` — block universities.update()
3. Freeze `crawl-uniranks-harvest-worker` — remove universities.update()
4. Freeze `crawl-runner-tick` — disable all non-official lanes
5. Verify door5 freeze holds

### Step 2: DATA MODEL (migration)
1. Add country_codes + max_pages_per_uni to job table
2. Add completeness columns to row table

### Step 3: EXPAND WORKER (official-site-crawl-worker)
1. Add multi-pass discovery (12 keyword searches via firecrawlMap)
2. Add new extractors for each fact group
3. Add completeness scoring per university

### Step 4: EXPAND ORCHESTRATOR (official-site-crawl-orchestrator)
1. Add country_codes filter to handleCreate
2. Add completeness summary to handleStatus
3. Keep verify + publish logic unchanged

### Step 5: PILOT
1. Single country pilot (e.g., Turkey — ~50 universities)
2. Verify: observations stored, completeness scored, no production writes without verify
3. Multi-country pilot (3 countries)
4. Full rollout

---

## 6. RUNTIME VERIFICATION CHECKS

After freeze is applied, verify with these queries:

```sql
-- Q1: No new writes from UniRanks/QS sources after freeze timestamp
SELECT COUNT(*) FROM pipeline_health_events 
WHERE pipeline IN ('door2_sequential', 'qs_publish_programmes', 'crawl_runner')
AND metric IN ('bulk_publish', 'published', 'uniranks_direct_processed')
AND created_at > '[FREEZE_TIMESTAMP]'
AND value > 0;
-- Expected: 0

-- Q2: No new university updates from non-official sources
SELECT COUNT(*) FROM admin_audit
WHERE table_name = 'universities'
AND at > '[FREEZE_TIMESTAMP]'
AND action = 'update'
AND diff::text LIKE '%uniranks%';
-- Expected: 0

-- Q3: crawl-runner-tick still runs but processes 0 non-official
SELECT details_json->>'counters' FROM pipeline_health_events
WHERE pipeline = 'crawl_runner' AND metric = 'tick'
ORDER BY created_at DESC LIMIT 5;
-- Expected: uniranks_direct_processed=0, door2_processed=0, published=0

-- Q4: Official site crawl still functions
SELECT status, COUNT(*) FROM official_site_crawl_rows
WHERE created_at > '[FREEZE_TIMESTAMP]'
GROUP BY status;
-- Expected: normal distribution if OSC job is running
```

---

## 7. WHAT IS NOT IN SCOPE

- No changes to UI/admin dashboard
- No changes to search/public API
- No changes to program_draft table structure
- No changes to duplicate containment system
- No changes to website enrichment worker (separate lane)
- No broad rewrite of crawl infrastructure
- No new scale runs until pilot validates

---

## 8. HARD CONCLUSION

**Category B: Partially sound, needs targeted redesign of decision/publish layers.**

The crawl infrastructure (OSC orchestrator + worker) is structurally sound and reusable.
The contamination comes from 4 specific active write paths that bypass the OSC safety model.
Freezing those 4 paths + expanding the OSC worker's extraction coverage = complete lane.

**Execution order: Freeze first → Migrate schema → Expand worker → Pilot → Scale.**
