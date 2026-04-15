# PORTAL_WIRING_FREEZE.md — P0 Freeze (Portal)

## Scope
This freeze applies to Portal UI + Portal Edge/API code paths that:
- Emit `cards_query`
- Call Portal search endpoint
- Persist/consume session state
- Build/search program filters payload

## Non-Negotiables (Wiring Constitution)
- NO refactor/rename/move in frozen zones
- NO changing canonical keys list without explicit approval
- NO sending user-controlled locked keys to Portal
- CRM remains Source of Truth for operational data
- Stage moves via RPC only (no direct UPDATE from UI)
- Evidence is required before closure claims

## Truth Logs — Required (same request_id)
For any search that reaches Portal:

1) FINAL_GUARD_CHECK_USER request_id=XXX has_forbidden=false user_keys=[...]
2) SYSTEM_AUGMENTED        request_id=XXX added_system_keys=[tuition_basis] final_keys=[...]
3) PORTAL_REQ_FINAL        request_id=XXX final_keys=[...] program_filters_json={...}
4) PORTAL_RES              request_id=XXX status=200 ok=true ignored_filters=[] count=N

All 4 logs MUST share the same request_id.

## Locked Keys Policy
Locked keys MUST NEVER come from user input:
- tuition_basis
- partner_priority
- do_not_offer
- is_active
- instruction_language (must be aliased → instruction_languages[])

System may add mandatory keys (e.g. tuition_basis="year") but must be logged as SYSTEM_AUGMENTED.

## Regression Prevention (STOP conditions)
If diff includes any of:
- moving blocks between files
- renaming functions/variables in frozen zones
- modifying builders/guards/consent/session logic
- "cleanup", "improve", "simplify", "optimize"
→ STOP. Do not deploy.

## Monitoring Alerts (must exist)
- CRITICAL_GUARD_VIOLATION → P0
- has_forbidden=true in any guard log → P0
- PORTAL_RES ok=false (regardless of status) → P0
- PORTAL_RES status != 200 → P1
- safe_fallback > 5/hour → P1
- tuition_basis missing from SYSTEM_AUGMENTED → P1

## Truth Logs Format Freeze
The following 4 log formats are FROZEN. Any modification requires a new Evidence Pack:

```
FINAL_GUARD_CHECK_USER request_id=<RID> has_forbidden=<bool> user_keys=[...] user_filters_json={...}
SYSTEM_AUGMENTED request_id=<RID> added_system_keys=[...] final_keys=[...]
PORTAL_REQ_FINAL request_id=<RID> final_keys=[...] program_filters_json={...}
PORTAL_RES request_id=<RID> status=<int> ok=<bool> ignored_filters=[...] count=<int>
```

Changes to these formats = STOP. Must re-validate with Evidence Pack before deploy.

---

## ✅ FINAL EVIDENCE PACK (Regression Tests Passed)

### Test #1 — Normal Search
- **RID**: `ps_1769757134539_r14lg6`
- **Result**: `PORTAL_RES status=200 ok=true count=2`
- **Alerts**: 0

### Test #2 — Blocked Key (tuition_basis)
- **RID**: `ps_1769757137965_dqa4a3`
- **Result**: `422 + CRITICAL_GUARD_VIOLATION + has_forbidden=true`
- **Alerts**: 2 (P0 emitted correctly)

### Test #3 — Preserve 0/false Values
- **RID**: `ps_1769757425824_6f1wdq`
- **Result**: `fees_max:0 → max_tuition:0` preserved in PORTAL_REQ_FINAL
- **Alerts**: 0
- **Evidence**: `program_filters_json={"country_code":"TR","max_tuition":0,...}`

---

## Frozen Files & Lines

| File | Frozen Zone | Lines (approx) |
|------|-------------|----------------|
| `supabase/functions/student-portal-api/index.ts` | `case 'search_programs'` | 2005-2300 |
| `supabase/functions/student-portal-api/index.ts` | P0 Alert Emit logic | 2066-2110, 2246-2270 |
| `supabase/functions/search-programs/index.ts` | Contract V1 Guardrail | 42-82 |
| `src/lib/normalizeProgramFilters.ts` | Full file | 1-145 |

**DO NOT** modify these zones without explicit Evidence Pack approval.

---

## Kill-Switch (Emergency)

Feature Flag: `PORTAL_SEARCH_DISABLED`

If set to `true` in environment:
- `search_programs` returns HTTP 503 with `ok=false`
- Message: "البحث متوقف مؤقتًا للصيانة"

Activate during P0 incidents only.

---

## Go/No-Go Criteria

### NO-GO (Immediate Block)
- [ ] Any `CRITICAL_GUARD_VIOLATION` in last 24h
- [ ] Any `has_forbidden=true` in last 24h
- [ ] Any `PORTAL_RES ok=false` in last 1h
- [ ] Any unacknowledged critical alert (source=portal*)
- [ ] Truth Log format changed without Evidence Pack

### GO (All Must Pass)
- [x] 0 critical alerts in last 60 min
- [x] 0 has_forbidden=true in last 60 min
- [x] ≥99% PORTAL_RES ok=true
- [x] Truth Logs format unchanged
- [x] Regression Pack (3 tests) passed

---

## Last Updated
- **Date**: 2026-01-30
- **By**: Executive Order #5
- **Status**: ✅ FROZEN
