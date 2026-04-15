# PORTAL PHASE CLOSURE — EVIDENCE PACK
## Studio → DB → View → Card Proof for 20 Filter Keys
**Generated:** 2026-01-28
**Status:** ✅ PASS (with enhancement recommendations)

---

## DELIVERABLE (1): STUDIO FIELD MAP — 20 Canonical Filter Keys

| # | Filter Key | Studio Screen | Tab/Section | Field Label | Input Type | Source DB Column(s) | Appears on Card? |
|---|------------|--------------|-------------|-------------|------------|---------------------|------------------|
| 1 | `country_code` | University Studio | المعلومات الأساسية | الدولة | Select | `universities.country_id` → JOIN `countries.country_code` | YES: Location line |
| 2 | `city` | University Studio | المعلومات الأساسية | المدينة | Text | `universities.city` | YES: Location line |
| 3 | `degree_slug` | Program Editor | أساسي Tab | الدرجة العلمية | Select | `programs.degree_id` → JOIN `degrees.slug` | YES: Degree badge |
| 4 | `discipline_slug` | Program Editor | أساسي Tab | التخصص | Select | `programs.discipline_id` → JOIN `disciplines.slug` | NO (not on card) |
| 5 | `study_mode` | Program Editor | أساسي Tab | نمط الدراسة | Select (3 options) | `programs.study_mode` | YES: When not NULL |
| 6 | `instruction_language` | — | — | — | — | ALIAS ONLY → `instruction_languages` | — |
| 7 | `instruction_languages` | Program Editor | أساسي Tab | لغات التدريس | Multi-checkbox | `program_languages.language_code[]` → Aggregated array | YES: First or joined |
| 8 | `tuition_basis` | — | — | — | — | SEARCH-TIME PARAM ONLY (not stored) | NO |
| 9 | `tuition_usd_min` | Program Editor | الرسوم Tab | الرسوم (من) | Number | `programs.tuition_local_min` + `currency_code` → FX → `tuition_usd_min` | YES: Tuition line |
| 10 | `tuition_usd_max` | Program Editor | الرسوم Tab | الرسوم (إلى) | Number | `programs.tuition_local_max` + `currency_code` → FX → `tuition_usd_max` | YES: Tuition line |
| 11 | `duration_months_max` | Program Editor | أساسي Tab | مدة الدراسة (شهور) | Number | `programs.duration_months` | YES: Duration badge |
| 12 | `has_dorm` | University Studio | المعلومات الأساسية | سكن جامعي | Switch | `universities.has_dorm` | YES: When TRUE |
| 13 | `dorm_price_monthly_usd_max` | University Studio | المعلومات الأساسية | سعر السكن (شهري) | Number | `universities.dorm_price_monthly_local` + `dorm_currency_code` → FX | YES: With price |
| 14 | `monthly_living_usd_max` | University Studio | المعلومات الأساسية | تكلفة المعيشة (شهري) | Number | `universities.monthly_living` (USD only) | NO (not on card v1) |
| 15 | `scholarship_available` | Program Editor | أساسي Tab | منحة متاحة | Switch | `programs.has_scholarship` | YES: When TRUE |
| 16 | `scholarship_type` | Program Editor | أساسي Tab | نوع المنحة | Select (4 options) | `programs.scholarship_type` | YES: Type label |
| 17 | `partner_priority` | CSW Guidance | CSW Tab | مستوى الشراكة | Select (5 tiers) | `csw_university_guidance.partner_tier`, `.csw_star` | NO (internal ranking) |
| 18 | `do_not_offer` | CSW Guidance | CSW Tab | منع العرض | Switch | `csw_university_guidance.do_not_offer` | LOCKED: Server-enforced FALSE |
| 19 | `intake_months` | Program Editor | أساسي Tab | شهور القبول | Multi-checkbox (12) | `programs.intake_months` (int[]) | YES: Intake line |
| 20 | `deadline_before` | Program Editor | أساسي Tab | أقرب موعد قبول | Date | `programs.next_intake_date` | NO (not on card v1) |

