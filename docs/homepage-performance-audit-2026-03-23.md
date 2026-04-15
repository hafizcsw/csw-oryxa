# Homepage performance forensic audit — 2026-03-23

## Scope and method

This audit covered the four required lanes inside the Portal / website repo only:

1. Top-right bot / review mode lane.
2. Navigation / telemetry / broadcast lane.
3. PWA / Workbox / service worker lane.
4. Homepage architecture lane.

I inspected the homepage, app shell, chat/review wiring, telemetry helpers, map/home data hooks, and PWA config. I also attempted runtime verification against `https://cswworld.com/`, but direct HTTP access from this environment was blocked by `403 Forbidden`, so production-network confirmation is partially constrained.

---

## 1. Executive snapshot

### Ranked causes of homepage slowness

1. **Homepage-heavy architecture is the most likely primary cause.**
   The homepage mounts a very large interactive hero/chat surface plus the world map plus many content sections at once, and it also kicks off multiple parallel Supabase reads and map/chat initialization work on first render. The homepage is doing too much before the user asks for it.

2. **The hero/chat stack is a major first-load and background-load contributor.**
   `HeroSection` mounts the full `MalakChatInterface`, `DeepSearchLayout`, compare UI, news ticker queries, and chat telemetry/hooks on the homepage immediately, not lazily after intent. That means the homepage pays for chat infrastructure even before a user starts chatting.

3. **The world map lane is a major first-load contributor and can become a larger post-load/navigation contributor.**
   `WorldMapSection` immediately loads country metadata and country summary RPC data, while `WorldMapLeaflet` loads Leaflet CSS/JS, remote marker assets, and world GeoJSON from GitHub. That is a mix of JS cost, layout cost, remote fetches, and map rendering work.

4. **Navigation + telemetry + page-view wiring is a meaningful background request contributor, with duplicate / fragmented tracking paths.**
   The app globally installs `useVisitorTracker`, `useNavigationTracker`, Web Vitals, `Index` page view logging, and several telemetry helpers that use different storage keys and different backends. This is unlikely to be the biggest *render* blocker, but it can clearly create excessive requests and noise.

5. **Workbox / PWA is a plausible partial contributor, but the code does not prove homepage-triggered eager loading of unrelated route chunks by itself.**
   The current `vite-plugin-pwa` config can absolutely enlarge service-worker precache scope after build/install, but based on code alone it does **not** prove that unrelated route chunks are eagerly downloaded on the first uncached homepage request. It remains a strong suspicion for repeat visits / update flows and cache churn, not the clearest first-load root cause from source alone.

6. **Top-right bot / review mode is not cleared; it is a partial contributor and still operationally suspicious, but not the strongest direct first-load bottleneck.**
   The button itself is lightweight, but the surrounding review-mode system has serious contradictions: it force-seeds a test phone, exposes the control broadly, logs in production, and uses the wrong localStorage key for tracking disable checks. That means it can fail to suppress telemetry when users think it is suppressing telemetry. So it is **not primary**, but it is **not unrelated**.

### Status of the top-right bot / review system

**Conclusion: partial contributor.**

Why not primary:
- The header button/dropdown itself is not doing heavy network work on mount.
- The biggest first-load costs come from homepage chat + map + broad data fetching.

Why not cleared:
- The review-mode disable helper reads `review_mode`, while the context persists `csw_review_mode`, so “quiet / no_ui” may fail to disable analytics/telemetry paths that rely on the helper.
- `Layout.tsx` force-writes a test phone to localStorage on import, which keeps the review control under active suspicion because it changes gating behavior for real users.
- Multiple analytics/chat systems do not all consult the same review-mode source of truth.

---

## 2. Code truth by lane

### A) Top-right bot / review system

#### Files / code paths
- `src/components/layout/Layout.tsx`
- `src/contexts/ReviewModeContext.tsx`
- `src/lib/reviewModeHelper.ts`
- Secondary effects through:
  - `src/hooks/useNavigationTracker.ts`
  - `src/hooks/useVisitorTracker.ts`
  - `src/hooks/useBotTelemetry.tsx`
  - `src/lib/telemetry.ts`
  - `src/lib/chat/telemetry.ts`
  - `src/lib/vitals.ts`
  - `src/hooks/useMalakAssistant.tsx`

