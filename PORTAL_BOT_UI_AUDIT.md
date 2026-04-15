# PORTAL_BOT_UI_AUDIT.md
> **Date**: 2026-02-27 | **Scope**: Portal-side only | **Changes**: NONE (Audit only)

---

## 0) Scope Confirmation

- ❌ لا تغييرات في CRM
- ❌ لا تغييرات في Portal
- ✅ توثيق + أدلة تشغيل فقط

---

## 1) خريطة التشغيل (Operational Map)

### A) Response Source — من أين يأتي "نص رد البوت"؟

| السؤال | الإجابة | الدليل |
|--------|---------|--------|
| هل النص يأتي دائمًا من CRM reply_envelope؟ | **نعم بنسبة 99%** | `src/lib/chat/contracts/response.ts:176-203` — `parseReply()` يقرأ `reply_key` أو `reply_text` أو `reply` من CRM response |
| هل يوجد templates محلية في Portal؟ | **نعم — محدودة** | 1) رسائل loading محلية: `"ملاك يفكر..."` و `"أبحث عن أنسب الجامعات لك..."` في `AIChatPanel.tsx:161,173` <br> 2) Suggested prompts ثابتة: `AIChatPanel.tsx:18-23` <br> 3) رسالة ترحيب محلية: `"أهلاً بك! 👋"` في `AIChatPanel.tsx:128-131` <br> 4) Mock CRM response (DEV فقط عبر `VITE_ENABLE_MOCK_CRM=true`): `gateway.ts:402-436` |
| هل Portal يستدعي أي LLM مباشرة؟ | **لا** | لا يوجد أي import لـ OpenAI/Gemini/أي LLM SDK في كود Portal. كل الذكاء يمر عبر CRM |
| آلية Streaming | **موجودة** عبر `portal-chat-proxy-stream` | `useStreamingChat.ts` — SSE streaming مع `data: {type: "delta", delta: "..."}` events. النص النهائي يُبنى من تراكم deltas في Portal |

**الخلاصة**: Portal هو **Zombie Renderer** — يعرض ما يرسل CRM. الاستثناءات الوحيدة هي:
1. رسائل Loading/Thinking (ثابتة عربي)
2. Suggested prompts (ثابتة)
3. رسالة الترحيب الأولى (ثابتة)
4. Mock mode للتطوير

### B) Channels داخل Portal

| Channel | Session Type | Auth | Code Path |
|---------|-------------|------|-----------|
| `web_chat` | `guest` | Anonymous (no JWT) | `gateway.ts:254` — Guest = web_chat |
| `web_portal` | `authenticated` | Supabase JWT Bearer | `gateway.ts:258` — Authenticated = web_portal |

**الصفحات/التبويبات التي تتفاعل مع البوت:**
- Chat Panel (`AIChatPanel.tsx`) — الواجهة الرئيسية
- Programs tab — يستقبل `cards_query` من CRM ويبحث
- Universities tab — بحث مستقل عبر `search-universities` Edge Function
- Scholarships tab — بحث عبر `search-scholarships` Edge Function
- Events tab — بحث عبر `search-events` Edge Function
- Map — بحث عبر RPCs مباشرة (`rpc_map_country_summary`, etc.)

**هل يوجد chat داخل CRM staff؟** — **لا** على Portal. Admin panel منفصل.

### C) Flow الكامل

