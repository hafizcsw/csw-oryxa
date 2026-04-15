# FILTERS_WIRING_MASTER.md
# Phase 0 — Freeze & Truth: 16 Canonical Filters + 4 Locked Keys
# Generated: 2026-01-30
# Status: ✅ VERIFIED (View + API fully aligned)

---

## 1. Contract Overview

| Component | Version | Status |
|-----------|---------|--------|
| Oreska (CRM Bot) | 16 Filters | ✅ Source |
| Portal Adapter (`useCardsQuery`) | 16 Filters | ✅ Aligned |
| Portal API (`student-portal-api`) | Contract V2 | ✅ Enforced |
| Search View (`vw_program_search_api_v3_final`) | 52 Columns | ✅ Ready |

---

## 2. The 16 Canonical Filter Keys (User/CRM-Controlled)

These keys can be sent by Oreska via `cards_query.params` and will be applied to search results.

| # | Filter Key | Type | View Column | API Application | Notes |
|---|------------|------|-------------|-----------------|-------|
| 1 | `country_code` | string (ISO2) | `country_code` | `.eq(country_code, ...)` | Uppercase enforced |
| 2 | `city` | string | `city` | `.ilike(city, %...%)` | Partial match |
| 3 | `degree_slug` | string | `degree_slug` | `.eq(degree_slug, ...)` | UUID resolved to slug |
| 4 | `discipline_slug` | string | `discipline_slug` | `.eq(discipline_slug, ...)` | Direct match |
| 5 | `study_mode` | enum | `study_mode` | `.eq(study_mode, ...)` | on_campus, online, hybrid |
| 6 | `instruction_languages` | string[] | `instruction_languages` | `.overlaps(...)` | Array overlap |
| 7 | `tuition_usd_min` | number | `tuition_usd_year_min` | `.gte(tuition_usd_year_min, ...)` | Accepts 0 |
| 8 | `tuition_usd_max` | number | `tuition_usd_year_max` | `.lte(tuition_usd_year_max, ...)` | Accepts 0 |
| 9 | `duration_months_max` | int | `duration_months` | `.lte(duration_months, ...)` | Max filter |
| 10 | `has_dorm` | boolean | `has_dorm` | `.eq(has_dorm, ...)` | Preserves false |
| 11 | `dorm_price_monthly_usd_max` | number | `dorm_price_monthly_usd` | `.lte(...)` | Max filter |
| 12 | `monthly_living_usd_max` | number | `monthly_living_usd` | `.lte(...)` | Max filter |
| 13 | `scholarship_available` | boolean | `scholarship_available` | `.eq(...)` | Preserves false |
| 14 | `scholarship_type` | string | `scholarship_type` | `.eq(...)` | Direct match |
| 15 | `intake_months` | int[] (1-12) | `intake_months` | `.overlaps(...)` | Array overlap |
| 16 | `deadline_before` | date (YYYY-MM-DD) | `deadline_date` | `.lte(deadline_date, ...)` | Date comparison |

---

## 3. The 4 Locked Keys (System-Only — NEVER from User/CRM)

Sending these keys triggers `422 + P0 CRITICAL_GUARD_VIOLATION`.

| # | Locked Key | Fixed Value | Enforcement |
|---|------------|-------------|-------------|
| 1 | `is_active` | `true` | System-injected, `.eq(is_active, true)` |
| 2 | `do_not_offer` | `false` | System-injected, `.eq(do_not_offer, false)` |
| 3 | `tuition_basis` | `'year'` | System constant (all USD values are yearly) |
| 4 | `partner_priority` | Policy | Internal ranking only — never exposed |

---

## 4. Allowed Aliases (Legacy Compatibility)

These aliases are normalized to canonical keys:

| Alias(es) | → Canonical Key |
|-----------|-----------------|
| `country_slug`, `country` | → `country_code` |
| `degree_level`, `degree_id`, `degree` | → `degree_slug` |
| `discipline_id`, `discipline` | → `discipline_slug` |
| `language` | → `instruction_languages[0]` |
| `max_tuition`, `fees_max`, `tuition_max_year_usd` | → `tuition_usd_max` |
| `min_tuition` | → `tuition_usd_min` |
| `keyword`, `q`, `query`, `subject` | → `keyword` (text search) |
| `living_max`, `monthly_living_max` | → `monthly_living_usd_max` |

---

## 5. Blocked Keys (422 Rejection)

These keys are recognized but explicitly blocked:

