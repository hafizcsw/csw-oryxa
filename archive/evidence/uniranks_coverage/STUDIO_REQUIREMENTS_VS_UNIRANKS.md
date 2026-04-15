# 📋 Studio Requirements vs UniRanks Coverage — Deep Analysis
# Generated: 2026-02-18
# Source: Code forensics + DB schema + live data queries

---

## 📊 TABLE 1: Studio Requirements (University)

All fields required by University Studio, University Card, University Details, and Search Views.

| # | Field (Column) | Required? | Source Table/View | Validation | Used In (UI) | Notes |
|---|---------------|-----------|-------------------|------------|--------------|-------|
| **Core Identity** |
| 1 | `id` | ✅ REQUIRED | `universities.id` | uuid, NOT NULL, auto-gen | All pages | PK |
| 2 | `name` (name_ar) | ✅ REQUIRED | `universities.name` | NOT NULL, text | Studio, Card, Details | Arabic name |
| 3 | `name_en` | ⚠️ Important | `universities.name_en` | nullable text | Card, Details, i18n | English name |
| 4 | `slug` | ⚠️ Important | `universities.slug` | nullable, URL-safe | SEO, routing | Auto-generated |
| 5 | `country_id` | ✅ CRITICAL | `universities.country_id` | uuid FK → countries | Studio (checklist), all views | **INNER JOIN gate** — null = invisible |
| 6 | `country_code` | ✅ CRITICAL | `universities.country_code` | ISO 2-char, regex validated | Filters, search | Must match countries table |
| 7 | `city` | ⚠️ Important | `universities.city` | nullable text | Card, Details, filters | Location display |
| **Media** |
| 8 | `logo_url` | ⚠️ Important | `universities.logo_url` | nullable URL | Card, Details, Studio checklist | Fallback: first letter |
| 9 | `hero_image_url` | Optional | `universities.hero_image_url` | nullable URL | Details hero section | Campus cover photo |
| 10 | `main_image_url` | Optional | `universities.main_image_url` | nullable URL | Card image, Details fallback | Primary image |
| **Financial** |
| 11 | `annual_fees` | ⚠️ Important | `universities.annual_fees` | nullable numeric | Card (fees display) | vw_university_card |
| 12 | `tuition_min` | Optional | `universities.tuition_min` | nullable numeric | Studio only | Range display |
| 13 | `tuition_max` | Optional | `universities.tuition_max` | nullable numeric | Studio only | Range display |
| 14 | `monthly_living` | Optional | `universities.monthly_living` | nullable numeric, USD only | Card, filters | **USD ONLY enforced** |
| **Housing** |
| 15 | `has_dorm` | Optional | `universities.has_dorm` | boolean, default false | Studio, filters | Boolean flag |
| 16 | `dorm_price_monthly_local` | Optional | `universities.dorm_price_monthly_local` | nullable numeric | Studio | Local currency |
| 17 | `dorm_currency_code` | Optional | `universities.dorm_currency_code` | nullable 3-char | Studio | e.g. TRY, USD |
| **Rankings** |
| 18 | `ranking` | Optional | `universities.ranking` | nullable integer | Card badge, Details | Legacy single ranking |
| 19 | `cwur_world_rank` | Optional | `universities.cwur_world_rank` | nullable integer | Details (CWUR section) | CWUR specific |
| 20 | `cwur_national_rank` | Optional | `universities.cwur_national_rank` | nullable integer | Details | CWUR specific |
| 21 | `cwur_score` | Optional | `universities.cwur_score` | nullable numeric | Details | CWUR specific |
| **Status** |
| 22 | `is_active` | ✅ REQUIRED | `universities.is_active` | boolean, default true | Visibility gate | false = hidden from search |
| 23 | `publish_status` | Optional | referenced in programs | enum text | Studio | draft/published |
| 24 | `show_in_home` | Optional | `universities.show_in_home` | boolean, default false | Homepage slider | |
| 25 | `display_order` | Optional | `universities.display_order` | integer, default 100 | Sorting | |
| **SEO** |
| 26 | `seo_title` | Optional | `universities.seo_title` | nullable text | SEO Head | Studio checklist |
| 27 | `seo_description` | Optional | `universities.seo_description` | nullable text | SEO Head | |
| 28 | `seo_canonical_url` | Optional | `universities.seo_canonical_url` | nullable text | SEO | |
| 29 | `seo_index` | Optional | `universities.seo_index` | boolean, default true | SEO | |
| **Description** |
| 30 | `description` | ⚠️ Important | `universities.description` | nullable text | Details, Studio checklist | About section |
| 31 | `website` | Optional | `universities.website` | nullable URL | Details (external link) | |
| **Partner/Guidance** |
| 32 | `partner_preferred` | Optional | `universities.partner_preferred` | boolean, default false | Search prioritization | Server-side |
| **Crawl/Import** |
| 33 | `uniranks_slug` | Internal | `universities.uniranks_slug` | nullable text | UniRanks panel | Import tracking |
| 34 | `uniranks_profile_url` | Internal | `universities.uniranks_profile_url` | nullable text | UniRanks panel | Source link |