#### What the code actually does
- `Layout.tsx` defines `TEST_PHONE_NUMBERS`, reads phone values from localStorage, and exposes the review-mode bot button when the user is admin **or** the stored phone matches a test number.
- `Layout.tsx` also calls `forceTestPhoneIfNeeded()` at module scope, and that function writes `+966598792925` into localStorage when no phone exists. That means review-mode access is effectively widened by default in the browser unless another phone already exists.
- `ReviewModeContext.tsx` persists mode under `csw_review_mode` and exposes `normal`, `quiet`, and `no_ui` plus client capabilities.
- `reviewModeHelper.ts` reads **`review_mode`**, not `csw_review_mode`.

#### How this lane can create slowness / traffic
- **Direct UI/render cost:** low.
- **Indirect request cost:** medium, because many telemetry systems call `isTrackingDisabled()`, and that helper is checking the wrong key. If a reviewer toggles quiet/no_ui expecting fewer requests, tracking may continue anyway.
- **Operational/debug noise:** medium-high, because `Layout.tsx` always logs review-gate details in production and mutates localStorage on import.

#### Key contradiction
- Context writes `csw_review_mode`; helper reads `review_mode`. That is the clearest stale/mismatched wiring in the audit.

### B) Navigation / telemetry / broadcast lanes

#### Files / code paths
- `src/App.tsx`
- `src/hooks/useNavigationTracker.ts`
- `src/hooks/useVisitorTracker.ts`
- `src/hooks/useBotTelemetry.tsx`
- `src/lib/telemetry.ts`
- `src/lib/decisionTracking.ts`
- `src/lib/chat/gateway.ts`
- `src/lib/chat/telemetry.ts`
- `src/pages/Index.tsx`
- `src/lib/vitals.ts`

#### What the code actually does
- `App.tsx` installs `useVisitorTracker()` globally and also installs `useNavigationTracker(sessionId)` globally.
- `useVisitorTracker()` sends `trackPageView()` on initial load and on SPA navigation by intercepting `pushState`, `replaceState`, and `popstate`.
- `useNavigationTracker()` sends `ui_navigate` through `sendChatEvent()` on route changes after the initial route.
- `Index.tsx` also sends its own homepage `page_view` via `supabase.functions.invoke('log-event')` on mount.
- `initWebVitals()` runs at app bootstrap and later inserts web-vital records.
- `useBotTelemetry()` logs bot lifecycle events to `telemetry-capture`.
- `telemetry.ts`, `analytics.ts`, `chat/telemetry.ts`, and `decisionTracking.ts` all send events through different paths and do not use a single identity key or backend consistently.

#### How this lane can create slowness / traffic
- **Initial load:** not usually the main CPU blocker, but it does add multiple background event sends and local/session storage reads during first render.
- **Post-load/background:** high likelihood. There are overlapping event systems: `page_view`, `ui_navigate`, bot telemetry, portal telemetry, and web-vitals.
- **Navigation:** clearly affected. SPA navigations trigger both decision tracking and `ui_navigate` logic.
- **Risk of duplication / fragmentation:** high, because there are at least three visitor ID conventions in use (`visitor_id`, `csw_visitor_id`, `malak_visitor_id`) and more than one “page view” path.

#### Important code truths
- `useNavigationTracker()` uses `isNormal` from context, so it obeys the context state.
- `decisionTracking.ts`, `telemetry.ts`, `chat/telemetry.ts`, and `vitals.ts` use `isTrackingDisabled()` from the mismatched helper, so review-mode suppression may fail there.
- `Index.tsx` logs a homepage page view even though `useVisitorTracker()` already tracks page views globally. That is strong evidence of duplicate homepage request generation.

### C) PWA / Workbox / service worker

#### Files / code paths
- `vite.config.ts`
- `src/components/layout/GlobalTopBar.tsx`
- `src/hooks/useSwUpdateBadge.ts`

#### What the code actually does
- `vite.config.ts` enables `VitePWA` with `registerType: 'autoUpdate'`, broad `globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']`, and runtime caching for Supabase storage URLs.
- `cleanupOutdatedCaches`, `skipWaiting`, and `clientsClaim` are all enabled.
- `GlobalTopBar.tsx` includes a force-refresh path that aggressively unregisters service workers, clears Cache Storage, clears workbox-ish localStorage keys, fetches with `cache: 'reload'`, and hard-reloads the page.