```
┌──────────────────────────────────────────────────────────────┐
│                    PORTAL CHAT FLOW                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User types message                                       │
│     ↓                                                        │
│  2. useMalakAssistant.sendMessage()                          │
│     → builds ui_context (route, tab, lang)                   │
│     → gets session identity (guest/authenticated)            │
│     → calls sendChatMessage() in gateway.ts                  │
│     ↓                                                        │
│  3. gateway.ts: buildGatewayEnvelope('chat_message', ...)    │
│     → buildEnvelopeV12() wraps payload                       │
│     → stripLockedKeys() removes is_active, etc.              │
│     → assertSessionIdentity() validates channel match        │
│     ↓                                                        │
│  4. fetch() → portal-chat-proxy (Edge Function)              │
│     OR fetch() → portal-chat-proxy-stream (if ?forceStream=1)│
│     Headers: Authorization, x-portal-ingress, x-client-trace │
│     ↓                                                        │
│  5. Edge Function → CRM (external)                           │
│     ↓                                                        │
│  6. CRM Response received by Portal:                         │
│     {                                                        │
│       reply / reply_text / reply_key,                        │
│       ui_directives: { search_mode, phase, ... },            │
│       cards_query: { query_id, sequence, params, ... },      │
│       state, customer_id, ...                                │
│     }                                                        │
│     ↓                                                        │
│  7. State Machine: computeNextState()                        │
│     → IF search_mode === "start" AND cards_query.query_id    │
│       → TRIGGER SEARCH (Step 8)                              │
│     → IF phase === "awaiting_consent"                        │
│       → SHOW CONSENT UI                                      │
│     → IF phase === "clarify"                                 │
│       → SHOW MISSING FIELDS                                  │
│     → ELSE → CHAT (display reply only)                       │
│     ↓                                                        │
│  8. SEARCH (if triggered):                                   │
│     useCardsQuery.fetchCards()                                │
│     → validateCardsQueryParams() [FAIL-CLOSED]               │
│     → sanitizeProgramFilters()                               │
│     → buildCardsQueryPayload()                               │
│     → fetch() → search-programs (Edge Function)              │
│     → Returns programs[]                                     │
│     ↓                                                        │
│  9. RENDER cards in UI                                       │
│     ↓                                                        │
│ 10. ACK: useACKSender.sendACK('cards_rendered', ...)         │
│     → Deduplicated (deterministic ack_id)                    │
│     → sendChatAck() via gateway                              │
│     → portal-chat-proxy → CRM                               │
│     ↓                                                        │
│ 11. TELEMETRY: sendPortalEvent() → log-event                │
│     (PII-free: msg_len, flags, IDs only)                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 2) المسارات (Endpoints/Actions)

### Per Tab / Per Entity

| Tab/Entity | Endpoint/Edge Action | Method | Request Body Shape | Response Shape | Used In |
|-----------|---------------------|--------|-------------------|---------------|---------|
| **Programs (Bot)** | `search-programs` (Edge) | POST | `{ params: {HARD16}, rank_filters?: {RANK10}, limit, page }` | `{ items[], total, next_page_token }` | `useCardsQuery.ts:99` |
| **Programs (UI Search)** | `student-portal-api` action=`search_programs` | POST | `{ action:"search_programs", ...normalizedFilters, limit, offset }` | `{ ok, items[], total, has_next, next_offset }` | `portalApi.ts:441-443`, `useProgramSearch.ts` |
| **Universities** | `search-universities` (Edge) | POST | `{ filters }` | `{ universities[], count }` | `useMalakAssistant.tsx:338`, `Universities.tsx` |
| **Universities (Direct)** | PostgREST `vw_university_card` | GET | Query params (ilike, lte, gte, etc.) | `{ data[], count }` | `Universities.tsx` (PostgREST bypass) |
| **Scholarships** | `search-scholarships` (Edge) | POST | `{ country_code, degree_slug, amount_type, coverage_type, amount_min, limit, offset }` | `{ ok, items[], count }` | `useScholarshipSearch.ts:77`, `Universities.tsx:148` |
| **Events** | `search-events` (Edge) | POST | `{ country_code?, limit, offset }` | `{ ok, items[], count }` | `Universities.tsx:163` |
| **Map (Countries)** | RPC `rpc_map_country_summary` | POST | `{ p_degree_slug, p_fees_max }` | `CountrySummary[]` | `useMapData.ts:53` |
| **Map (Cities)** | RPC `rpc_map_city_summary` | POST | `{ p_country_code, p_degree_slug, p_fees_max }` | `CitySummary[]` | `useMapData.ts:71` |
| **Map (City Unis)** | RPC `rpc_map_city_universities` | POST | `{ p_country_code, p_city, p_degree_slug, p_fees_max }` | `CityUniversity[]` | `useMapData.ts:90` |
| **Chat Message** | `portal-chat-proxy` (Edge) | POST | EnvelopeV12 (chat_message) | CRMResponse | `gateway.ts:319` |
| **Chat Stream** | `portal-chat-proxy-stream` (Edge) | POST | EnvelopeV12 (chat_message) | SSE stream | `useStreamingChat.ts:170` |
| **Chat ACK** | `portal-chat-proxy` (Edge) | POST | EnvelopeV12 (render_receipt) | `{ok}` | `gateway.ts:695` |
| **Chat Event** | `portal-chat-proxy` (Edge) | POST | EnvelopeV12 (control_patch) | `{ok}` | `gateway.ts:609` |
| **Shortlist** | `student-portal-api` actions: `shortlist_list/add/remove/compare` | POST | `{ action, program_id?, ... }` | Various | `portalApi.ts:188-242` |
| **Telemetry** | `log-event` (Edge) | POST | `{ name, visitor_id, properties }` | fire-and-forget | `telemetry.ts:185` |

### Bypass Points (PostgREST Direct)

| Entity | Bypass | File | Notes |
|--------|--------|------|-------|
| Universities (virtual list) | `supabase.from("universities").select("id,name")` | `useVirtualUniversities.ts:51` | Direct PostgREST, no Edge Function |
| Map RPCs | `supabase.rpc("rpc_map_*")` | `useMapData.ts` | Direct RPC, no sanitization layer |

---

## 3) الفلاتر والمفاتيح: UI Keys vs Request Keys vs KB Keys

### A) Programs — Bot Path (26 فلتر)

#### HARD16 (User-controlled — `cards_query.params`)

| # | UI Key | Outgoing Key | Type | Transform | Notes |
|---|--------|-------------|------|-----------|-------|
| 1 | country_code | country_code | string (ISO) | `canonicalizeCountryCode()` | Aliases: country_slug, country |
| 2 | city | city | string | none | Exact match |
| 3 | degree_slug | degree_slug | string (slug) | `canonicalizeDegreeSlugOrId()` | Aliases: degree_level, degree_id |
| 4 | discipline_slug | discipline_slug | string (slug) | `canonicalizeDisciplineSlug()` | Aliases: discipline_id |
| 5 | study_mode | study_mode | string | none | full_time, part_time |
| 6 | instruction_languages | instruction_languages | string[] | `canonicalizeInstructionLanguages()` | "English"→"en" |
| 7 | tuition_usd_min | tuition_usd_min | number | `parseNumberOrUndefined()` | |
| 8 | tuition_usd_max | tuition_usd_max | number | `parseNumberOrUndefined()` | Aliases: max_tuition, fees_max |
| 9 | duration_months_max | duration_months_max | number | `parseNumberOrUndefined()` | |
| 10 | has_dorm | has_dorm | boolean | `parseBooleanOrUndefined()` | |
| 11 | dorm_price_monthly_usd_max | dorm_price_monthly_usd_max | number | `parseNumberOrUndefined()` | |
| 12 | monthly_living_usd_max | monthly_living_usd_max | number | `parseNumberOrUndefined()` | |
| 13 | scholarship_available | scholarship_available | boolean | `parseBooleanOrUndefined()` | |
| 14 | scholarship_type | scholarship_type | string | none | full, partial |
| 15 | intake_months | intake_months | number[] | `normalizeIntakeMonths()` | 1-12 |
| 16 | deadline_before | deadline_before | string (YYYY-MM-DD) | `parseDateYYYYMMDDOrUndefined()` | |

#### RANK10 (Ranking filters — `cards_query.rank_filters`)

| # | Key | Type | DB Field | Operator | Notes |
|---|-----|------|----------|----------|-------|
| 1 | institution_id | string (UUID) | institution_id | exact | No ranking context needed |
| 2 | ranking_system | string | ranking_system | exact | Required with thresholds |
| 3 | ranking_year | number | ranking_year | exact | Required with thresholds |
| 4 | world_rank_max | number | world_rank | range_max (<=) | |
| 5 | national_rank_max | number | national_rank | range_max (<=) | |
| 6 | overall_score_min | number | overall_score | range_min (>=) | |
| 7 | teaching_score_min | number | teaching_score | range_min (>=) | |
| 8 | employability_score_min | number | employability_score | range_min (>=) | |
| 9 | academic_reputation_score_min | number | academic_reputation_score | range_min (>=) | |
| 10 | research_score_min | number | research_score | range_min (>=) | |

#### LOCKED (Server-only — NEVER from client)

| Key | Notes |
|-----|-------|
| is_active | API injects `true` |
| partner_priority | Sorting/prioritization |
| do_not_offer | Exclusion |
| tuition_basis | Always `year` (SYSTEM_CONSTANTS) |

#### KEYWORD (Special — not a filter)

| Key | Notes |
|-----|-------|
| keyword | Text search. Aliases `q`, `query`, `keywords` are **BLOCKED** (contract violation) |

### B) Programs — UI Search Path

The UI search path (`portalApi.searchPrograms`) goes through `normalizeProgramFilters()` which:
1. Accepts **aliases** (country_slug→country_code, degree_level→degree_slug, etc.)
2. Canonicalizes via `canonicalize*.ts` functions
3. Strips LOCKED keys
4. Logs unknown keys
5. Sends to `student-portal-api` action=`search_programs`

**KEY DIFFERENCE**: Bot path uses `useCardsQuery` → `search-programs` (HMAC-signed RPC). UI path uses `portalApi` → `student-portal-api` → same RPC but different Edge Function wrapper.

### C) Scholarships

| UI Key | Outgoing Key | Type | Notes |
|--------|-------------|------|-------|
| country_code | country_code | string | ISO |
| degree_slug | degree_slug | string | |
| amount_type | amount_type | string | full, percent, fixed |
| coverage_type | coverage_type | string | |
| amount_min | amount_min | number | |

### D) Events

| UI Key | Outgoing Key | Type | Notes |
|--------|-------------|------|-------|
| country_code | country_code | string | Optional |
| limit | limit | number | Default 20 |
| offset | offset | number | Default 0 |

### E) Map

| UI Key | Outgoing Key | Type | Notes |
|--------|-------------|------|-------|
| degree_slug | p_degree_slug | string | RPC param |
| fees_max | p_fees_max | number | RPC param |
| country_code | p_country_code | string | For city/university drill-down |
| city | p_city | string | For university drill-down |

### F) Universities (Direct PostgREST)

| UI Key | Outgoing Key | Type | Transform | Notes |
|--------|-------------|------|-----------|-------|
| country_slug | eq.country_slug | string | none | |
| q_name | ilike.name | string | `%${q}%` | |
| fees_min | gte.tuition_usd_year_min | number | | |
| fees_max | lte.tuition_usd_year_max | number | | |
| living_min | gte.monthly_living_usd | number | | |
| living_max | lte.monthly_living_usd | number | | |
| degree_id | cs.degree_ids | string (UUID) | `{uuid}` | Array contains |
| rank_max | lte.world_rank | number | | |
| has_dorm | eq.has_dorm | boolean | | |
| university_type | eq.university_type | string | | |
| acceptance_rate_min | gte.acceptance_rate | number | | |

---

## 4) عرض النتائج: Cards + Pacing + التزامن + تعديل الفلاتر

### A) Cards Rendering

| السؤال | الإجابة |
|--------|---------|
| Sequential أم batch؟ | **Batch** — يتم جلب كل النتائج دفعة واحدة (limit=12 default) وعرضها مرة واحدة |
| من يقرر pacing_ms و max_cards؟ | **Portal يقرر limit** (12 default في `useCardsQuery.ts:102`, 24 في `normalizeProgramFilters.ts:186`). **لا يوجد pacing/animation** — كل البطاقات تظهر دفعة واحدة |
| ما يظهر أثناء الانتظار؟ | رسائل loading **محلية ثابتة**: `"ملاك يفكر..."` (status=thinking) أو `"أبحث عن أنسب الجامعات لك..."` (status=searching) في `AIChatPanel.tsx:154-176` |
| cards_plan من CRM؟ | **لا يوجد cards_plan** — Portal لا يستقبل أي تعليمات عن pacing أو ترتيب العرض من CRM |

### B) Filter Change Lifecycle

#### سيناريو 1: المستخدم يغير فلتر في UI Search

```
User changes filter → URL state updates → useProgramSearch re-fetches
→ normalizeProgramFilters() → student-portal-api/search_programs
→ Results re-render
→ NO ACK (هذا مسار UI مستقل عن البوت)
→ NO new query_id
```

#### سيناريو 2: البوت يرسل cards_query

```
CRM Response → computeNextState() checks:
  - cards_query.query_id exists? ✅
  - ui_directives.search_mode === "start"? ✅
