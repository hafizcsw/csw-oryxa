# HMAC Endpoint Contract Table (portal-programs-search)
Generated: 2026-01-27T07:45:00Z

## ⚠️ CRITICAL FINDING

**The HMAC endpoint has NO normalization layer.** All keys must be sent in their exact canonical form. Any mismatch = 422 rejection.

---

## Canonical Keys (ALLOWED)

| CRM Key (Proposed) | RPC Canonical Key | Type | Required | Notes |
|-------------------|-------------------|------|----------|-------|
| `tuition_basis` | `tuition_basis` | string enum | ✅ YES | year\|semester\|program_total |
| `tuition_usd_min` | `tuition_usd_min` | numeric | ✅ YES | Minimum USD |
| `tuition_usd_max` | `tuition_usd_max` | numeric | ✅ YES | Maximum USD |
| `partner_priority` | `partner_priority` | string enum | ✅ YES | prefer\|only\|ignore |
| `country_codes` | `country_codes` | text[] | ❌ NO | Array of ISO codes |
| `degree_slugs` | `degree_slugs` | text[] | ❌ NO | Array of slugs |
| `discipline_slugs` | `discipline_slugs` | text[] | ❌ NO | Array of slugs |
| `language_codes` | `language_codes` | text[] | ❌ NO | Array of lang codes |
| `has_scholarship` | `has_scholarship` | boolean | ❌ NO | true/false |
| `has_dorm` | `has_dorm` | boolean | ❌ NO | true/false |

---

## Rejected Keys (422 Error)

| CRM Key (Legacy) | Status | Reason |
|-----------------|--------|--------|
| `country_code` (singular) | ❌ REJECTED | Use `country_codes[]` |
| `degree_slug` (singular) | ❌ REJECTED | Use `degree_slugs[]` |
| `instruction_languages` | ❌ REJECTED | Use `language_codes[]` |
| `scholarship_available` | ❌ REJECTED | Use `has_scholarship` |
| `dorm_price_monthly_usd_max` | ❌ REJECTED | Use `has_dorm` (boolean only) |
| `monthly_living_usd_max` | ❌ NOT SUPPORTED | No living cost filter |
| `query` | ❌ NOT SUPPORTED | No keyword search |
| `keyword` | ❌ NOT SUPPORTED | No keyword search |

---

## Payload Shape (REQUIRED)

```json
{
  "request_id": "crm-12345",
  "display_lang": "ar",
  "display_currency_code": "USD",
  "program_filters": {
    "tuition_basis": "year",
    "tuition_usd_min": 0,
    "tuition_usd_max": 50000,
    "partner_priority": "prefer",
    "country_codes": ["RU", "TR"],
    "degree_slugs": ["bachelor"],
    "language_codes": ["en", "ru"],
    "has_scholarship": true,
    "has_dorm": true
  },
  "admission_policy": {
    "enforce_eligibility": true
  },
  "applicant_profile": {
    "curriculum": "thanaweya",
    "stream": "science"
  },
  "paging": {
    "limit": 24,
    "offset": 0
  }
}
```

---

## Policy Summary

| Policy | Behavior | Evidence |
|--------|----------|----------|
| **Unknown Keys** | 422 REJECTION | RPC Line 101-114 |
| **Aliases** | NOT SUPPORTED | No normalization layer |
| **Conflicts** | N/A | Only canonical accepted |
| **Top-level filters** | ❌ REJECTED | Must use nested objects |
| **Missing Mandatory** | 422 MISSING_DATA_FIELDS | RPC Line 76-97 |

---

## Mapping from CRM → Portal

### ❌ NOT Supported (CRM must normalize before calling):

| What CRM Might Send | What Portal Expects | Action Required |
|--------------------|---------------------|-----------------|
| `country_code: "RU"` | `country_codes: ["RU"]` | CRM must wrap in array |
| `degree_slug: "bachelor"` | `degree_slugs: ["bachelor"]` | CRM must wrap in array |
| `instruction_languages: ["en"]` | `language_codes: ["en"]` | CRM must rename key |
| `scholarship_available: true` | `has_scholarship: true` | CRM must rename key |
| `dorm_price_monthly_usd_max: 500` | `has_dorm: true` | CRM must convert to boolean |

---

## ⚠️ FIX REQUIRED

For CRM-Portal integration to work, **one of these must happen**:

### Option A: CRM normalizes before calling
CRM transforms its internal keys to match Portal canonical keys.

### Option B: Portal adds normalization layer
Add a mapping layer in `portal-programs-search/index.ts` to:
1. Convert singular → plural (country_code → country_codes)
2. Rename legacy keys (instruction_languages → language_codes)
3. Convert price filters to booleans (dorm_price_monthly_usd_max → has_dorm)
4. Report normalized_from in response

**Current Status: Neither option is implemented = INTEGRATION WILL FAIL**