### Notes:
- **`tuition_basis`**: Search-time parameter only. RPC uses `year`/`semester`/`program_total` to select which USD column to compare against.
- **`instruction_language`**: Alias for singular → maps to `instruction_languages[]` array
- **`do_not_offer`**: LOCKED_FALSE in RPC — CRM cannot bypass this filter. Server always excludes these.

---

## DELIVERABLE (2): SOURCE TABLE PROOF — 8 QA Programs

### A) `programs` Table (Raw Data)

| program_id | title | study_mode | duration_months | intake_months | next_intake_date | has_scholarship | scholarship_type | currency_code | tuition_local_min | tuition_local_max |
|------------|-------|------------|-----------------|---------------|------------------|-----------------|------------------|---------------|-------------------|-------------------|
| `a99cd46c-87d0-4ddb-bc77-1cd1f621319d` | QA-P-01 Medicine Bachelor | on_campus | 72 | [9,2] | 2026-09-01 | true | partial | USD | 8000 | 10000 |
| `f032067c-ab45-48a3-a6c3-43e026245035` | QA-P-02 Engineering Master | hybrid | 24 | [9] | 2026-09-15 | false | NULL | USD | 6000 | 7500 |
| `d60b24fb-29fe-4960-a1eb-76addb3de8e5` | QA-P-03 CS Bachelor | on_campus | 48 | [9,2] | 2026-09-01 | true | full | USD | 4000 | 5000 |
| `2cc6dc76-0c7c-495b-9b8b-9fd0391f1a0b` | QA-P-04 Business Master | online | 18 | [1,9] | 2027-01-15 | true | tuition_waiver | USD | 5500 | 6500 |
| `763142a2-3bae-4f5a-8dc7-f419ea3773e6` | QA-P-05 Medicine Master | on_campus | 24 | [9] | 2026-09-01 | false | NULL | USD | 25000 | 30000 |
| `9b9cbd9c-aa8d-4921-bb88-202198ecea80` | QA-P-06 Engineering Bachelor | hybrid | 36 | [9,1] | 2026-09-15 | true | stipend | USD | 20000 | 22000 |
| `13f64364-892a-40b3-bcfd-3507c83e1cb1` | QA-P-07 CS Master | on_campus | 24 | [4,10] | 2026-10-01 | true | full | USD | 500 | 800 |
| `89b0452c-c4c1-4a06-a77b-a4c22d1821b9` | QA-P-08 Business Bachelor | online | 36 | [4,10] | 2026-10-15 | false | NULL | USD | 600 | 900 |

**✅ All 8 programs have `publish_status=published`, `is_active=true`**

### B) `program_languages` Table (Join)

| program_id | program_title | language_code |
|------------|---------------|---------------|
| `a99cd46c-...` | QA-P-01 Medicine Bachelor | en |
| `a99cd46c-...` | QA-P-01 Medicine Bachelor | tr |
| `f032067c-...` | QA-P-02 Engineering Master | en |
| `d60b24fb-...` | QA-P-03 CS Bachelor | en |
| `d60b24fb-...` | QA-P-03 CS Bachelor | ru |
| `2cc6dc76-...` | QA-P-04 Business Master | ru |
| `763142a2-...` | QA-P-05 Medicine Master | en |
| `9b9cbd9c-...` | QA-P-06 Engineering Bachelor | en |
| `13f64364-...` | QA-P-07 CS Master | de |
| `13f64364-...` | QA-P-07 CS Master | en |
| `89b0452c-...` | QA-P-08 Business Bachelor | de |

**✅ All 8 programs have ≥1 language in join table**

### C) `universities` Table (Housing + Living)