#### How this lane can create slowness / traffic / cache issues
- **Initial uncached homepage load:** possible but not yet proven as primary from code alone.
- **Repeat visits / updated builds:** medium-high suspicion. Broad precache patterns and auto-update behavior can produce large install/update work and cache churn.
- **Excess requests:** possible during service-worker update checks and cache revalidation.
- **Unrelated route chunks on homepage:** still plausible after build because Workbox precache may include many emitted assets, but I could not confirm the generated manifest because the local environment lacks an installed Vite binary and production runtime fetches were blocked.

#### What is proven vs not proven
- **Proven:** PWA is enabled with broad globbing and aggressive SW lifecycle settings.
- **Not proven from source alone:** that homepage definitely downloads every unrelated lazy-route chunk on first paint.

### D) Homepage architecture

#### Files / code paths
- `src/pages/Index.tsx`
- `src/components/home/HeroSection.tsx`
- `src/components/chat/MalakChatInterface.tsx`
- `src/contexts/MalakChatContext.tsx`
- `src/components/home/WorldMapSection.tsx`
- `src/components/home/WorldMapLeaflet.tsx`
- `src/hooks/useMapData.ts`
- `src/hooks/useOsmCityOverlay.ts`
- `src/lib/data.home.ts`
- `src/components/FloatingChat.tsx`

#### What the code actually does
- `Index.tsx` loads the full hero, full interactive world map, and many more homepage sections on first render.
- On mount, `Index.tsx` performs `Promise.all` over **eight** home data calls: settings, icons, countries, testimonials, posts, footer links, degrees, and certificate types.
- `HeroSection.tsx` mounts the full `MalakChatInterface` immediately and also runs one `feature_settings` query for the ticker plus a second `translate-ticker` function call when language is not English.
- `WorldMapSection.tsx` immediately runs a `country-meta` query and `rpc_map_country_summary`. Later drill-downs add city/university/OSM calls.
- `WorldMapLeaflet.tsx` imports Leaflet CSS/JS, fetches world GeoJSON from GitHub, and points marker icons to unpkg CDN assets.
- `MalakChatContext.tsx` loads lots of localStorage state, subscribes to `supabase.auth.onAuthStateChange`, runs an initial `supabase.auth.getSession()`, and manages idle/session logic globally.
- `FloatingChat.tsx` is also part of the global shell outside admin/apply/maintenance routes, so the homepage has both the in-hero standalone chat experience and the floating-chat machinery in the app shell.

#### How this lane can create slowness / traffic / blocking
- **Initial load:** very high. This is the strongest lane.
- **Post-load/background:** high, due to auth/session checks, telemetry, and chat/map side systems.
- **Navigation:** medium, because some heavy homepage modules remain part of the route tree and chat context remains global.
- **CPU/render pressure:** high, from interactive hero chat + map rendering + large carousels/content sections.
- **Network pressure:** high, from parallel homepage data reads, ticker translation, map RPCs, GeoJSON fetch, tile/icon CDN loads, and telemetry.

---

## 3. Runtime suspicion model

### Review Mode / top-right bot lane
- **Initial homepage load:** low direct impact; partial indirect impact from gating/logging/localStorage mutation.
- **Idle/background traffic:** medium because review-mode suppression is mismatched and may not actually suppress helper-based trackers.
- **Route navigation only:** low direct impact.
- **Preview only:** no; the force-test-phone and key mismatch are production-path code.
- **Production:** yes.

### `ui_navigate` / navigation broadcast lane
- **Initial homepage load:** low, because the tracker intentionally skips the first route.
- **Idle/background traffic:** medium-low.
- **Route navigation only:** high. This lane mainly fires after route/tab changes.
- **Preview only:** no.
- **Production:** yes.

### Telemetry / decision tracking lane
- **Initial homepage load:** medium. Initial page view + web vitals + home page mount telemetry happen quickly.
- **Idle/background traffic:** high. Heartbeats, bot telemetry, page views, and other event logging accumulate.
- **Route navigation only:** medium-high because SPA nav is tracked.
- **Preview only:** no.
- **Production:** yes.