---

## 📊 TABLE 2: Filter Contract (University + Programs)

### University-Level Filters (via `vw_university_card`)

| # | Filter Key | Type | Source Column(s) | Requires JOIN? | Null Fallback | Impact if Missing |
|---|-----------|------|-----------------|----------------|---------------|-------------------|
| 1 | `country_slug` | term (exact) | `countries.slug` via `universities.country_id` | ✅ INNER JOIN countries | **NO** — INNER JOIN = invisible | 🔴 University disappears from search |
| 2 | `q_name` | text (ilike) | `universities.name` | No | Shows all | No impact |
| 3 | `fees_max` | range (lte) | `universities.annual_fees` | No | Not filtered | University shows but no fee display |
| 4 | `sort` | enum | `ranking`, `annual_fees`, `name` | No | Default: popularity | Sort changes |
| 5 | `degree_id` | array contains | `vw_university_card.degree_ids[]` | Aggregated from programs | Skipped | Not filtered by degree |

### Program-Level Filters (HARD16 via `vw_program_search_api_v3_final`)

| # | Filter Key | Type | Source Column(s) | Requires JOIN? | Null Fallback | Impact if Missing |
|---|-----------|------|-----------------|----------------|---------------|-------------------|
| 1 | `country_code` | exact | `v3.country_code` → `countries.country_code` | INNER JOIN | **NO** | 🔴 Program invisible |
| 2 | `city` | exact | `v3.city` ← `universities.city` | No | Not filtered | Program visible, not filterable |
| 3 | `degree_slug` | exact | `v3.degree_slug` ← `programs.degree_slug` | No | Not filtered | |
| 4 | `discipline_slug` | exact | `v3.discipline_slug` ← `programs.discipline_slug` | No | Not filtered | |
| 5 | `study_mode` | exact | `v3.study_mode` ← `programs.study_mode` | No | Not filtered | |
| 6 | `instruction_languages` | contains_any | `v3.instruction_languages[]` ← `programs` | No | Not filtered | |
| 7 | `tuition_usd_min` | range_min | `v3.tuition_usd_year_max` | No | Not filtered | |
| 8 | `tuition_usd_max` | range_max | `v3.tuition_usd_year_min` | No | Not filtered | |
| 9 | `duration_months_max` | range_max | `v3.duration_months` | No | Not filtered | |
| 10 | `has_dorm` | boolean | `v3.has_dorm` | No | NULL ≠ true | Won't match dorm filter |
| 11 | `dorm_price_monthly_usd_max` | range_max | `v3.dorm_price_monthly_usd` | No | Not filtered | |
| 12 | `monthly_living_usd_max` | range_max | `v3.monthly_living_usd` | No | Not filtered | |
| 13 | `scholarship_available` | boolean | `v3.scholarship_available` | No | NULL ≠ true | Won't match scholarship filter |
| 14 | `scholarship_type` | exact | `v3.scholarship_type` | No | Not filtered | |
| 15 | `intake_months` | contains_any | `v3.intake_months[]` | No | Not filtered | |
| 16 | `deadline_before` | date_before | `v3.deadline_date` | No | Not filtered | |

### Ranking Filters (RANK10 via `institution_rankings` JOIN)

| # | Filter Key | Type | Source Column(s) | Requires JOIN? | Impact if Missing |
|---|-----------|------|-----------------|----------------|-------------------|
| 1 | `institution_id` | exact | `institution_rankings.institution_id` | ✅ | Not filterable by institution |
| 2 | `ranking_system` | exact | `institution_rankings.ranking_system` | ✅ | Required context for thresholds |
| 3 | `ranking_year` | exact | `institution_rankings.ranking_year` | ✅ | Required context for thresholds |
| 4 | `world_rank_max` | range_max | `institution_rankings.world_rank` | ✅ | Not filterable |
| 5 | `national_rank_max` | range_max | `institution_rankings.national_rank` | ✅ | Not filterable |
| 6 | `overall_score_min` | range_min | `institution_rankings.overall_score` | ✅ | Not filterable |
| 7 | `teaching_score_min` | range_min | `institution_rankings.teaching_score` | ✅ | Not filterable |
| 8 | `employability_score_min` | range_min | `institution_rankings.employability_score` | ✅ | Not filterable |
| 9 | `academic_reputation_score_min` | range_min | `institution_rankings.academic_reputation_score` | ✅ | Not filterable |
| 10 | `research_score_min` | range_min | `institution_rankings.research_score` | ✅ | Not filterable |