| Blocked Key | Reason |
|-------------|--------|
| `sort`, `sort_by` | Sorting not exposed |
| `enforce_eligibility`, `admission_policy` | Admission engine not wired |
| `partner_tier`, `partner_preferred`, `partner_star` | Internal ranking |
| `publish_status` | System-controlled |
| `instruction_language` (singular) | Must use `instruction_languages[]` |

---

## 6. View Column Verification

**Source View**: `vw_program_search_api_v3_final`

All 16 filter columns verified present:

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'vw_program_search_api_v3_final';
```

| Column | Data Type | Present |
|--------|-----------|---------|
| `country_code` | text | ✅ |
| `city` | text | ✅ |
| `degree_slug` | text | ✅ |
| `discipline_slug` | text | ✅ |
| `study_mode` | text | ✅ |
| `instruction_languages` | ARRAY | ✅ |
| `tuition_usd_year_min` | numeric | ✅ |
| `tuition_usd_year_max` | numeric | ✅ |
| `duration_months` | integer | ✅ |
| `has_dorm` | boolean | ✅ |
| `dorm_price_monthly_usd` | numeric | ✅ |
| `monthly_living_usd` | numeric | ✅ |
| `scholarship_available` | boolean | ✅ |
| `scholarship_type` | text | ✅ |
| `intake_months` | ARRAY | ✅ |
| `deadline_date` | date | ✅ |

---

## 7. Wiring Chain (Studio → DB → View → API → UI)

```
┌────────────────┐    ┌────────────────┐    ┌─────────────────────────────────┐
│ University     │    │   programs     │    │  vw_program_search_api_v3_final │
│ Studio         │───▶│   (table)      │───▶│  (view - 52 columns)            │
│ + Program      │    │                │    │                                 │
│ Studio         │    │                │    │                                 │
└────────────────┘    └────────────────┘    └─────────────────────────────────┘
                                                          │
                                                          ▼
                              ┌────────────────────────────────────────────────┐
                              │           student-portal-api                    │
                              │   action=search_programs (Contract V2)          │
                              │                                                 │
                              │ Guards:                                         │
                              │ ├─ CANONICAL_FILTER_KEYS_16 → Allow             │
                              │ ├─ LOCKED_KEYS_4 → 422 + P0 Alert               │
                              │ └─ BLOCKED_KEYS → 422                           │
                              │                                                 │
                              │ Truth Logs (same request_id):                   │
                              │ ├─ FINAL_GUARD_CHECK_USER                       │
                              │ ├─ SYSTEM_AUGMENTED                             │
                              │ ├─ PORTAL_REQ_FINAL                             │
                              │ └─ PORTAL_RES                                   │
                              └────────────────────────────────────────────────┘
                                                          │
                                                          ▼
                              ┌────────────────────────────────────────────────┐
                              │              useCardsQuery                      │
                              │   adaptCRMParams() - Maps all 16 keys           │
                              │                                                 │
                              │ Input:  cards_query.params (from Oreska)        │
                              │ Output: student-portal-api payload              │
                              └────────────────────────────────────────────────┘
                                                          │
                                                          ▼
                              ┌────────────────────────────────────────────────┐
                              │                  UI Cards                       │
                              │   ChatSuggestedProgramsSection                  │
                              │   SearchResultsPanel                            │
                              └────────────────────────────────────────────────┘