→ useCardsQuery.fetchCards(query)
  - Stale check (sequence > lastSequence)
  - Contract validation (FAIL-CLOSED)
  - fetch → search-programs
→ Results render
→ sendACK('cards_rendered', { query_id, sequence, count })
→ NEW query_id ✅ (from CRM)
```

#### سيناريو 3: المستخدم يختار بطاقة program

```
User clicks heart → shortlistAdd(program_id)
→ student-portal-api/shortlist_add
→ Navigate to /account?tab=shortlist
→ NO new search
→ NO ACK (unless shortlist_toggled ACK is configured)
```

#### سيناريو 4: User types in chat → implicitly changes search

```
User message → sendChatMessage → CRM processes
→ CRM may return NEW cards_query with new params
→ Portal checks shouldTriggerSearch() again
→ If search_mode === "start" → new search with new query_id
→ ACK after render
```

---

## 5) نقاط الغباء والبطء (Top 10 — بدون إصلاح)

### Stupidity Drivers (سلوك غبي)

| # | المكان | الوصف | الأثر |
|---|--------|-------|-------|
| S1 | `AIChatPanel.tsx:56-74` | **handleSend يرد بنص ثابت mock** — `"شكراً لك! سأساعدك..."` بدلاً من إرسال الرسالة للبوت الحقيقي | المستخدم لا يتلقى رد حقيقي من CRM! |
| S2 | `normalizeProgramFilters.ts:55-56` | **يقبل aliases مثل `q`, `query`** في UI path لكن Bot path يرفضها (BLOCKED_KEYWORD_SET). تناقض بين المسارين | ارتباك + 0 results إذا CRM أرسل `q` بدل `keyword` |
| S3 | `useCardsQuery.ts:97` vs `portalApi.ts:441` | **مسارا بحث مختلفان** — Bot يستخدم `search-programs` (Edge مباشر) و UI يستخدم `student-portal-api` (action wrapper). أي bug fix يجب تطبيقه في مكانين | Inconsistent behavior بين bot search و manual search |
| S4 | `gateway.ts:402-436` | **Mock CRM response hardcoded لتركيا** — حتى لو المستخدم سأل عن روسيا، Mock يرد بتركيا | Dev confusion |
| S5 | `state.ts:156-192` | **shouldTriggerSearch يرفض أي search بدون `ui_directives.search_mode === "start"`** — لكن CRM قد يرسل `search_mode` في root level وليس في `ui_directives` | CRM يطلب بحث → Portal يرفض → 0 results |

### Latency Drivers (بطء)

| # | المكان | الوصف | الأثر |
|---|--------|-------|-------|
| L1 | `gateway.ts:304` | **Sequential auth check** — `await supabase.auth.getSession()` قبل كل request. غير ممكن تخزينها مؤقتاً لأن token قد ينتهي | +50-150ms per chat message |
| L2 | `useMalakAssistant.tsx:195` | **sendChatMessage هو round-trip كامل** (Portal → Edge → CRM → Edge → Portal) ثم **search هو round-trip ثاني** (Portal → Edge → DB → Edge → Portal) | Two sequential network waterfalls لكل رد بوت مع بحث |
| L3 | `useCardsQuery.ts:92-103` | **Bot search يستخدم fetch() مباشرة بدون caching** — لا react-query، كل بحث جديد = network call | لا يوجد cache hit حتى لو نفس الفلاتر |
| L4 | `Universities.tsx:148,163` | **Events و Scholarships tabs تستخدم fetch() مباشرة** (بدون react-query wrapper) | لا caching، كل tab switch = full refetch |
| L5 | `useStreamingChat.ts:136-146` | **Streaming path يبني envelope كامل + JSON.parse + JSON.stringify** على كل request | ~5ms wasted serialization overhead |

---

## 6) Evidence Pack

### Scenario: "طب بشري روسيا، ميزانية 6000، سكن مهم"

> ⚠️ **لا يمكن تنفيذ هذا السيناريو حالياً** لأن:
>
> 1. `AIChatPanel.tsx:56-74` — **handleSend يرد بنص ثابت** ولا يرسل للبوت الحقيقي (S1 أعلاه)
> 2. لا يوجد CRM credentials مُعدّة في البيئة الحالية
>
> **ما كان سيحدث لو كان مُعدّاً:**

#### Expected Flow

```
1. User → "طب بشري روسيا، ميزانية 6000، سكن مهم"

