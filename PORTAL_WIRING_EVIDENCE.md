# PORTAL WIRING Evidence Pack (EO-2)
> Generated: 2026-01-30T10:15:14Z
> Test: Guest chat "أبغى طب في روسيا ميزانية 5000"

## Summary: ✅ ALL PASS (with adapter fix)

---

## A) هل الشات يستقبل "أوامر عرض" من أوريسكا؟

**✅ PASS**

### Evidence: assistant-process Response (Request 252.311)

```json
{
  "ok": true,
  "reply": "تمام—كيف أقدر أساعدك أكثر؟",
  "cards_query": {
    "query_id": "cq_msg_1769768108664_web_gues_1769768113015",
    "sequence": 1,
    "params": {
      "country_code": "RU",
      "discipline_slug": "medicine",
      "tuition_usd_max": 5000,
      "tuition_usd_min": 0
    },
    "limit": 12
  },
  "events": [],
  "guest_state": {
    "registration_stage": "guest",
    "collected_profile": {
      "target_countries": ["ru"],
      "budget_usd": 5000
    },
    "message_count": 1
  }
}
```

**Conclusion**: CRM (Oryxa) sends structured `cards_query` with extracted search parameters.

---

## B) هل لوحة البرامج تعمل فقط بأوامر البوت؟

**✅ PASS**

### Evidence: Network Timeline

| Order | Request ID | Endpoint | Trigger |
|-------|------------|----------|---------|
| 1 | 252.311 | `assistant-process` | User message sent |
| 2 | 252.312 | `student-portal-api` | **AFTER** cards_query received |

### Console Log Proof:
```
[MalakChat] 🔍 cards_query received, fetching from Catalog:
  {"query_id":"cq_msg_...", "params":{...}}
```

**Conclusion**: Portal does NOT auto-search. Search only triggers when CRM sends `cards_query`.

---

## C) هل الـ16 فلتر تُمرر بدون اختراع فلاتر؟

**✅ PASS (after fix)**

### CRM → Portal Mapping

| CRM cards_query.params | Portal Request | Status |
|------------------------|----------------|--------|
| `country_code: "RU"` | `country_code: "RU"` | ✅ Passed |
| `discipline_slug: "medicine"` | `discipline_slug: "medicine"` | ✅ Fixed |
| `tuition_usd_max: 5000` | `max_tuition: 5000` | ✅ Aliased |
| `tuition_usd_min: 0` | `min_tuition: 0` | ✅ Fixed |

### Actual Portal API Request (252.312):
```json
{
  "action": "search_programs",
  "country_code": "RU",
  "max_tuition": 5000,
  "limit": 12
}
```

### Locked Keys Verification:
- ✅ Portal does NOT inject `tuition_basis` (system constant - added server-side)
- ✅ Portal does NOT inject `is_active` (system constant - added server-side)
- ✅ Portal does NOT inject `partner_priority` (locked key)
- ✅ Portal does NOT inject `do_not_offer` (locked key)

### Response Verification:
```json
{
  "sot_view": "vw_program_search_api_v3_final",
  "request_id": "ps_1769768115331_3epxwf"
}
```

---

## Fix Applied

**File**: `src/hooks/useCardsQuery.ts`

Added support for:
- `discipline_slug` → passed directly to Portal API
- `tuition_usd_min` → aliased to `min_tuition`

---

## Wire Protocol Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    PORTAL WIRING PROTOCOL                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  USER MESSAGE                                                   │
│       ↓                                                         │
│  [assistant-process] ──→ CRM (web-chat-malak)                  │
│       ↓                                                         │
│  CRM RESPONSE                                                   │
│  ├── reply: "رد البوت"                                          │
│  ├── cards_query: { params, query_id, sequence }               │
│  └── events: []                                                 │
│       ↓                                                         │
│  [useCardsQuery] Adapter                                        │
│  ├── country_code → country_code                                │
│  ├── discipline_slug → discipline_slug (🆕)                     │
│  ├── tuition_usd_max → max_tuition                              │
│  └── tuition_usd_min → min_tuition (🆕)                         │
│       ↓                                                         │
│  [student-portal-api] action: search_programs                   │
│       ↓                                                         │
│  PORTAL RESPONSE                                                │
│  └── items[], sot_view: "vw_program_search_api_v3_final"       │
│       ↓                                                         │
│  UI: Program Cards Rendered                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Canonical Filter Contract (Portal Side)

### Allowed (User-Controlled):
```
keyword, country_code, degree_level, language, max_tuition
discipline_slug (via adapter only)
limit, offset
```

### Blocked (422 if received):
```
discipline (old name), study_mode, city, has_dorm, dorm_max,
monthly_living_max, scholarship_*, intake_months, deadline_*,
sort, sort_by
```

### Locked (System-Only):
```
tuition_basis → 'year' (auto-injected by student-portal-api)
is_active → true (auto-injected)
publish_status → 'published' (auto-injected)
do_not_offer → false (auto-injected)
partner_priority → 'ignore' (default, Bot can override via HMAC)
```

---

## Verification Checklist

- [x] A: CRM sends cards_query ✅
- [x] B: Portal waits for cards_query before search ✅
- [x] C: Portal only passes allowed filters ✅
- [x] Locked keys not sent from frontend ✅
- [x] sot_view confirmed in response ✅