### Workbox / service worker lane
- **Initial homepage load:** medium but unproven as the top issue.
- **Idle/background traffic:** medium-high, especially around updates / cache churn.
- **Route navigation only:** low-medium.
- **Preview only:** no.
- **Production:** yes.

### HeroSection lane
- **Initial homepage load:** very high.
- **Idle/background traffic:** medium-high due to ticker + chat ecosystem.
- **Route navigation only:** low unless user returns to home.
- **Preview only:** no.
- **Production:** yes.

### WorldMapSection / WorldMapLeaflet lane
- **Initial homepage load:** very high.
- **Idle/background traffic:** medium, growing to high after drill-down due to more RPC/overlay/tile fetches.
- **Route navigation only:** low unless user navigates to home or interacts with the map.
- **Preview only:** no.
- **Production:** yes.

### Other homepage-heavy lanes
- Destination carousel images, testimonials, content sections, and footer data are all lower than hero/map individually, but together they widen initial network and render cost.

---

## 4. Critical contradictions and stale wiring

1. **Review mode storage-key mismatch**
   - Source of truth context key: `csw_review_mode`.
   - Helper key used by telemetry/vitals/etc.: `review_mode`.
   - Result: quiet/no_ui can look enabled in UI while helper-based trackers still behave as normal.

2. **Forced test-phone seeding in production path**
   - `forceTestPhoneIfNeeded()` runs at module scope in `Layout.tsx`.
   - It writes `malak_last_phone_input = '+966598792925'` whenever no phone exists.
   - Result: the review-mode control may be exposed far beyond intended testers, and the homepage mutates storage on import.

3. **Review-mode semantics are fragmented**
   - `useNavigationTracker()` obeys context `isNormal`.
   - `useBotTelemetry()` obeys context `isQuiet || isNoUI`.
   - `telemetry.ts`, `decisionTracking.ts`, `chat/telemetry.ts`, and `vitals.ts` obey the helper with the wrong key.
   - Result: some tracking lanes stop, others keep sending.

4. **Duplicate homepage page-view logic**
   - `useVisitorTracker()` already tracks page views globally.
   - `Index.tsx` manually invokes `log-event` with `page_view` again on mount.
   - Result: homepage can emit duplicate page-view traffic.

5. **Visitor identity fragmentation**
   - General analytics uses `visitor_id`.
   - Decision tracking uses `csw_visitor_id` and `csw_session_id`.
   - Chat uses `malak_visitor_id` and `malak_session_id`.
   - Result: request volume is harder to deduplicate and diagnose, and “same visitor” behavior can be split across lanes.

6. **Homepage contains two chat lanes at once**
   - Hero mounts standalone `MalakChatInterface`.
   - App shell also mounts `FloatingChat` on homepage routes unless hidden by mobile conditions.
   - Result: even if floating chat stays visually closed, the homepage still carries extra chat-shell logic in the global app frame.

7. **Production console logging remains active in sensitive paths**
   - `Layout.tsx` logs review-mode check unconditionally.
   - Chat/auth/context code logs heavily outside strict dev-only guards.
   - Result: small but real CPU/noise cost and harder field debugging.

---

## 5. Evidence-backed ranking of requested suspects

### 1) HeroSection — **Very high suspicion**
- Immediate chat UI mount on homepage.
- Immediate ticker query and conditional translation call.
- Pulls in large chat stack (`MalakChatInterface`, compare, debug overlay, deep-search layout).
- Strong candidate for both CPU/render cost and request cost.

### 2) WorldMapSection / WorldMapLeaflet — **Very high suspicion**
- Immediate country metadata + country summary calls.
- Leaflet runtime, CSS, remote GeoJSON, remote marker assets, map setup, resize observers, and rendering cost.
- Strong candidate for slow initial homepage and ongoing map-specific requests.

### 3) Workbox precache / service worker — **Medium-high suspicion**
- Strong suspicion for repeat-visit/update/cache bloat behavior.
- Not yet proven as the top first-load cause.
- Needs generated SW manifest inspection or browser-network capture to confirm unrelated chunk precache behavior.