| university_id | name | city | country_code | has_dorm | dorm_price_monthly_local | dorm_currency_code | monthly_living |
|---------------|------|------|--------------|----------|--------------------------|--------------------|-----------------
| `64b2b0e7-...` | QA-U-DE-BER | Berlin | DE | true | 500 | USD | 1200 |
| `3d720865-...` | QA-U-RU-MOW | Moscow | RU | true | 350 | USD | 700 |
| `d6f28c04-...` | QA-U-TR-IST | Istanbul | TR | true | 400 | USD | 800 |
| `d8edc979-...` | QA-U-UK-LON | London | GB | **false** | **NULL** | **NULL** | 1500 |

**✅ Dorm logic correct: has_dorm=false → dorm fields NULL**

### D) `csw_university_guidance` Table (Partner Metadata)

| university_id | university_name | csw_star | partner_tier | do_not_offer | priority_score |
|---------------|-----------------|----------|--------------|--------------|----------------|
| `64b2b0e7-...` | QA-U-DE-BER | false | silver | false | 60 |
| `3d720865-...` | QA-U-RU-MOW | false | gold | false | 80 |
| `d6f28c04-...` | QA-U-TR-IST | **true** | platinum | false | 100 |
| `d8edc979-...` | QA-U-UK-LON | false | **NULL** | false | 0 |

**✅ Partner tiers correctly set. GB has NULL tier (tests ignore filter).**

---

## DELIVERABLE (3): VIEW PROOF — `vw_program_search_api_v3_final`

### All 19 Filter Columns Verified Present:

| Column | Data Type | Verified |
|--------|-----------|----------|
| country_code | text | ✅ |
| city | text | ✅ |
| degree_slug | text | ✅ |
| discipline_slug | text | ✅ |
| study_mode | text | ✅ |
| instruction_languages | ARRAY | ✅ |
| tuition_usd_year_min | numeric | ✅ |
| tuition_usd_year_max | numeric | ✅ |
| duration_months | integer | ✅ |
| has_dorm | boolean | ✅ |
| dorm_price_monthly_usd | numeric | ✅ |
| monthly_living_usd | numeric | ✅ |
| scholarship_available | boolean | ✅ |
| scholarship_type | text | ✅ |
| partner_star | boolean | ✅ |
| partner_tier | text | ✅ |
| intake_months | ARRAY | ✅ |
| deadline_date | date | ✅ |
| do_not_offer | boolean | ✅ |

### 3 Representative Programs from View:

| program_name | study_mode | instruction_languages | has_dorm | dorm_price | scholarship_available | scholarship_type | intake_months | deadline_date |
|--------------|------------|----------------------|----------|------------|----------------------|------------------|---------------|---------------|
| QA-P-01 Medicine Bachelor | on_campus | [en,tr] | true | 400 | true | partial | [9,2] | 2026-09-01 |
| QA-P-05 Medicine Master | on_campus | [en] | false | NULL | false | NULL | [9] | 2026-09-01 |
| QA-P-07 CS Master | on_campus | [de,en] | true | 500 | true | full | [4,10] | 2026-10-01 |

**✅ View correctly aggregates data from source tables**

---

## DELIVERABLE (4): FILTER-TO-CARD RULES — Visibility Logic

### From `ProgramCard.tsx` (Lines 190-248):

```tsx
// Language: Only show if languageDisplay is truthy
{languageDisplay && (
  <div>...</div>
)}

// Study Mode: Only show if p.study_mode is truthy
{p.study_mode && (
  <div>...</div>
)}

// Housing: Only show if p.has_dorm is TRUE
{p.has_dorm && (
  <div>
    {p.dorm_price_monthly_usd 
      ? `${money(p.dorm_price_monthly_usd, 'USD')}/شهر`
      : 'سكن متاح'}
  </div>
)}

// Scholarship: Only show if p.scholarship_available is TRUE
{p.scholarship_available && (
  <div>
    {p.scholarship_type === 'full' ? 'منحة كاملة' : ...}
  </div>
)}

// Intake Months: Only show if array has length > 0
{p.intake_months && p.intake_months.length > 0 && (
  <div>...</div>
)}
```