2. REQUEST: POST portal-chat-proxy
   Headers:
     Content-Type: application/json
     Authorization: Bearer <supabase_jwt>  (authenticated)
     x-orxya-ingress: portal
     x-client-trace-id: <uuid>
   Body (EnvelopeV12):
     {
       envelope_type: "chat_message",
       version: "1.2",
       channel: "web_portal",
       session_type: "authenticated",
       payload: {
         type: "message",
         message: "طب بشري روسيا، ميزانية 6000، سكن مهم",
         text: "طب بشري روسيا، ميزانية 6000، سكن مهم",
         session_id: "<stable_id>",
         visitor_id: "<uuid>",
         entry_fn: "portal-chat-ui",
         client_build: "portal-<BUILD_ID>",
         channel: "web_portal",
         session_type: "authenticated",
         ui_context: { route: "/", page: "home", tab: null, lang: "ar" },
         client_capabilities: { cards: true, supports_tables: false, ... }
       }
     }

3. RESPONSE from CRM (expected):
   {
     ok: true,
     reply: "وجدت لك برامج طب بشري في روسيا...",
     ui_directives: { search_mode: "start" },
     cards_query: {
       query_id: "cq_<hash>",
       sequence: 1,
       params: {
         country_code: "RU",
         discipline_slug: "medicine",
         tuition_usd_max: 6000,
         has_dorm: true
       }
     },
     state: "idle"
   }

