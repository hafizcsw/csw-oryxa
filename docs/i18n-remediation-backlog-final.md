# i18n Remediation Backlog — Final Merged Backlog

## Executive snapshot

This document is the final merged remediation backlog for Portal i18n/localization issues identified across the earlier phases, now normalized with the code-evidence delta from `docs/i18n-codebase-compliance-sweep.md`.

It is **not** a new audit and **not** a fixes document. It is an execution backlog that merges Phase 1, Phase 2, Phase 3, and Phase 4 findings into a single root-cause-driven plan, while absorbing the latest code-evidence-only sweep.

The backlog is intentionally deduplicated:
- root causes are listed once;
- inherited surfaces are attached to a root cause instead of being restated as separate roots;
- high-visibility shell issues from Phase 1/2 remain included in the final execution plan;
- compare architecture split remains the highest-priority root cause;
- the compliance sweep is used only to normalize classification, scope, and ownership wording inside existing clusters unless a new file clearly could not be absorbed cleanly.

Accepted fixed points from the review process:
- Compare architecture split is the **P0** root cause.
- `SearchResultsPanel` remains **provisional major** until runtime verification is completed.
- `continentMapping` remains **watch / high-minor**.
- `Country.tsx` is valid but lower risk than compare/wallet/global-shell issues.
- `ProgramDetails` / `UniversityDetails` locale-prefix + canonical drift remains confirmed **P1**.
- Nothing in this backlog is runtime-proven; remediation and closure remain separate from audit evidence.

---

## Final root-cause clusters

### Cluster A — Compare architecture split and duplicate compare state/contracts

**Classification:** architecture fallback  
**Priority:** P0

**Root cause**

The compare feature is implemented through parallel architectures instead of a single contract:
- legacy page compare path;
- newer Facts/API compare path;
- old compare selection store;
- new compare basket store;
- chat handoff layer attached on top of the basket flow.

This is the highest-priority root cause because the issue is structural and inherited by multiple visible surfaces.

**Cluster → files mapping**
- `src/pages/Compare.tsx`
- `src/hooks/useComparePrograms.ts`
- `src/hooks/useCompare.ts`
- `src/hooks/useCompareBasket.ts`
- `src/stores/compareStore.ts`
- `src/stores/compareBasketStore.ts`
- `src/components/compare/CompareDrawer.tsx`
- `src/components/compare/CompareFloatingBar.tsx`
- `src/components/compare/CompareHeartButton.tsx`
- `src/components/CompareFloatingButton.tsx`
- `src/components/CompareButton.tsx`
- `src/pages/Universities.tsx`
- `src/lib/portalApi.ts`

**Cluster → must-fix-together set**
- unify compare selection state source;
- unify compare data-fetch contract;
- remove legacy page-vs-drawer behavior split;
- align compare → chat handoff with the same canonical compare payload;
- remove locale hardcoding inside compare surfaces after contract unification.

**Inherited surfaces attached to this cluster**
- standalone compare page;
- compare drawer;
- compare floating bar/button and compare heart affordances;
- universities/programs compare entry flow;
- compare-to-chat handoff;
- compare toast/warning/empty/loading states.

---

### Cluster B — Global shell localization is not fully contract-driven

**Classification:** component wiring  
**Priority:** P1

**Root cause**

Shared high-visibility shell surfaces still mix translation-backed behavior with hardcoded text, hardcoded defaults, and component-local display decisions.

This is the primary merged Phase 1/2 cluster and must stay in the final backlog because it affects the application shell before a user even reaches deeper content surfaces.

**Cluster → files mapping**
- `index.html`
- `src/i18n/useHtmlLangDir.ts`
- `src/components/LanguageToggle.tsx`
- `src/components/layout/GlobalTopBar.tsx`
- `src/components/layout/Layout.tsx`
- `src/components/layout/WalletHeaderWidget.tsx`
- `src/components/CurrencySelector.tsx`
- `src/contexts/CurrencyContext.tsx`
- `src/App.tsx`
- `src/hooks/useVisitorTracker.ts`
- `src/components/chat/ChatHistorySidebar.tsx`

**Cluster → must-fix-together set**
- bootstrap locale defaults (`html lang`, `dir`, page bootstrap assumptions);
- top-level shell controls (language, currency, global top bar, wallet header);
- shell-level fallback semantics that bias one locale or one display mode globally;
- shared shell behavior that is visible on most routes;
- shell/history surfaces that still embed direct user-facing bilingual copy.