---

## 📊 TABLE 3: Coverage Matrix — UniRanks vs Our Requirements (🏆 الأهم)

### Data from live DB query (29,385 universities with uniranks_slug):

| # | Our Requirement | Provided by UniRanks? | Extraction Path | Confidence | Live Coverage (of 29,385) | Gap Handling |
|---|----------------|----------------------|-----------------|------------|--------------------------|--------------|
| **✅ COVERED** |
| 1 | `name_en` | ✅ YES | Ranking page (listing name) | Confirmed HTML | **99.2%** (29,153) | Auto-populated from uniranks_name |
| 2 | `logo_url` | ✅ YES | Ranking page (thumbnail) | Confirmed HTML | **99.98%** (29,380) | Scraped from listing |
| 3 | `country_code` | ✅ YES | Profile page (flag icon ISO) | Confirmed HTML (regex) | **15.6%** (4,580) | Backfill running — extracting from flag SVG |
| 4 | `ranking` (world) | ✅ YES | Ranking page (rank_position) | Confirmed HTML | **100%** (29,385) | rank_position field |
| 5 | `uniranks_slug` | ✅ YES | Ranking page URL | Confirmed HTML | **100%** | Primary identifier |
| 6 | `uniranks_profile_url` | ✅ YES | Constructed from slug | Confirmed | **100%** | Auto-constructed |
| **⚠️ PARTIALLY COVERED** |
| 7 | `city` | ⚠️ PARTIAL | Profile page (location section) | JS/API suspected | **0.01%** (4) | Needs profile extraction — mostly empty |
| 8 | `description` | ⚠️ PARTIAL | Profile page (about section) | JS/API suspected | **0.03%** (10) | Needs profile extraction |
| 9 | `website` | ⚠️ PARTIAL | Profile page (official link) | JS/API suspected | **0.003%** (1) | Best-effort, non-blocking |
| **❌ NOT AVAILABLE FROM UNIRANKS** |
| 10 | `name` (Arabic) | ❌ NO | Not available | N/A | **0%** | Manual / AI translation needed |
| 11 | `hero_image_url` | ❌ NO | Not available | N/A | **0%** | Manual upload or campus photo API |
| 12 | `main_image_url` | ❌ NO | Not available | N/A | **0.01%** (4) | Manual upload |
| 13 | `annual_fees` | ❌ NO | UniRanks has tuition data (JS) | JS suspected, not extracted | **0%** | Needs JS rendering extraction |
| 14 | `tuition_min` / `tuition_max` | ❌ NO | Not in current extraction | N/A | **0%** | Needs program-level data |
| 15 | `monthly_living` | ❌ NO | Not available on UniRanks | N/A | **0.01%** (4) | External data source needed |
| 16 | `has_dorm` | ❌ NO | Not available on UniRanks | N/A | **0%** | Manual or external source |
| 17 | `dorm_price_monthly_*` | ❌ NO | Not available | N/A | **0%** | Manual or external source |
| 18 | `scholarship_available` | ❌ NO | Not available | N/A | **0%** | Per-program, needs other sources |
| 19 | `intake_months` | ❌ NO | Not available | N/A | **0%** | Per-program, needs other sources |
| 20 | `deadline_date` | ❌ NO | Not available | N/A | **0%** | Per-program, needs other sources |
| 21 | `instruction_languages` | ❌ NO | Not available | N/A | **0%** | Per-program, needs other sources |
| 22 | `degree_slug` | ❌ NO | Not available at uni level | N/A | **0%** | Per-program |
| 23 | `discipline_slug` | ❌ NO | Not available at uni level | N/A | **0%** | Per-program |
| 24 | `study_mode` | ❌ NO | Not available | N/A | **0%** | Per-program |
| 25 | `duration_months` | ❌ NO | Not available at uni level | N/A | **0%** | Per-program |
| 26 | `seo_*` fields | ❌ NO | Not applicable | N/A | **0%** | Auto-generated from name+country |
| 27 | `partner_preferred` | ❌ NO | Internal business flag | N/A | N/A | Manual assignment |
| 28 | Programs data | ❌ NO | UniRanks has program listings | JS/API needed | **0%** | Needs Door 2 Stage C extraction |

---

## 📁 TABLE 4: Evidence — Code Paths & Contracts

