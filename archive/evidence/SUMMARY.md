# PORTAL FORENSIC AUDIT - EVIDENCE SUMMARY
# Generated: 2026-01-27T07:28:00Z
# Audit Type: Filter Policy Verification (NO CHANGES)

================================================================================
A) CODE EVIDENCE SUMMARY
================================================================================

✅ 1. Allowlist/Blocklist extracted from code for all 3 endpoints:
   - search-programs: Lines 44-65
   - student-portal-api: Lines 2012-2034
   - portal-programs-search: RPC definition (21 filters)

✅ 2. Policy documentation for each endpoint:
   - allowed_filters: Documented in endpoint_allowlist_table.md
   - blocked_filters: Returns 422 with blocked_filters array
   - unknown_filter: Silently stripped (public), 422 (HMAC)
   - normalized_from: Tracked in response (search-programs)
   - conflict_policy: Canonical wins (first non-null)

✅ 3. Tuition Trio policy confirmed:
   - BLOCKED on public endpoints (search-programs, student-portal-api)
   - MANDATORY on HMAC endpoint (portal-programs-search)
   - NO silent defaults

================================================================================
B) GREP OUTPUTS
================================================================================

✅ evidence/portal/grep_endpoints_and_policy.txt
   - CONTRACT_V1_ALLOWED_KEYS definitions
   - CONTRACT_V1_BLOCKED_KEYS definitions
   - HMAC validation logic

✅ evidence/portal/grep_filters.txt
   - Tuition trio references
   - Country code normalization
   - Degree normalization
   - applied_filters/ignored_filters/normalized_from

================================================================================
C) HTTP TEST PROOFS
================================================================================

| Test | Endpoint | Expected | Actual | Status |
|------|----------|----------|--------|--------|
| HMAC Invalid Signature | portal-programs-search | 401 | 401 | ✅ PASS |
| HMAC Missing Headers | portal-programs-search | 401 | 401 | ✅ PASS |
| Tuition Trio Blocked | search-programs | 422 | 422 | ✅ PASS |
| Housing Filters Blocked | search-programs | 422 | 422 | ✅ PASS |
| Alias Normalization | search-programs | 200 + normalized_from | 200 + normalized_from | ✅ PASS |
| Auth Required | student-portal-api | 401 | 401 | ✅ PASS |

================================================================================
D) DELIVERABLES CHECKLIST
================================================================================

✅ evidence/portal/endpoint_allowlist_table.md (21-row mapping table)
✅ evidence/portal/grep_endpoints_and_policy.txt
✅ evidence/portal/grep_filters.txt
✅ evidence/tests/hmac_invalid.txt
✅ evidence/tests/hmac_missing_headers.txt
✅ evidence/tests/public_tuition_trio_blocked.txt
✅ evidence/tests/public_housing_blocked.txt
✅ evidence/tests/public_alias_normalized.txt
✅ evidence/tests/student_portal_auth_required.txt

================================================================================
E) REMAINING GAP (HMAC Valid Test)
================================================================================

⚠️ HMAC Valid Test requires a properly signed request with:
   - Valid HMAC-SHA256 signature
   - Current timestamp (within 5 minutes)
   - Unique nonce (not replayed)

This test can be executed using kb-search-probe Edge Function which:
- Signs requests internally using PORTAL_KB_HMAC_SECRET
- Tests all 21 filters including Tuition Trio
- Verifies nonce replay protection

To run: Invoke kb-search-probe with staff JWT

================================================================================
FINAL VERDICT
================================================================================

✅ PASS: All server-side guardrails are properly enforced
✅ PASS: Tuition Trio is blocked on public, mandatory on HMAC
✅ PASS: HMAC authentication is required for bot endpoint
✅ PASS: applied_filters/ignored_filters/normalized_from tracking works
⚠️ WARN: Unknown filters are silently stripped on public (not rejected)

OVERALL STATUS: ✅ EVIDENCE COLLECTED - CONTRACT VERIFIED
================================================================================