**Inherited surfaces attached to this cluster**
- `index.html` bootstrap defaults;
- `LanguageToggle` hardcoded English copy and static accessibility labels;
- `GlobalTopBar` as shared shell control strip;
- `WalletHeaderWidget` as a high-visibility layout surface with Arabic hardcoding;
- `CurrencyContext` defaulting/fallback behavior as part of the shell surface, with formatter-policy execution split further in Cluster F;
- `CurrencySelector` shell presentation;
- `ChatHistorySidebar` as a shell/history navigation surface with hardcoded date labels and CTA states;
- `useVisitorTracker` as app-wide behavior attached in `App.tsx`.

---

### Cluster C — UI-level locale fallback ladders instead of one enforced display policy

**Classification:** architecture fallback  
**Priority:** P1

**Root cause**

Many components and shared localization helpers still decide display locale by local fallback ladders (`current locale → other locale → raw field`) instead of using one enforced display adapter contract.

This creates drift between the active UI locale, data locale, SEO locale, and fallback field order.

**Cluster → files mapping**
- `src/components/shortlist/ShortlistDrawer.tsx`
- `src/pages/Country.tsx`
- `src/pages/Countries.tsx`
- `src/pages/Compare.tsx`
- `src/components/layout/WalletHeaderWidget.tsx`
- `src/components/compare/CompareDrawer.tsx`
- `src/lib/localization/displayAdapter.ts`
- `src/hooks/useLocalizedField.ts`
- `src/hooks/useLocalizedContent.ts`
- `src/hooks/useDeterministicLocalizer.ts`

**Cluster → must-fix-together set**
- define one canonical display-resolution policy for program / university / country / degree labels;
- keep `_ar` / `_en` support as legacy compatibility only, not as the active display architecture;
- remove per-component fallback ladders for visible names;
- align shared localization helpers (`displayAdapter`, `useLocalizedField`, `useLocalizedContent`, `useDeterministicLocalizer`) behind the same display contract;
- stop letting high-visibility surfaces each choose their own locale fallback order.

**Inherited surfaces attached to this cluster**
- shortlist drawer;
- wallet header widget;
- compare page/drawer copy and display logic where locale fallback and visible labels are co-located;
- country and countries listing surfaces;
- shared display adapters/hooks that still normalize around legacy `_en` / `_ar` paths;
- deterministic localizer behavior that currently treats Arabic as the only special supported localized output path.

---

### Cluster D — Route locale, canonical URL, and hreflang policy are page-local instead of centralized

**Classification:** component wiring  
**Priority:** P1

**Root cause**

Route-local pages and inherited card/navigation surfaces compute locale prefix, canonical URL, and alternate links individually from local runtime state. That means locale SEO and deep-link behavior can drift unless all pages and route-entry components follow identical rules forever.

This remains a confirmed P1 root cause.

**Cluster → files mapping**
- `src/pages/ProgramDetails.tsx`
- `src/pages/UniversityDetails.tsx`
- `src/pages/Universities.tsx`
- `src/components/UniversityCard.tsx`
- `src/components/routing/LocaleRouteWrapper.tsx`
- `src/components/seo/SEOHead.tsx`
- `src/App.tsx`

**Cluster → must-fix-together set**
- one central rule for locale-prefixed path generation;
- one central rule for canonical URL generation;
- one central rule for hreflang generation;
- route wrapper and page SEO helpers must follow the same contract;
- inherited two-locale route-prefix behavior from cards/breadcrumbs must be removed from component-local code.

**Inherited surfaces attached to this cluster**
- program details pages;
- university details pages;
- universities/search page SEO;
- locale-prefixed route navigation from cards and breadcrumbs;
- `UniversityCard` route generation and any similar card-level two-locale path assumptions;
- SEO helper usage that currently permits page-local canonical/hreflang drift.

---

### Cluster E — Discovery/search localization semantics are inconsistent across discovery surfaces

**Classification:** component wiring  
**Priority:** P2

**Root cause**

Search/discovery surfaces do not all share the same localization/search semantics. Some surfaces search across Arabic and English fields in-memory; other surfaces query direct views using a single field and fixed sort behavior; chat/discovery panels also still embed bilingual UI states directly in component code.

**Cluster → files mapping**
- `src/pages/Countries.tsx`
- `src/lib/search-api.ts`
- `src/pages/Universities.tsx`
- `src/pages/Country.tsx`
- `src/components/chat/SearchResultsPanel.tsx`
- `src/components/chat/ChatHistorySidebar.tsx`

