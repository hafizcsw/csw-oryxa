# PORTAL_WIRING_SNAPSHOT.md
> Generated: 2026-01-30 | EO-2 Compliance

## 1. Actions Available (Renderer)

| Action | Auth Required | Endpoint | Description |
|--------|---------------|----------|-------------|
| `search_programs` | ❌ Public | `student-portal-api` | Search vw_program_search_api_v3_final (Contract v1) |
| `shortlist_list` | ✅ Auth | `student-portal-api` | List user's shortlist (max 10 items) |
| `shortlist_add` | ✅ Auth | `student-portal-api` | Add program to shortlist (limit enforced) |
| `shortlist_remove` | ✅ Auth | `student-portal-api` | Remove program from shortlist |
| `shortlist_compare` | ✅ Auth | `student-portal-api` | Get program data for comparison UI |
| `clear_shortlist` | ✅ Auth | `student-portal-api` | Clear all shortlist from CRM + Portal |
| `sync_shortlist` | ✅ Auth | `student-portal-api` | V3 sync with snapshots |
| `get_profile` | ✅ Auth | `student-portal-api` | Get user profile |
| `update_profile` | ✅ Auth | `student-portal-api` | Update user profile |
| `list_files` | ✅ Auth | `student-portal-api` | List user documents |
| `sign_file` | ✅ Auth | `student-portal-api` | Get signed URL for file |
| `get_payments` | ✅ Auth | `student-portal-api` | List payment history |
| `list_wallet_ledger` | ✅ Auth | `student-portal-api` | Wallet transactions |

---

## 2. Filter Contract v1 (Website Search)

### 2.1 ALLOWED_KEYS (5 Filters + Paging)

```typescript
// SOURCE: src/lib/normalizeProgramFilters.ts:31-38
// SOURCE: supabase/functions/student-portal-api/index.ts:2033-2041

const CONTRACT_V1_ALLOWED_KEYS = new Set([
  // Keyword aliases → keyword
  'keyword', 'q', 'query', 'subject',
  
  // Country aliases → country_code
  'country_code', 'country_slug', 'country',
  
  // Degree aliases → degree_level
  'degree_level', 'degree_slug', 'degree_id', 'degree',
  
  // Language aliases → language
  'language', 'instruction_languages',
  
  // Tuition aliases → max_tuition
  'max_tuition', 'fees_max', 'tuition_max_year_usd',
  
  // Paging
  'limit', 'offset', 'page', 'page_size',
]);
```

**Canonical Output (after normalization):**
| Key | Type | Description |
|-----|------|-------------|
| `keyword` | `string` | Text search |
| `country_code` | `string` | 2-letter ISO code |
| `degree_level` | `string` | Degree slug |
| `language` | `string` | Instruction language |
| `max_tuition` | `number` | Annual USD max |
| `limit` | `number` | Max 50, default 24 |
| `offset` | `number` | Pagination offset |

---

### 2.2 BLOCKED_KEYS → 422 Rejection

```typescript
// SOURCE: supabase/functions/student-portal-api/index.ts:2043-2055

const CONTRACT_V1_BLOCKED_KEYS = new Set([
  // Discipline (closed)
  'discipline_slug', 'discipline_id', 'discipline',
  
  // Study mode (closed)
  'study_mode', 'city',
  
  // Tuition advanced (closed)
  'tuition_basis', 'tuition_usd_min', 'tuition_usd_max',
  
  // Duration (closed)
  'duration_months_max', 'duration_months',
  
  // Housing (closed)
  'has_dorm', 'dorm_max', 'dorm_price_max', 'dorm_price_monthly_usd',
  
  // Living cost (closed)
  'monthly_living_max', 'living_max', 'monthly_living_usd',
  
  // Scholarship (closed)
  'scholarship_available', 'scholarship_type', 'has_scholarship',
  
  // Intake/Deadline (closed)
  'intake_months', 'deadline_before', 'deadline_date',
  
  // Partner (closed)
  'partner_priority', 'partner_tier', 'partner_preferred',
  
  // Sort (closed)
  'sort', 'sort_by',
  
  // Eligibility (closed)
  'enforce_eligibility', 'admission_policy', 'applicant_profile',
]);
```

**Response on blocked key:**
```json
{
  "ok": false,
  "error_code": "unsupported_filters",
  "message": "الفلاتر التالية غير مدعومة في الموقع: discipline_slug",
  "blocked_filters": ["discipline_slug"],
  "request_id": "ps_1234..."
}
```

