# E2E HMAC Evidence - Final Contract Lock
## Generated: 2026-01-27T09:09:45Z

---

## ✅ VERDICT: ALL 6 E2E TESTS PASSED

**Endpoint:** `https://alkhaznaqdlxygeznapt.supabase.co/functions/v1/portal-programs-search`
**Contract:** `kb_search_v1_3_final_hardened`
**Tuition Logic:** `OVERLAP`

---

## E2E-1: HMAC 200 OK (Valid CRM Payload)

**Request:**
```json
{
  "request_id": "e2e-200-ok-1769504982606",
  "contract_version": "kb_search_v1_3_final_hardened",
  "display_lang": "ar",
  "display_currency_code": "USD",
  "program_filters": {
    "country_code": "RU",
    "tuition_basis": "year",
    "tuition_usd_min": 0,
    "tuition_usd_max": 50000,
    "partner_priority": "ignore"
  },
  "paging": { "limit": 10, "offset": 0 }
}
```

**Response:**
```json
{
  "ok": true,
  "request_id": "e2e-200-ok-1769504982606",
  "meta": {
    "contract": "kb_search_v1_3_final_hardened",
    "tuition_filter_logic": "OVERLAP",
    "count": 6
  },
  "items": [...], // 6 programs
  "applied_filters": {
    "country_codes": ["RU"],
    "do_not_offer": "LOCKED_FALSE",
    "partner_priority": "ignore",
    "tuition_basis": "year",
    "tuition_usd_max": 50000,
    "tuition_usd_min": 0
  }
}
```

**Status:** `200 OK` ✅
**HMAC Nonce:** `72af7e6b...`

---

## E2E-2: HMAC 422 CONFLICTS

**Request:**
```json
{
  "request_id": "e2e-conflict-1769504984408",
  "program_filters": {
    "country_code": "RU",
    "country_codes": ["TR", "GE"]  // CONFLICT: RU ∉ [TR, GE]
  }
}
```

**Response:**
```json
{
  "ok": false,
  "error": "CONFLICTS",
  "conflicts": ["country_code/country_codes"],
  "request_id": "e2e-conflict-1769504984408"
}
```

**Status:** `422` ✅
**HMAC Nonce:** `1944cb78...`

---

## E2E-3: HMAC 422 UNKNOWN_KEYS

**Request:**
```json
{
  "request_id": "e2e-unknown-1769504984690",
  "program_filters": {
    "fake_filter_xyz": "should_be_rejected",
    "another_bad_key": 999
  }
}
```

**Response:**
```json
{
  "ok": false,
  "error": "UNKNOWN_KEYS",
  "unknown_keys": [
    "program_filters.another_bad_key",
    "program_filters.fake_filter_xyz"
  ],
  "request_id": "e2e-unknown-1769504984690"
}
```

**Status:** `422` ✅
**HMAC Nonce:** `9a08c9c5...`

---

## E2E-4: HMAC 422 UNSUPPORTED_CONTRACT_VERSION

**Request:**
```json
{
  "request_id": "e2e-bad-contract-1769504984935",
  "contract_version": "kb_search_v0_obsolete"
}
```

**Response:**
```json
{
  "ok": false,
  "error": "UNSUPPORTED_CONTRACT_VERSION",
  "supported_contracts": [
    "kb_search_v1_3_final",
    "kb_search_v1_3_final_hardened"
  ],
  "request_id": "e2e-bad-contract-1769504984935"
}
```

**Status:** `422` ✅
**HMAC Nonce:** `496fe620...`

---

## E2E-5: Full CRM 20 Keys

**Request:**
```json
{
  "request_id": "e2e-crm-20-...",
  "program_filters": {
    "country_code": "RU",
    "city": "Moscow",
    "degree_slug": "bachelor",
    "discipline_slug": "engineering",
    "study_mode": "on_campus",
    "instruction_language": "en",
    "tuition_basis": "year",
    "tuition_usd_min": 0,
    "tuition_usd_max": 50000,
    "duration_months_max": 60,
    "has_dorm": true,
    "dorm_price_monthly_usd_max": 1000,
    "monthly_living_usd_max": 2000,
    "scholarship_available": true,
    "scholarship_type": "partial",
    "partner_priority": "ignore",
    "intake_months": ["9"],
    "deadline_before": "2026-12-31"
  }
}
```

**Response:**
```json
{
  "ok": true,
  "applied_filters": {
    "city": "Moscow",
    "country_codes": ["RU"],
    "deadline_before": "2026-12-31",
    "degree_slugs": ["bachelor"],
    "discipline_slugs": ["engineering"],
    "do_not_offer": "LOCKED_FALSE",
    "dorm_price_monthly_usd_max": 1000,
    "duration_months_max": 60,
    "has_dorm": true,
    "instruction_languages": ["en"],
    "intake_months": ["9"],
    "monthly_living_usd_max": 2000,
    "partner_priority": "ignore",
    "scholarship_available": true,
    "scholarship_type": "partial",
    "study_mode": "on_campus",
    "tuition_basis": "year",
    "tuition_usd_max": 50000,
    "tuition_usd_min": 0
  },
  "defaults_applied": [],
  "blocked_filters": ["do_not_offer"]
}
```

**Status:** `200 OK` ✅

---

## E2E-6: partner_priority DEFAULT

**Request:** Missing `partner_priority`

**Response:**
```json
{
  "ok": true,
  "applied_filters": {
    "partner_priority": "ignore"
  },
  "defaults_applied": ["partner_priority"]
}
```

**Status:** `200 OK` ✅

---

## Contract Lock: ACTIVE

Supported versions:
- `kb_search_v1_3_final`
- `kb_search_v1_3_final_hardened`

Any other version → `422 UNSUPPORTED_CONTRACT_VERSION`

---

## Summary

| Test | Description | Status |
|------|-------------|--------|
| E2E-1 | Valid CRM payload → 200 OK | ✅ PASS |
| E2E-2 | Conflict detection → 422 CONFLICTS | ✅ PASS |
| E2E-3 | Unknown keys → 422 UNKNOWN_KEYS | ✅ PASS |
| E2E-4 | Bad contract version → 422 UNSUPPORTED | ✅ PASS |
| E2E-5 | Full CRM 20 keys → 200 OK | ✅ PASS |
| E2E-6 | Default partner_priority → 'ignore' | ✅ PASS |

**FINAL VERDICT: DONE ✅**