4. STATE MACHINE: shouldTriggerSearch() → true
   (search_mode=start + query_id present)

5. SEARCH REQUEST: POST search-programs
   Headers:
     Content-Type: application/json
     Authorization: Bearer <anon_key>
     x-orxya-ingress: portal
   Body:
     {
       params: {
         country_code: "RU",
         discipline_slug: "medicine",
         tuition_usd_max: 6000,
         has_dorm: true
       },
       limit: 12,
       page: 1
     }

6. SEARCH RESPONSE:
   {
     items: [...12 programs...],
     total: 47,
     next_page_token: "2"
   }

7. RENDER: 12 cards displayed

8. ACK REQUEST: POST portal-chat-proxy
   Body (EnvelopeV12):
     {
       envelope_type: "render_receipt",
       payload: {
         type: "ack",
         ack_name: "cards_rendered",
         ack_ref: { query_id: "cq_<hash>", sequence: 1 },
         ack_success: true,
         ack_metadata: { count: 12, program_ids: [...] },
         ack_id: "cards_rendered:cq_<hash>:1"
       }
     }
```

---

## 7) تعريف واضح: ما الذي سيعتمد عليه البوت لاحقًا

### هل Portal مجرد renderer + kb tool + ui_context emitter؟

**نعم — بشكل شبه كامل.**

| الوظيفة | Portal يفعل؟ | الدليل |
|---------|-------------|--------|
| عرض نص الرد | ✅ Renderer | `parseReply()` in `response.ts` — يعرض ما يأتي من CRM |
| بحث البرامج | ✅ KB Tool | `useCardsQuery` + `search-programs` — ينفذ `cards_query.params` فقط |
| إرسال ui_context | ✅ Emitter | `buildUiContextV1()` — route, tab, lang |
| إرسال ACK | ✅ Emitter | `useACKSender` — cards_rendered, shortlist_toggled |
| إنتاج منطق رد/توصية محلياً | **❌ لا** | لا يوجد أي LLM call أو recommendation logic في Portal |
| تحديد الفلاتر | **❌ لا** | Portal يأخذ `cards_query.params` كما هو من CRM ويمرره |
| تقرير البحث (search_mode) | **❌ لا** | Portal ينتظر `ui_directives.search_mode === "start"` من CRM |

### الاستثناء الوحيد

`AIChatPanel.tsx:56-74` — الـ `handleSend` الحالي يحتوي على **رد mock ثابت** يتجاوز البوت بالكامل. هذا يعني أن الشات الرئيسي في الصفحة الرئيسية **لا يتصل بالبوت أصلاً** — يرد بنص ثابت.

هذا ليس "منطق توصية" بل **placeholder لم يُربط بعد**.

---

## ملخص الاكتشافات الحرجة

| # | الاكتشاف | الخطورة |
|---|----------|---------|
| 🔴 | `AIChatPanel.tsx` لا يتصل بالبوت الحقيقي — يرد بنص ثابت | **Critical** |
| 🟡 | مسارا بحث مختلفان (Bot vs UI) مع Edge Functions مختلفة | **Medium** |
| 🟡 | `shouldTriggerSearch` يرفض root-level `search_mode` | **Medium** |
| 🟢 | Streaming مُعدّ لكن لا يُفعّل تلقائياً (يحتاج `?forceStream=1`) | **Low** |
| 🟢 | Bot search لا يستخدم react-query (لا caching) | **Low** |