---

## 3. LOCKED_KEYS (System Constants)

These keys are **NEVER allowed from user input** and trigger `CRITICAL_GUARD_VIOLATION`:

```typescript
// SOURCE: supabase/functions/student-portal-api/index.ts:2058-2064

const LOCKED_KEYS = new Set([
  'tuition_basis',        // System-controlled only → 'year'
  'partner_priority',     // Never from user
  'do_not_offer',         // Never from user → false
  'is_active',            // Never from user → true
  'instruction_language', // Must alias → instruction_languages[]
]);
```

**P0 Alert emitted on violation:**
```
CRITICAL_GUARD_VIOLATION request_id=ps_xxx forbidden_keys=[tuition_basis]
```

---

## 4. SYSTEM_AUGMENTED (Auto-Injected)

These are added by the system to every search query:

```typescript
// SOURCE: supabase/functions/student-portal-api/index.ts:2177-2182

const systemFilters = {
  tuition_basis: 'year',       // All tuition comparisons use annual USD
  is_active: true,             // Only active programs
  publish_status: 'published', // Only published programs
  do_not_offer: false,         // Only offerable programs
};
```

**Truth Log:**
```
SYSTEM_AUGMENTED request_id=ps_xxx added_system_keys=[do_not_offer,is_active,publish_status,tuition_basis]
```

---

## 5. Source of Truth (SoT)

| Component | SoT View/Table |
|-----------|----------------|
| Search (Website) | `vw_program_search_api_v3_final` |
| Search (Bot/CRM) | `rpc_kb_programs_search_v1_3_final` |
| Shortlist | `portal_shortlist` table + RPC functions |
| Profile | CRM `contacts` table |
| Files | CRM `contact_files` table |

---

## 6. Truth Logs Protocol (4 Logs per Request)

Every search request produces 4 logs with shared `request_id`:

| Log | Purpose |
|-----|---------|
| `FINAL_GUARD_CHECK_USER` | User keys + has_forbidden check |
| `SYSTEM_AUGMENTED` | System-added keys list |
| `PORTAL_REQ_FINAL` | Final payload JSON |
| `PORTAL_RES` | Response status + count |

---

## 7. Frontend Client API (portalApi.ts)

```typescript
// SOURCE: src/lib/portalApi.ts

// Search
searchPrograms(filters: SearchProgramsFilters)

// Shortlist (Auth Required)
shortlistList()        // → { count, limit, items }
shortlistAdd(id, snapshot, source)
shortlistRemove(id, source)
shortlistCompare()     // → { items: ShortlistCompareItem[] }
clearShortlist()

// Profile (Auth Required)
getProfile()
updateProfile(payload)

// Files (Auth Required)
listFiles()
signFile(bucket, path)

// Payments (Auth Required)
listPayments()
listWalletLedger(options)
```

---

## 8. Filter Normalization Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        USER INPUT                           │
│  { country_slug: 'TR', degree_id: 'uuid', fees_max: 5000 } │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              normalizeProgramFilters.ts                     │
│  ALLOWED_KEYS check → BLOCKED_KEYS strip → Alias resolve   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              student-portal-api (Edge)                      │
│  1. FINAL_GUARD_CHECK_USER (validate/reject)                │
│  2. LOCKED_KEYS check (P0 alert if violated)                │
│  3. SYSTEM_AUGMENTED (inject constants)                     │
│  4. PORTAL_REQ_FINAL (log final payload)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│          vw_program_search_api_v3_final                     │
│  { country_code: 'TR', degree_level: 'bachelor',            │
│    max_tuition: 5000, tuition_basis: 'year',                │
│    is_active: true, publish_status: 'published',            │
│    do_not_offer: false }                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Shortlist Contract (#7 Executive Order)

| Property | Value |
|----------|-------|
| Max items per user | 10 |
| Enforcement | Database RPC `rpc_shortlist_add` with `pg_advisory_xact_lock` |
| Error on limit | `error_code: 'shortlist_limit_reached'` |
| UI Response | `ShortlistLimitModal` (Compare / Manage / Cancel) |
| Guest Policy | Zero Network — `openAuthModal()` before any API call |

---

## Version History

| Date | Change |
|------|--------|
| 2026-01-30 | Initial EO-2 extraction |