| What | File Path | Description |
|------|----------|-------------|
| Studio Schema (UniversityData) | `src/pages/admin/UniversityStudioPage.tsx:31-58` | TypeScript interface with all Studio fields |
| BasicInfoTab Fields | `src/components/admin/university/tabs/BasicInfoTab.tsx:11-30` | All editable fields |
| University Card (Public UI) | `src/components/UniversityCard.tsx:11-28` | University interface for card display |
| University Details (Public) | `src/pages/UniversityDetails.tsx` | Full detail page fields consumed |
| Search API (vw_university_card) | `src/lib/search-api.ts:44-48` | Direct query from view |
| Filter Contract (HARD16) | `src/lib/chat/contracts/filters.ts:40-66` | 16 canonical filter keys |
| Filter Contract (RANK10) | `src/lib/chat/contracts/filters.ts:74-85` | 10 ranking filter keys |
| Filter Wiring Map | `src/lib/chat/contracts/filter_map.ts:55-217` | Entity targets & operators |
| Search View (v3_final) | DB View: `vw_program_search_api_v3_final` | 59 columns, program-centric |
| University Card View | DB View: `vw_university_card` | 17 columns, university-centric |
| University Details View | DB View: `vw_university_details` | 17 columns, with aggregates |
| UniRanks Catalog Table | DB Table: `uniranks_university_catalog` | 15 columns, raw import data |
| Country JOIN (visibility gate) | `vw_university_card` INNER JOIN `countries` | Missing country_id = invisible |
| RPC Column Checks | `supabase/migrations/20260126171122_*.sql:254-296` | kb_require_column assertions |

---

## 🎯 TABLE 5: Decision — Can UniRanks (Door 2) Cover 80%+ of Studio?

### Answer: ❌ NO — UniRanks covers approximately **25-30%** of Studio requirements.

### Top 10 Gaps Preventing Studio Launch:

| # | Gap | Severity | Why It Blocks | Resolution Path |
|---|-----|----------|--------------|-----------------|
| 1 | **city** (0.01% coverage) | 🔴 CRITICAL | Card display shows "—, Country" — ugly UX. Filter by city broken | Profile extraction (Stage B+) or external geocoding |
| 2 | **Arabic name** (0%) | 🔴 CRITICAL | Primary language of platform. Cards show English only | AI translation batch (GPT/Gemini) or manual |
| 3 | **description** (0.03%) | 🟡 HIGH | Details page "About" section empty for 99.97% | Profile extraction or AI generation |
| 4 | **annual_fees / tuition** (0%) | 🟡 HIGH | Card shows "—" for fees. Users can't compare costs | UniRanks has this data (JS-rendered) — needs Firecrawl JS mode |
| 5 | **hero_image / main_image** (0%) | 🟡 HIGH | Cards have no campus photo — generic placeholder | External image APIs or manual upload |
| 6 | **Programs data** (0%) | 🔴 CRITICAL | Zero programs = university doesn't appear in program search (v3_final) | Door 2 Stage C: program list extraction from UniRanks |
| 7 | **monthly_living** (0%) | 🟡 MEDIUM | Living cost filter broken | External data (Numbeo API / city_enrichment table) |
| 8 | **has_dorm / dorm_price** (0%) | 🟡 MEDIUM | Dorm filter returns 0 results for UniRanks unis | Per-university research or external source |
| 9 | **website** (0.003%) | 🟡 MEDIUM | No external link on details page | Profile extraction (best-effort) |
| 10 | **SEO fields** (0%) | 🟢 LOW | Can be auto-generated from name + country | Batch script: `seo_title = name_en + " - " + country` |

### Summary Score:

| Category | Fields | Covered | Coverage |
|----------|--------|---------|----------|
| Core Identity (name, slug, country) | 7 | 4 | 57% |
| Media (logo, hero, main) | 3 | 1 | 33% |
| Financial (fees, tuition, living) | 4 | 0 | 0% |
| Housing (dorm) | 3 | 0 | 0% |
| Rankings | 4 | 2 | 50% |
| Status/Config | 4 | 0 | 0% (internal) |
| SEO | 4 | 0 | 0% (auto-gen) |
| Description/Website | 2 | 0 | 0% |
| **Programs (entire pipeline)** | **~15 fields** | **0** | **0%** |
| **TOTAL** | **~46** | **~7** | **~15%** |

### 🏁 Final Recommendation:

UniRanks (Door 2) هو **باب اكتشاف** فقط — يكتشف الجامعات ويعطيك الاسم + الشعار + البلد + الترتيب. لكنه **لا يغطي** الحقول التشغيلية المطلوبة لعرض كارت جامعة مكتمل أو تشغيل الفلاتر.

**الخطوة التالية المطلوبة:**
1. ✅ أكمل Backfill (country_code) — جاري حالياً
2. 🔜 Stage B+: استخراج city + description + website من صفحات البروفايل  
3. 🔜 Stage C: استخراج Programs من UniRanks (الأهم لتشغيل البحث)
4. 🔜 Batch AI: ترجمة الأسماء للعربية
5. 🔜 External: annual_fees من بيانات UniRanks (JS rendering) أو مصدر خارجي