### 4) Telemetry / decision tracking — **Medium-high suspicion**
- Multiple overlapping event systems.
- Duplicate homepage page-view path.
- Can definitely cause excessive background requests and muddy diagnostics.

### 5) Review Mode / top-right bot — **Medium suspicion / partial contributor**
- Not the main render bottleneck.
- Still suspicious because it fails to reliably disable helper-based tracking and widens tester access through forced test-phone storage writes.
- It should not be blamed for the entire homepage problem, but it should not be cleared yet as an operational contributor.

### 6) `ui_navigate` / navigation broadcast — **Medium suspicion, mostly route-navigation scoped**
- Important for route-change request volume.
- Not the best match for *initial homepage* slowness because it skips first route and only fires after navigation changes.

### 7) Other homepage-heavy lanes — **Medium suspicion collectively**
- `Index.tsx` parallel `Promise.all` data fetching and many sections widen first-load cost.
- Carousels, images, and content sections matter, but hero/map are still stronger suspects.

---

## 6. Bottom-line diagnosis

### Most likely real ranked causes
1. **Homepage-heavy architecture, especially immediate chat hero + world map.**
2. **World map runtime and remote assets/fetches.**
3. **Hero/chat stack and its supporting context/session/telemetry work.**
4. **Fragmented telemetry/page-view duplication causing excessive post-load requests.**
5. **Workbox/service-worker cache/update behavior, likely more important on repeat visits than cold load.**
6. **Top-right review-mode lane as a partial contributor because it does not reliably suppress tracking and introduces stale/debug/test behavior into production paths.**

### Clear statement on the top-right bot/review system
- **Primary cause?** No.
- **Partial contributor?** Yes.
- **Unrelated?** No.
- **Still inconclusive in some runtime aspects?** Yes — especially how often real sessions expose/toggle it and whether production users are unintentionally hitting quiet/no_ui while helper-based trackers continue anyway.

---

## 7. Minimal next-step test plan

These are the smallest runtime tests needed to close the remaining uncertainty without premature patching.

### Test 1 — Homepage network waterfall split by lane
Open a fresh browser profile with caches disabled and record the homepage waterfall.

Do **three** runs:
1. baseline production home,
2. home with service worker unregistered and caches cleared,
3. home with hero chat temporarily blocked via DOM/component flag in local repro.

What this closes:
- whether hero/chat or SW is dominating initial requests,
- whether repeat-visit cache behavior is materially worse than cold load.

### Test 2 — Review-mode suppression truth test
In production-like runtime:
1. clear localStorage,
2. load home,
3. inspect whether `malak_last_phone_input` is auto-seeded,
4. switch review mode to `quiet`,
5. trigger homepage interactions and SPA navigation,
6. verify whether `log-event`, `telemetry-capture`, `events` inserts, and `ui_navigate` actually stop.

What this closes:
- whether the top-right control is really suppressing traffic,
- whether the storage-key mismatch is causing false confidence.

### Test 3 — Duplicate page-view test
Load homepage once and verify whether two separate page-view style events are emitted:
- one from `useVisitorTracker` / `decisionTracking`,
- one from `Index.tsx` direct `log-event` call.

What this closes:
- confirmed duplicate homepage event traffic.

### Test 4 — Workbox generated manifest test
Build locally or in CI, inspect generated `dist/sw.js` / Workbox manifest, and list exactly which route chunks are precached.

What this closes:
- whether unrelated lazy page chunks are precached and downloaded around homepage load.

### Test 5 — Hero vs map isolation timing
Using a local profiling build, capture these four timings:
1. home as-is,
2. hero disabled,
3. map disabled,
4. both disabled.

What this closes:
- rank ordering between hero/chat and world map as first-load blockers.

---

## 8. Audit confidence / limitations

### High confidence
- Homepage-heavy architecture is the main problem class.
- Hero/chat and world map are the strongest direct initial-load suspects.
- Telemetry/page-view wiring is fragmented and likely causing excessive background requests.
- Review-mode wiring is contradictory and cannot be trusted as a clean “disable tracking” control today.

### Remaining uncertainty
- Exact Workbox precache contents for the deployed build.
- Exact production waterfall proportions for first load vs repeat visit.
- Exact real-world request counts from the deployed homepage because direct runtime access from this environment was blocked.

