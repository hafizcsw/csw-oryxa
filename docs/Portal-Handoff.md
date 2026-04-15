# Portal Closeout Handoff Document
> Generated: 2026-01-26 | Status: ✅ READY FOR CRM

---

## 1. Security Closeout Status

### 1.1 Cron Secrets ✅ PASS
| Function | Secret Header | Secret Exists | 401 Test |
|----------|---------------|---------------|----------|
| `fx-refresh-daily` | `x-cron-secret` | `FX_CRON_SECRET` ✅ | ✅ Verified |
| `translation-worker` | `x-worker-secret` | `TRANSLATION_WORKER_SECRET` ✅ | ✅ Verified |

**Cron Schedule:**
- `fx-refresh-daily`: Daily at 03:00 UTC
- `translation-worker`: Every 5 minutes

### 1.2 Staff Data Protection ✅ PASS
- `compute_recommendations_v2` RPC: Uses `auth.uid()` + `has_role()` for staff check (NO p_audience trust)
- `csw_university_guidance` RLS: Admin-only (SELECT/INSERT/UPDATE/DELETE)
- `csw_program_guidance` RLS: Admin-only (SELECT/INSERT/UPDATE/DELETE)

---

## 2. Edge Functions Registry

### Public (Auth Optional)
| Function | Auth | Purpose |
|----------|------|---------|
| `portal-programs-search` | Optional | Search programs with i18n + FX |
| `search-scholarships` | Optional | Search scholarships |
| `city-insights` | None | City living costs & climate |
| `compare-programs` | Optional | Compare 2-5 programs |
| `recommend-programs-v2` | Optional | Personalized recommendations |

### Protected (Cron Secret Required)
| Function | Header | Secret |
|----------|--------|--------|
| `fx-refresh-daily` | `x-cron-secret` | `FX_CRON_SECRET` |
| `translation-worker` | `x-worker-secret` | `TRANSLATION_WORKER_SECRET` |

### Admin Only (Auth + Admin Role)
| Function | Purpose |
|----------|---------|
| `admin-*` (all prefixed) | Admin panel operations |

---

## 3. New Tables (P0.5 - P6)

| Table | Purpose | RLS |
|-------|---------|-----|
| `fx_rates_history` | Historical FX rates with source | Public read |
| `translation_jobs` | Async translation queue | Service role only |
| `program_i18n` | Program translations | Public read, admin write |
| `university_i18n` | University translations | Public read, admin write |
| `program_aliases` | Semantic search aliases | Public read |
| `university_aliases` | Semantic search aliases | Public read |
| `csw_university_guidance` | Partner tiers, CSW stars | **Admin only** |
| `csw_program_guidance` | Program priorities | **Admin only** |
| `city_enrichment` | City living costs & climate | Public read |
| `portal_user_prefs` | User language/currency prefs | Owner only |

---

## 4. New RPCs

| RPC | Purpose | Security |
|-----|---------|----------|
| `rpc_claim_translation_jobs(p_limit)` | Atomic job claim with SKIP LOCKED | Service role |
| `rpc_requeue_stale_translation_jobs(p_stale_minutes)` | Requeue stuck jobs | Service role |
| `compute_recommendations_v2(...)` | Score programs with reason codes | Staff check via DB |

---

## 5. Do-Not-Break Rules

### Source of Truth (SoT) Separation
- **Portal SoT**: Catalog (universities, programs, scholarships, KB, i18n, aliases, enrichment, CSW guidance)
- **CRM SoT**: Operations (customers, applications, payments, status)

### Critical Rules
1. **NEVER** add CRM tables to Portal database
2. **NEVER** trust `p_audience` parameter for security decisions
3. **NEVER** expose `staff_notes`, `pitch_staff_i18n`, `internal_notes` to non-admin users
4. **ALWAYS** use `auth.uid()` + `has_role()` for staff checks
5. **ALWAYS** include `lang` and `display_currency_code` in cache keys
6. `portal_url` in `vw_program_search_api` must be NOT NULL

---

## 6. Verification Queries

### Translation Queue Health
```sql
-- Status distribution
SELECT status, COUNT(*) FROM translation_jobs GROUP BY 1;

-- Stuck jobs (should be 0)
SELECT COUNT(*) AS stale_processing
FROM translation_jobs
WHERE status = 'processing' AND started_at < NOW() - INTERVAL '15 minutes';
```

### FX Rates Health
```sql
-- Latest rates (should have 20+ currencies)
SELECT COUNT(*) FROM fx_rates_latest;

-- Check source attribution
SELECT currency_code, source, as_of_date 
FROM fx_rates_history 
ORDER BY created_at DESC LIMIT 5;
```

### City Enrichment
```sql
-- Should have 27 cities
SELECT COUNT(*) FROM city_enrichment;
```

### CSW Guidance RLS Test
```sql
-- As non-admin: should return 0 rows
-- As admin: should return data
SELECT COUNT(*) FROM csw_university_guidance;
```

---

## 7. UI Wiring Status

| Feature | Component | Edge Function | Status |
|---------|-----------|---------------|--------|
| Recommendations | `RecommendedPrograms.tsx` | `recommend-programs-v2` | ✅ Wired |
| Compare | `Compare.tsx` | `compare-programs` | ✅ Wired |
| City Insights | `city-insights` | `city-insights` | ✅ Ready (needs UI button) |
| Scholarships | `/scholarships` page | `search-scholarships` | ✅ 10 published |
| **CSW Guidance** | `UniversityStudioPage.tsx` → CSW Tab | Direct DB (admin RLS) | ✅ **Single Source** |

**CSW Single Source of Truth:**
- University-level CSW settings (`csw_university_guidance`) are now exclusively managed via the **CSW Guidance tab** in University Studio (`/admin/university/:id/studio?tab=csw`).
- No duplicate entry points exist in the codebase.
- This satisfies the Portal Closeout requirement for a unified settings source.

---

## 8. Ready for CRM Criteria ✅

| Criterion | Status |
|-----------|--------|
| Cron + Secrets work 24h without intervention | ✅ |
| 401 returned without secret | ✅ Verified |
| RLS: No staff data leakage | ✅ |
| FX Latest non-empty + as_of logical | ✅ 28 currencies |
| City enrichment seeded | ✅ 27 cities |
| Recommendations V2 in UI | ✅ |
| Compare page functional | ✅ |

---

## 9. Remaining Nice-to-Have (Post-CRM)

- [ ] City insights button in program details page
- [ ] Increase scholarships to 50+
- [ ] Add OpenExchangeRates API key for live FX
- [ ] PDF export for compare page
- [ ] Share link for compare page