**Cluster → must-fix-together set**
- align bilingual/multilingual search behavior across discovery surfaces;
- align sorting semantics with active locale expectations;
- align country → universities/programs handoff with localized route and filter behavior;
- remove hardcoded bilingual no-results/loading/panel/history states from chat/discovery-side surfaces;
- align discovery-side date/relative-time labeling with the same i18n contract as the rest of the UI.

**Inherited surfaces attached to this cluster**
- countries page search and sort;
- universities tab direct search;
- country page CTA handoff into search;
- chat `SearchResultsPanel` no-results/loading/header/action labels;
- chat `ChatHistorySidebar` relative-date labels, empty state, and new-chat CTA.

---

### Cluster F — Currency localization defects split between copy-only surfaces and formatter/default policy wiring

**Classification:** component wiring  
**Priority:** P2

**Root cause**

Currency selection and formatting are globally shared, but they still rely on hardcoded English formatting choices, fallback rates, and a USD-first bootstrap without a fully explicit localization/display contract. At the same time, a smaller subset of visible card-level defects are copy/fallback-only and should not be allowed to hide the broader formatter/default-policy work.

This cluster is lower than compare/global shell architecture, but it must no longer be treated as fully locale-files-only.

**Cluster → files mapping**
- `src/contexts/CurrencyContext.tsx`
- `src/components/CurrencySelector.tsx`
- `src/components/layout/GlobalTopBar.tsx`
- `src/pages/ProgramDetails.tsx`
- `src/pages/UniversityDetails.tsx`
- `src/components/ProgramCard.tsx`

**Cluster → execution split**
- **F-primary: policy / wiring defects**
  - formatter locale is hardcoded or biased;
  - default currency bootstraps to USD;
  - fallback-rate behavior is code-policy, not locale-file copy;
  - selector metadata is structurally Arabic-vs-English only.
- **F-secondary: copy-only / local fallback defects**
  - card/detail labels or hardcoded fallback strings that can be corrected once the policy path is stable;
  - narrow UI copy defects like residual hardcoded card-level fallback literals.

**Cluster → must-fix-together set**
- decide display-locale-aware money formatting policy;
- decide currency defaulting policy;
- decide behavior when live rates are unavailable;
- align selector labels, formatting output, and money helpers;
- separate policy wiring work from card-level copy cleanup so copy-only closure does not mis-state formatter readiness.

**Inherited surfaces attached to this cluster**
- global currency selector;
- cards and detail pages showing prices;
- shell-level currency switching behavior;
- card/detail copy fallback defects that are smaller than, but dependent on, the formatter/default-policy path.

---

## Cluster → classification

| Cluster | Classification |
|---|---|
| Cluster A — Compare architecture split | architecture fallback |
| Cluster B — Global shell localization | component wiring |
| Cluster C — UI-level locale fallback ladders | architecture fallback |
| Cluster D — Route locale + canonical policy drift | component wiring |
| Cluster E — Discovery/search localization inconsistency | component wiring |
| Cluster F — Currency localization defects | component wiring |

---

## Cluster → priority

| Cluster | Priority |
|---|---|
| Cluster A — Compare architecture split | P0 |
| Cluster B — Global shell localization | P1 |
| Cluster C — UI-level locale fallback ladders | P1 |
| Cluster D — Route locale + canonical policy drift | P1 |
| Cluster E — Discovery/search localization inconsistency | P2 |
| Cluster F — Currency localization defects | P2 |

---

## Ownership mapping

Each newly normalized or newly explicit file is assigned one primary owner cluster, with optional secondary relation:

| File | Primary owner cluster | Secondary relation |
|---|---|---|
| `src/hooks/useDeterministicLocalizer.ts` | Cluster C | Cluster E |
| `src/lib/localization/displayAdapter.ts` | Cluster C | — |
| `src/hooks/useLocalizedField.ts` | Cluster C | — |
| `src/hooks/useLocalizedContent.ts` | Cluster C | — |
| `src/components/chat/SearchResultsPanel.tsx` | Cluster E | Cluster B |
| `src/components/chat/ChatHistorySidebar.tsx` | Cluster B | Cluster E |
| `src/components/UniversityCard.tsx` | Cluster D | Cluster C |
| `src/components/routing/LocaleRouteWrapper.tsx` | Cluster D | — |
| `src/components/seo/SEOHead.tsx` | Cluster D | Cluster B |
| `src/components/CompareFloatingButton.tsx` | Cluster A | — |
| `src/components/CompareButton.tsx` | Cluster A | — |
| `src/components/compare/CompareFloatingBar.tsx` | Cluster A | — |
| `src/components/compare/CompareHeartButton.tsx` | Cluster A | — |