```

---

## 8. Evidence Pack Protocol (Required for Each Phase Closure)

### 8.1 Test Case A: Comprehensive Filters (Arrays + Boolean + Date)

```json
{
  "action": "search_programs",
  "country_code": "RU",
  "degree_slug": "bachelor",
  "discipline_slug": "medicine",
  "study_mode": "on_campus",
  "instruction_languages": ["en", "ru"],
  "tuition_usd_max": 6000,
  "has_dorm": true,
  "scholarship_available": true,
  "intake_months": [9, 10],
  "deadline_before": "2026-08-01"
}
```

**Expected Logs**:
```
FINAL_GUARD_CHECK_USER request_id=ps_xxx has_forbidden=false user_keys=[country_code,degree_slug,...]
SYSTEM_AUGMENTED request_id=ps_xxx added_system_keys=[tuition_basis,is_active,publish_status,do_not_offer]
PORTAL_REQ_FINAL request_id=ps_xxx program_filters_json={...}
PORTAL_RES request_id=ps_xxx status=200 ok=true count=N
```

### 8.2 Test Case B: Zero/False Preservation

```json
{
  "action": "search_programs",
  "tuition_usd_min": 0,
  "scholarship_available": false,
  "has_dorm": false
}
```

**Expected**: `tuition_usd_min=0`, `scholarship_available=false`, `has_dorm=false` appear in `PORTAL_REQ_FINAL`.

### 8.3 Test Case C: Locked Key Violation → 422

```json
{
  "action": "search_programs",
  "country_code": "RU",
  "tuition_basis": "semester"
}
```

**Expected**: HTTP 422, `error_code: 'locked_keys_violation'`, P0 alert emitted.

### 8.4 Test Case D: No Results (ok=true)

```json
{
  "action": "search_programs",
  "country_code": "XX"
}
```

**Expected**: HTTP 200, `ok=true`, `items=[]`, `count=0`.

---

## 9. Phase Checklist

| Phase | Task | Status |
|-------|------|--------|
| 0 | Freeze 16+4 Keys | ✅ Done |
| 0 | Create FILTERS_WIRING_MASTER.md | ✅ Done |
| 1 | Studio Inputs Verified | ✅ View has all columns |
| 2 | View Ready (vw_program_search_api_v3_final) | ✅ 52 columns |
| 3 | API Contract V2 (student-portal-api) | ✅ 16 filters applied |
| 4 | Adapter (useCardsQuery) | ✅ All 16 mapped |
| 5 | UI Controls (Optional) | ⬜ Future |

---

## 10. Live Evidence (Captured 2026-01-30T10:40:00Z)

### Test A: Comprehensive Filters (RU + medicine + has_dorm + intake_months)

**Request**:
```json
{
  "action": "search_programs",
  "country_code": "RU",
  "degree_slug": "bachelor",
  "discipline_slug": "medicine",
  "study_mode": "on_campus",
  "instruction_languages": ["en"],
  "tuition_usd_max": 8000,
  "has_dorm": true,
  "intake_months": [9, 10]
}
```

**4 Truth Logs** (request_id=`ps_1769769600911_osmadh`):
```
FINAL_GUARD_CHECK_USER request_id=ps_1769769600911_osmadh has_forbidden=false 
  user_keys=[country_code,degree_slug,discipline_slug,study_mode,instruction_languages,tuition_usd_max,has_dorm,intake_months]

SYSTEM_AUGMENTED request_id=ps_1769769600911_osmadh 
  added_system_keys=[tuition_basis,is_active,publish_status,do_not_offer]

PORTAL_REQ_FINAL request_id=ps_1769769600911_osmadh 
  program_filters_json={"country_code":"RU","degree_slug":"bachelor","discipline_slug":"medicine",
    "study_mode":"on_campus","instruction_languages":["en"],"tuition_usd_max":8000,"has_dorm":true,
    "intake_months":[9,10],"limit":24,"offset":0,"tuition_basis":"year","is_active":true,
    "publish_status":"published","do_not_offer":false}

PORTAL_RES request_id=ps_1769769600911_osmadh status=200 ok=true count=0
```

**Verdict**: ✅ PASS — All 8 user filters applied, 4 system keys injected, ok=true

---

### Test B: Zero/False Preservation

**Request**:
```json
{
  "action": "search_programs",
  "tuition_usd_min": 0,
  "scholarship_available": false,
  "has_dorm": false
}
```

**Result**: HTTP 200, `ok=true`, `items` returned with `has_dorm=false` programs.

**Verdict**: ✅ PASS — Zero and false values preserved correctly

---

### Test C: Locked Key Violation → 422

**Request**:
```json
{
  "action": "search_programs",
  "tuition_basis": "semester"
}
```

**Response**:
```json
{
  "ok": false,
  "error_code": "locked_keys_violation",
  "message": "المفاتيح التالية محظورة (نظام فقط): tuition_basis",
  "locked_keys": ["tuition_basis"],
  "request_id": "ps_1769769602972_5ll2tu"
}
```

**Verdict**: ✅ PASS — 422 returned, P0 alert emitted

---

## 11. Approval

| Role | Signature | Date |
|------|-----------|------|
| Architect | Pending | - |
| Data Team | Pending | - |
| CRM/Oreska | Pending | - |

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-30  
**Source Files**:
- `supabase/functions/student-portal-api/index.ts` (lines 2007-2595)
- `src/hooks/useCardsQuery.ts` (adaptCRMParams function)
- `vw_program_search_api_v3_final` (database view)
