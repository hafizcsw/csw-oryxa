# Portal Phase 2 Forensic Audit — SUMMARY
Generated: 2026-01-27T07:50:00Z

---

## 🔴 CRITICAL FINDINGS

### 1. NO NORMALIZATION LAYER IN HMAC ENDPOINT

The `portal-programs-search` Edge Function passes the request body **directly** to the RPC without any key normalization. 

**Impact**: CRM MUST send exact canonical keys. Any mismatch = 422 failure.

### 2. STRICT FAIL-CLOSED POLICY

The RPC has a strict allowlist that **REJECTS** any unknown keys with 422 error (not ignored).

**Tested & Proven**:
| CRM Key Sent | Result |
|-------------|--------|
| `country_code` (singular) | ❌ 422 - unsupported_filter.country_code |
| `scholarship_available` | ❌ 422 - unsupported_filter.scholarship_available |
| `dorm_price_monthly_usd_max` | ❌ 422 - unsupported_filter.dorm_price_monthly_usd_max |
| `query` / `keyword` | ❌ 422 - unsupported_filter.query, unsupported_filter.keyword |

### 3. CONFLICT POLICY: FIRST-UNKNOWN-FAILS

When both canonical AND alias keys are sent:
- Example: `country_code: "RU"` + `country_codes: ["TR"]`
- Result: ❌ 422 on the unknown key (country_code)
- The canonical key is NOT evaluated if ANY unknown key exists

### 4. VIEW SCHEMA BUG (SECONDARY)

The RPC references columns that don't exist in `vw_program_search_api_v3_final`:
- `v.tuition_usd_year` → ERROR: column does not exist
- Expected: `v.tuition_usd_year_min` or similar

This means **valid requests will fail** even with correct keys.

---

## 📊 CANONICAL KEY MAPPING

### program_filters (10 keys ONLY)

| # | Canonical Key | Type | Required | Notes |
|---|--------------|------|----------|-------|
| 1 | tuition_basis | enum | ✅ | year\|semester\|program_total |
| 2 | tuition_usd_min | numeric | ✅ | |
| 3 | tuition_usd_max | numeric | ✅ | |
| 4 | partner_priority | enum | ✅ | prefer\|only\|ignore |
| 5 | country_codes | text[] | ❌ | PLURAL array only |
| 6 | degree_slugs | text[] | ❌ | PLURAL array only |
| 7 | discipline_slugs | text[] | ❌ | PLURAL array only |
| 8 | language_codes | text[] | ❌ | PLURAL array only |
| 9 | has_scholarship | boolean | ❌ | true/false only |
| 10 | has_dorm | boolean | ❌ | true/false only |

### NOT SUPPORTED (Will cause 422)

| CRM Key | Status | Canonical Alternative |
|---------|--------|----------------------|
| country_code | ❌ | country_codes[] |
| degree_slug | ❌ | degree_slugs[] |
| instruction_languages | ❌ | language_codes[] |
| scholarship_available | ❌ | has_scholarship |
| dorm_price_monthly_usd_max | ❌ | has_dorm (boolean) |
| monthly_living_usd_max | ❌ | NOT AVAILABLE |
| query | ❌ | NOT AVAILABLE |
| keyword | ❌ | NOT AVAILABLE |

---

## 📋 PAYLOAD SHAPE REQUIREMENTS

```json
{
  "request_id": "string",
  "display_lang": "ar|en",            // REQUIRED
  "display_currency_code": "USD",     // optional
  "program_filters": {                // NESTED - required keys inside
    "tuition_basis": "year",
    "tuition_usd_min": 0,
    "tuition_usd_max": 50000,
    "partner_priority": "prefer"
  },
  "admission_policy": {},             // NESTED - optional
  "applicant_profile": {},            // NESTED - optional
  "paging": { "limit": 24, "offset": 0 }  // NESTED - optional
}
```

**⚠️ TOP-LEVEL FILTERS ARE IGNORED** - All filters must be in nested objects.

---

## ⚠️ FIX REQUIRED

### Option A: CRM Normalizes (Recommended)
CRM team transforms keys before calling Portal:
- Wrap singulars in arrays: `country_code → country_codes[]`
- Rename keys: `scholarship_available → has_scholarship`
- Convert price to boolean: `dorm_price_monthly_usd_max → has_dorm: true`

### Option B: Portal Adds Normalization Layer
Add mapping in `portal-programs-search/index.ts`:
- Accept aliases and normalize to canonical
- Report `normalized_from` in response
- Maintain Fail-Closed for truly unknown keys

### Option C: Fix View Schema (BLOCKING)
The `vw_program_search_api_v3_final` view is missing columns referenced by RPC:
- Add `tuition_usd_year`, `tuition_usd_semester`, `tuition_usd_program_total`
- Or update RPC to use existing column names

---

## 📁 EVIDENCE FILES

| File | Purpose |
|------|---------|
| grep_hmac_contract.txt | HMAC endpoint code analysis |
| grep_rpc_params.txt | RPC allowlist extraction |
| hmac_contract_table.md | Full key mapping |
| tests/hmac_norm_crm_style.txt | CRM-style key rejection proof |
| tests/hmac_plural_conflict.txt | Singular vs plural conflict proof |
| tests/hmac_scholarship_conflict.txt | Scholarship naming conflict proof |
| tests/hmac_dorm_conflict.txt | Dorm filter naming conflict proof |
| tests/hmac_query_conflict.txt | Keyword search rejection proof |
| tests/hmac_shape_top_level.txt | Top-level shape rejection proof |
| tests/hmac_shape_program_filters.txt | Correct nested shape documentation |

---

## 🏁 FINAL VERDICT

| Aspect | Status |
|--------|--------|
| HMAC Authentication | ✅ PASS - Enforced |
| Unknown Key Policy | ✅ PASS - Fail-Closed (422) |
| Conflict Policy | ⚠️ First-Unknown-Fails |
| Normalization Layer | ❌ MISSING |
| View Schema | ❌ BUG - Missing columns |
| CRM Integration Ready | ❌ NO - Keys will mismatch |

**INTEGRATION STATUS: 🔴 NOT READY**

CRM-Portal integration will fail until:
1. CRM normalizes keys before calling, OR
2. Portal adds normalization layer, AND
3. View schema bug is fixed