---

## Execution order

### 1) Cluster A — Compare architecture split
Do first because all compare fixes become unstable if state source and compare contract are not unified first.

### 2) Cluster B — Global shell localization
Do second because shell/bootstrap issues influence every route and every later remediation pass.

### 3) Cluster C — UI-level locale fallback ladders
Do after shell stabilization so a single display policy can be applied consistently to visible components and shared localization helpers.

### 4) Cluster D — Route locale + canonical policy drift
Do after shell/display-policy cleanup so route/SEO helpers are centralized around the same locale contract.

### 5) Cluster E — Discovery/search localization inconsistency
Do after display and route policy are stabilized; otherwise discovery surfaces and chat-discovery panels may be reworked twice.

### 6) Cluster F — Currency localization defects
Do after shell and route policy are stable so money formatting can align with the final locale/display contract, then close smaller copy-only fallback defects afterward.

---

## Runtime-verification-needed list

These items remain in the final backlog but require runtime verification before a fix is scoped or severity is changed.

### 1) `SearchResultsPanel`
Status: **provisional major**.  
Keep as runtime-verification-needed. Do not upgrade or downgrade before raw runtime verification confirms:
- locale-safe details navigation;
- generated `country_slug` behavior from chat cards;
- shortlist snapshot completeness when chat results are incomplete;
- interaction between validators, enrichment, and visible display labels.

### 2) `continentMapping`
Status: **watch / high-minor**.  
Keep as runtime-verification-needed / watch. Do not elevate unless wider visible inheritance is proven beyond shortlist hierarchy grouping.

### 3) compare → chat handoff after architecture unification planning
The handoff path is clearly attached to the compare split, but runtime verification should confirm the final message payload, locale propagation, and selected-program integrity once the compare root cause is addressed.

---

## Non-goals / what must not be reopened

### Must not be reopened as separate root causes
- `Compare.tsx`, `useComparePrograms`, `CompareDrawer`, `CompareFloatingBar`, `CompareHeartButton`, `CompareButton`, `CompareFloatingButton`, and universities compare flow must **not** be split into separate root causes again. They belong under **Cluster A**.
- `WalletHeaderWidget`, `GlobalTopBar`, `LanguageToggle`, `CurrencySelector`, `CurrencyContext`, `index.html`, `ChatHistorySidebar`, and `useVisitorTracker` must **not** be treated as isolated unrelated items. They belong under the shared shell/global localization backlog, primarily **Cluster B**, with currency-specific execution under **Cluster F**.
- `ShortlistDrawer`, `Country.tsx`, `Countries.tsx`, `displayAdapter`, `useLocalizedField`, `useLocalizedContent`, and `useDeterministicLocalizer` must **not** be reopened as independent architecture roots. They belong under **Cluster C**, except where a route/SEO issue clearly belongs under **Cluster D**.
- `ProgramDetails`, `UniversityDetails`, `UniversityCard`, `LocaleRouteWrapper`, and `SEOHead` must **not** be reopened as copy-only issues. Their confirmed root is route-locale/canonical drift under **Cluster D**.
- `Countries.tsx`, `search-api`, `Country.tsx`, `SearchResultsPanel`, and discovery-side chat panels must **not** be fragmented into many new micro-roots. They belong under **Cluster E** unless a later runtime phase proves a distinct contract failure.
- card-level price/copy fallback defects must **not** be used to claim Cluster F is closed while formatter/default-policy wiring remains unresolved.

### Must keep accepted calibrations unchanged
- `SearchResultsPanel` stays **provisional major**.
- `continentMapping` stays **watch / high-minor**.
- `Country.tsx` stays valid but lower risk.
- `ProgramDetails` / `UniversityDetails` locale-prefix + canonical drift stays confirmed **P1**.

### Must not happen in future execution planning
- no re-counting inherited surfaces as new roots;
- no dropping of Phase 1/2 shell issues from later remediation planning;
- no conversion of this backlog into implementation detail inside this document;
- no reopening audit scope unless a later execution phase explicitly requests runtime verification.

---

## Closure discipline

- This backlog is normalized from audit/code-evidence inputs only.
- Nothing here is runtime-proven.
- Remediation remains a separate step.
- Classification/ownership wording in this document must not be treated as implementation completion.
- Locale-files-only closure is valid only for narrow copy defects; anything marked component wiring or architecture fallback requires code-path changes beyond locale dictionary edits.
