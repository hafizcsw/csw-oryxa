# PORTAL FORENSIC AUDIT — PHASE 2 EVIDENCE
# Generated: 2026-01-27T08:00:00Z

================================================================================
## 1) ISOLATION PROOF — CONTRACT_V1 Guards
================================================================================

### Grep Results: CONTRACT_V1_ALLOWED_KEYS / CONTRACT_V1_BLOCKED_KEYS

**Found in 2 files ONLY:**

| File | Lines |
|------|-------|
| `supabase/functions/search-programs/index.ts` | 42-70 |
| `supabase/functions/student-portal-api/index.ts` | 2009-2056 |

**NOT found in:**
- ❌ `supabase/functions/portal-programs-search/index.ts`
- ❌ Any `_shared/` modules
- ❌ Any other edge functions

### Conclusion: ✅ ISOLATED
The CONTRACT_V1 guardrails are enforced ONLY on public-facing endpoints.
The HMAC endpoint (portal-programs-search) has NO such guards—it passes payload directly to RPC.

================================================================================
## 2) DB WIRING PROOF — Data Source per Endpoint
================================================================================

### A) search-programs (Public)
**Data Source:** `vw_program_search_api_v3_final` (view)
**Code Pointer:** Response includes `"sot_view": "vw_program_search_api_v3_final"`
**Evidence:** Runtime test showed:
```json
{
  "sot_view": "vw_program_search_api_v3_final",
  "contract_version": "website_v1_public"
}
```

### B) portal-programs-search (HMAC Bot)
**Data Source:** RPC `rpc_kb_programs_search_v1_3_final`
**Code Pointer:** `supabase/functions/portal-programs-search/index.ts` line 191:
```typescript
const { data: rpcResult, error: rpcError } = await supabase
  .rpc('rpc_kb_programs_search_v1_3_final', { payload: body });
```

**RPC internally uses:** `vw_program_search_api_v3_final` (from migration files)

### C) Do they share the same view?
✅ YES — Both ultimately query `vw_program_search_api_v3_final`
- Public endpoint queries view directly with filters
- HMAC endpoint calls RPC which queries same view

================================================================================
## 3) TUITION BUG PROOF — Column Mismatch
================================================================================

### Where is `tuition_usd_year` mentioned?

**File:** `evidence/portal_phase2/VIEW_SCHEMA_BUG.md` (previously documented)

**Root Cause:**
The RPC `rpc_kb_programs_search_v1_3_final` was written assuming columns:
- `v.tuition_usd_year`
- `v.tuition_usd_semester`  
- `v.tuition_usd_program_total`

**But the actual view has:**
- `tuition_usd_year_min` / `tuition_usd_year_max`
- `tuition_usd_semester_min` / `tuition_usd_semester_max`
- `tuition_usd_program_total_min` / `tuition_usd_program_total_max`

### Which endpoints does the bug affect?

| Endpoint | Affected? | Reason |
|----------|-----------|--------|
| search-programs (public) | ❌ NO | Uses `tuition_usd_year_max` directly, no basis selection |
| portal-programs-search (HMAC) | ✅ YES | RPC uses `CASE v_tuition_basis WHEN 'year' THEN v.tuition_usd_year` |

### Minimal Payload Test:

**Valid payload that would FAIL on HMAC:**
```json
{
  "request_id": "tuition_bug_test",
  "display_lang": "ar",
  "display_currency_code": "USD",
  "program_filters": {
    "tuition_basis": "year",
    "tuition_usd_max": 15000,
    "country_codes": ["RU"]
  },
  "paging": {"limit": 5}
}
```
**Expected Error:** `42703: column v.tuition_usd_year does not exist`

================================================================================
## 4) RUNTIME LOGS — 3 Evidence Samples
================================================================================

### Log 1: Public Request (SUCCESS) — applied_filters visible

**request_id:** `audit_public_001`
**Endpoint:** `search-programs`
**Status:** `200 OK`
**Response:**
```json
{
  "ok": true,
  "applied_filters": {
    "country_code": "RU",
    "max_tuition": 15000,
    "limit": 2,
    "offset": 0
  },
  "normalized_from": {},
  "ignored_filters": [],
  "count": 0,
  "sot_view": "vw_program_search_api_v3_final",
  "contract_version": "website_v1_public"
}
```

### Log 2: HMAC Request (MISSING_AUTH) — No HMAC headers

**request_id:** `audit_hmac_key_mismatch`
**Endpoint:** `portal-programs-search`
**Status:** `401 Unauthorized`
**Response:**
```json
{
  "ok": false,
  "request_id": "019bfe75-7a04-7682-bfbc-9d27b1eefbdf",
  "error": "unauthorized: HMAC signature required (service-to-service only)",
  "code": "MISSING_AUTH",
  "meta": {
    "contract": "kb_search_v1_3_final",
    "ts": "2026-01-27T07:57:50.573Z"
  }
}
```

### Log 3: HMAC Request (EXPIRED TIMESTAMP) — Invalid signature/timestamp

**request_id:** `audit_hmac_schema_bug`
**Endpoint:** `portal-programs-search`
**Status:** `401 Unauthorized`
**Headers sent:** `x-ts: 1737654321` (old timestamp)
**Response:**
```json
{
  "ok": false,
  "request_id": "019bfe75-82ec-70e6-b733-2dd15f765c57",
  "error": "Request expired (timestamp >5min old)",
  "code": "HMAC_FAILED",
  "meta": {
    "contract": "kb_search_v1_3_final",
    "ts": "2026-01-27T07:57:52.844Z"
  }
}
```

================================================================================
## SUMMARY VERDICT
================================================================================

| Check | Status | Evidence |
|-------|--------|----------|
| CONTRACT_V1 Isolation | ✅ PASS | Grep shows guards only in search-programs + student-portal-api |
| DB Wiring Consistency | ✅ PASS | Both endpoints use vw_program_search_api_v3_final |
| Tuition Bug Scope | 🔴 HMAC ONLY | Public uses *_max columns; HMAC RPC uses wrong column names |
| HMAC Auth Enforcement | ✅ PASS | 401 returned for missing/invalid signatures |

### BLOCKING ISSUE:
The `tuition_usd_year` column mismatch will cause ALL HMAC requests with `tuition_basis` filter to fail at runtime with a SQL error.

**FIX REQUIRED:** Update RPC to use `tuition_usd_year_min`/`tuition_usd_year_max` instead of `tuition_usd_year`.