### Answers:

| Question | Answer | Evidence |
|----------|--------|----------|
| Are any card fields defaulted via COALESCE in view? | **NO** | View passes NULL through, card handles with conditional rendering |
| Does card hide fields when NULL? | **YES** | All SoT fields use `{field && (...)}` pattern |
| Does scholarship_type only appear if scholarship_available=true? | **YES** | Line 224: `{p.scholarship_available && (...)}` |
| Does dorm price appear only if has_dorm=true? | **YES** | Line 212: `{p.has_dorm && (...)}` |

**✅ All visibility rules correctly implemented**

---

## DELIVERABLE (5): DEADLINE + INTAKE DEFINITIONS

| Field | View Column | Source Column | Type | Values |
|-------|-------------|---------------|------|--------|
| `deadline_before` filter | `deadline_date` | `programs.next_intake_date` | DATE | ISO date |
| `intake_months` filter | `intake_months` | `programs.intake_months` | INT[] | 1-12 (Jan-Dec) |

**✅ Confirmed: `deadline_date` in view comes from `programs.next_intake_date`**

---

## DELIVERABLE (6): ENFORCED PUBLISH GATE

### Current Trigger: `enforce_program_publish_requirements`

**Location:** `public.programs` table, BEFORE INSERT OR UPDATE

**Current Required Fields:**
- ✅ `university_id` — Cannot publish without
- ✅ `duration_months` — Cannot publish without
- ✅ `degree_id` — Cannot publish without (SoT requirement)
- ✅ `discipline_id` — Cannot publish without (SoT requirement)
- ✅ Tuition: Either `tuition_is_free=true` OR (`currency_code` + `tuition_local_min/max`)
- ✅ `is_active=true` — Must be active to publish
- ✅ Languages: At least 1 row in `program_languages` table
- ✅ FX Rate: Non-USD currencies must have rate in `fx_rates`

### Trigger SQL (Current):
```sql
CREATE TRIGGER enforce_program_publish_requirements 
BEFORE INSERT OR UPDATE ON public.programs 
FOR EACH ROW 
EXECUTE FUNCTION enforce_program_publish_requirements()
```

### ⚠️ ENHANCEMENT RECOMMENDATION

**Missing from current gate:**
1. `study_mode` — Not currently required (can be NULL)
2. `intake_months` — Not currently required (can be empty array)
3. `next_intake_date` — Not currently required (can be NULL)
4. University-level `has_dorm` logic consistency — Not checked
5. `scholarship_type` required when `has_scholarship=true` — Not checked

**Recommendation:** For QA stability, consider adding these checks. However, making them mandatory would block existing published programs that lack this data. 

**Current Status:** Gate is functional for core requirements. Enhancement is OPTIONAL.

---

## SUMMARY: PORTAL PHASE CLOSURE STATUS

| Deliverable | Status |
|-------------|--------|
| (1) Studio Field Map | ✅ COMPLETE |
| (2) Source Table Proof | ✅ COMPLETE (8 QA programs verified) |
| (3) Card Display Proof | ✅ COMPLETE (visibility logic verified) |
| (4) Filter-to-Card Rules | ✅ COMPLETE (conditional rendering confirmed) |
| (5) Deadline/Intake Definitions | ✅ COMPLETE (column mapping confirmed) |
| (6) Publish Gate | ✅ FUNCTIONAL (enhancement optional) |

---

## DEFINITION OF DONE: ✅ ACHIEVED

- [x] Complete Studio→DB→View→Card proof delivered
- [x] All 20 filter keys mapped with evidence
- [x] 8 QA programs verified in source tables AND view
- [x] Card visibility logic confirmed (no fake defaults)
- [x] Publish gate exists and blocks incomplete programs

**PORTAL PHASE IS NOW CLOSED.**

**Next Step:** CRM wiring proof with RID evidence (separate phase).
