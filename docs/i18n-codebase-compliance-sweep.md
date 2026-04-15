# i18n codebase compliance sweep

## 1. Executive snapshot

- Total findings: **20**.
- Locale-files-only fixable: **2**.
- Need wiring: **13**.
- Need architecture: **5**.
- Likely duplicates of existing backlog clusters: **15**.
- Net-new or not clearly represented in backlog: **5**.

This sweep is a code-evidence-only compliance pass across Portal user-facing surfaces. It separates copy-only defects from issues that cannot be closed by locale file edits alone.

## 2. Scan scope

Inspected folders/files:
- `index.html`.
- `src/components/**` user-facing portal/site/chat/layout/search/compare/country surfaces.
- `src/pages/**` public site pages and detail/search pages.
- `src/contexts/**` localization and currency context.
- `src/hooks/**` localization/display hooks and compare/search-related hooks.
- `src/lib/**` localization/search helpers.
- `src/i18n/**` and `src/locales/**`.
- SEO/meta surfaces including `src/components/seo/SEOHead.tsx`.
- Route locale handling including `src/components/routing/LocaleRouteWrapper.tsx`.
- Existing backlog context: `docs/i18n-remediation-backlog-final.md`.

Intentionally excluded:
- CRM-specific implementation/remediation.
- Admin-only and dev-only surfaces where text is internal-facing rather than end-user portal/site UI.
- Runtime validation; no finding here is marked closed or proven in browser behavior.
- Broad refactor proposals that would change route architecture, compare contracts, or display contracts during the audit itself.

## 3. Findings ledger

| ID | File | Surface | Violation type | Severity | Current state | Fix classification | Existing backlog cluster? | Notes |
|---|---|---|---|---|---|---|---|---|
| F01 | `index.html` | bootstrap + default SEO | `lang`/`dir` and content-language are pre-pinned to Arabic + English; static title/description/OG text are hardcoded | Critical | Boot HTML starts as `lang="ar" dir="rtl"` and `Content-Language: ar, en`; default SEO copy is static | needs architecture | yes — Cluster B, Cluster D | Not closable with locale files only because bootstrap language and alternate policy are architectural entry assumptions. |
| F02 | `src/components/LanguageToggle.tsx` | global shell language picker | Hardcoded modal title, search placeholder, empty state, accessibility label, footer count sentence | High | Language UI is not translation-key driven despite being the primary language control | needs wiring | yes — Cluster B | Also duplicates language metadata locally instead of relying on centralized language definitions. |
| F03 | `src/components/CurrencySelector.tsx` + `src/contexts/CurrencyContext.tsx` | global currency UI + formatting policy | Currency names are split into `nameAr`/`nameEn`; selector is Arabic-vs-English only; context defaults to USD and formats with `Intl.NumberFormat("en")` and returns literal `Free` | High | Currency display mixes copy, defaulting, and formatting assumptions in code | needs wiring | yes — Cluster B, Cluster F | Locale files cannot solve the formatter/default policy. |
| F04 | `src/components/layout/WalletHeaderWidget.tsx` | wallet shell widget | User-facing labels/statuses are directly hardcoded in Arabic/English mix (`المحفظة`, `Available Balance`, `معلق`, `قريباً`) | High | Shared header widget bypasses translation keys and embeds visible status language | needs wiring | yes — Cluster B, Cluster C | High visibility shell defect. |
| F05 | `src/components/shortlist/ShortlistDrawer.tsx` | shortlist shell drawer | Local fallback ladder uses `_en`/`_ar`; visible labels, empty states, login CTA, singular/plural labels are inline hardcoded | High | Drawer decides both locale resolution and copy locally | needs architecture | yes — Cluster C | Not locale-files-only because field-resolution policy is embedded in component code. |
| F06 | `src/components/compare/CompareDrawer.tsx` | compare drawer + compare-to-chat handoff | Compare CTA, loading, warning, empty, toast, and chat-handoff message are all hardcoded with `locale === 'ar' ? ... : ...` | Critical | Compare surface remains bilingual-branch-driven rather than translation-key-driven | needs architecture | yes — Cluster A | Also carries compare payload message text inline, so locale files alone cannot close it. |
| F07 | `src/components/CompareFloatingButton.tsx` | compare shell affordance | Floating button label is hardcoded bilingual text | Medium | Visible compare entry remains direct text | needs wiring | yes — Cluster A | Small surface but user-facing and shared. |
| F08 | `src/components/CompareButton.tsx` | compare program CTA/toasts | Translation calls still fall back to hardcoded English for add/remove/max toasts | Medium | Key absence would silently reintroduce hardcoded copy at runtime | needs wiring | yes — Cluster A | Locale-only if keys already exist, but current code still violates “no direct UI text” baseline. |
| F09 | `src/pages/ProgramDetails.tsx` | localized program route + SEO | Route prefix is constrained to `ar/en`; canonical + hreflang emit only `ar`, `en`, `x-default`; breadcrumb/search link localizer is rollout-limited | Critical | Detail SEO and navigation are page-local and two-locale bounded | needs architecture | yes — Cluster D | Explicit example of item wrongly treated as locale-files-only in a copy-focused round. |
| F10 | `src/pages/UniversityDetails.tsx` | localized university route + SEO | Same two-locale route/canonical/hreflang policy; page constructs its own locale pathing | Critical | Page-local locale SEO contract drift persists | needs architecture | yes — Cluster D | Confirmed by code evidence. |
| F11 | `src/pages/Universities.tsx` | search/discovery SEO | `rolloutLocales = ['en', 'ar']` constrains canonical/alternate generation; fallback localePrefix forces non-rollout languages to `/en` | High | Discovery page is multilingual in resources but rollout-limited in route/SEO logic | needs wiring | yes — Cluster D, Cluster E | This is broader than locale files because it affects routing/SEO emission logic. |
| F12 | `src/pages/Countries.tsx` | discovery filter/search/sort | Search is hardcoded to `name_ar`/`name_en`; alphabetical sort branches on Arabic vs non-Arabic; canonical omits locale dimension | High | Country discovery assumes bilingual data model and page-level search semantics | needs wiring | yes — Cluster E | Search semantics are not 12-language-safe. |
| F13 | `src/pages/Country.tsx` | country SEO/meta and handoff | SEO title/description fall back directly to `name_en || name_ar`; no shared locale route/canonical helper | Medium | Page still mixes raw localized fields with page-local SEO generation | needs wiring | yes — Cluster C, Cluster E | Risk is lower than compare/detail pages but still non-compliant. |
| F14 | `src/lib/localization/displayAdapter.ts` + `src/hooks/useLocalizedField.ts` | display adapter policy | Resolver contract still bakes `_en` and `_ar` legacy fallback order into shared helper path | High | Shared localization adapter structurally preserves en/ar compatibility logic | needs architecture | yes — Cluster C | Legacy compatibility is acceptable only as legacy; current helper still normalizes UI around those fields. |
| F15 | `src/hooks/useDeterministicLocalizer.ts` | deterministic localizer | Hook only localizes when `language === 'ar'`; all other locales collapse to English/original title | High | Hook encodes Arabic-only localization policy in shared display logic | needs architecture | no — net-new | This is not just copy missing; it is a locale-capability assumption embedded in a shared hook. |
| F16 | `src/components/chat/SearchResultsPanel.tsx` | search results side panel | No-results title/body, panel title, count label, fullscreen/close titles, loading text, autosave label are hardcoded via Arabic-vs-English ternaries | High | Discovery/chat surface bypasses i18n keys across multiple states | needs wiring | yes — Cluster E | User-facing discovery surface with many hardcoded states. |
| F17 | `src/components/chat/ChatHistorySidebar.tsx` | chat history shell | History labels, date-relative strings, empty state, CTA title are hardcoded with Arabic-vs-English logic and locale-specific date formatting | Medium | Localized chronology semantics are component-local | needs wiring | no — net-new | This is a shell/discovery-adjacent surface not clearly called out in the merged backlog. |
| F18 | `src/components/ProgramCard.tsx` | program listing CTA + formatting | `View Details` fallback is hardcoded; month joiner uses Arabic punctuation branch; money/labels mix translation with locale-specific literals | Medium | Mostly translated surface still contains direct UI fallback | locale-files-only | yes — Cluster F | Narrow defect if keys exist, but still a compliance fail. |
| F19 | `src/components/UniversityCard.tsx` | university card routing/display | Route prefix is forced to `ar` or `en`; card display still depends on locale-specific pathing and visible fallback behavior | Medium | Shared card carries rollout-only locale assumption into navigation | needs wiring | yes — Cluster C, Cluster D | Card-level route generation should not be hardcoded to two locales. |
| F20 | `src/components/seo/SEOHead.tsx` | global SEO helper | Helper accepts any strings and adds static robots/twitter defaults, but there is no enforced translation-key contract or centralized locale alternate policy | Low | Helper itself is neutral, but it allows page-local hardcoded/meta drift to persist | locale-files-only | no — net-new | Not a standalone bug, but a policy leak that explains why page-local SEO text keeps drifting. |

## 4. Root-cause grouping

### Root 1 — Shared shell surfaces still own copy instead of consuming translation contracts
Reuse of existing backlog logic: **Cluster B — Global shell localization**.
- F01 `index.html` bootstrap defaults.
- F02 `LanguageToggle` hardcoded shell copy.
- F03 currency selector/context display/default behavior.
- F04 wallet header widget hardcoded labels.
- F17 chat history sidebar as an additional shell-like navigation surface.

### Root 2 — Compare and shortlist surfaces still mix state architecture with local bilingual copy
Reuse of existing backlog logic: **Cluster A — Compare architecture split** plus **Cluster C — UI-level locale fallback ladders**.
- F05 shortlist drawer local display fallback + hardcoded copy.
- F06 compare drawer hardcoded compare contract text and chat handoff language.
- F07 floating compare entry hardcoded label.
- F08 compare button English fallback strings.

### Root 3 — Route, canonical, and hreflang policy remain page-local and rollout-limited
Reuse of existing backlog logic: **Cluster D — Route locale, canonical URL, and hreflang policy are page-local instead of centralized**.
- F09 program details.
- F10 university details.
- F11 universities search page.
- F19 university card locale-prefixed navigation.

### Root 4 — Discovery/search semantics are still bilingual-data-driven rather than multilingual-policy-driven
Reuse of existing backlog logic: **Cluster E — Discovery/search localization semantics are inconsistent across discovery surfaces**.
- F11 universities page rollout-limited locale SEO and page-local discovery framing.
- F12 countries page bilingual search/sort assumptions.
- F13 country page raw field SEO fallback.
- F16 search results panel hardcoded discovery states.
- F17 chat history relative-time labels.

### Root 5 — Shared localization helpers still encode legacy and Arabic-only assumptions
Reuse of existing backlog logic: **Cluster C** with one net-new hook-level extension.
- F14 display adapter + `useLocalizedField` preserve `_en`/`_ar` ladders in shared logic.
- F15 deterministic localizer only activates for Arabic.

### Root 6 — Formatting policy is mixed into UI copy/fallback behavior
Reuse of existing backlog logic: **Cluster F — Currency formatting/default behavior**.
- F03 currency formatting/default policy.
- F18 card-level money/copy fallback.
- F20 SEO helper permissiveness as a policy leak for hardcoded metadata.

## 5. ar/en-only suspicion inventory

Every location below appears constrained to Arabic/English logic or assumptions:
- `index.html` — `lang="ar"`, `dir="rtl"`, `Content-Language="ar, en"`.
- `src/components/routing/LocaleRouteWrapper.tsx` — comment still frames URL locale sync as “currently en/ar”.
- `src/components/CurrencySelector.tsx` — `isAr` branch selects `nameAr` vs `nameEn` only.
- `src/contexts/CurrencyContext.tsx` — `formatPrice()` locks formatter locale to `en`; default currency is USD.
- `src/components/ProgramCard.tsx` — visible fallback `language === 'ar' ? 'عرض التفاصيل' : 'View Details'`.
- `src/components/ProgramCardCompact.tsx` — Arabic-only resolver/title behavior and `ar-EG` vs `en-US` locale branch.
- `src/components/UniversityCard.tsx` — locale prefix is forced to `ar` or `en`.
- `src/components/CompareFloatingButton.tsx` — Arabic-vs-English button label.
- `src/components/compare/CompareDrawer.tsx` — `const locale = language === 'ar' ? 'ar' : 'en';` and all compare text branches.
- `src/components/compare/CompareFloatingBar.tsx` — Arabic-vs-English compare labels.
- `src/components/compare/CompareHeartButton.tsx` — Arabic-vs-English titles/descriptions.
- `src/components/shortlist/ShortlistDrawer.tsx` — locale prefix `ar/en`; `_en` and `_ar` field fallbacks.
- `src/components/chat/SearchResultsPanel.tsx` — no-results/loading/panel labels are Arabic-vs-English ternaries.
- `src/components/chat/ChatHistorySidebar.tsx` — relative-date labels and `toLocaleDateString(ar-SA/en-US)` branch.
- `src/components/chat/MalakChatInterface.tsx` — greeting, paused placeholder, and status strings branch on Arabic vs English.
- `src/pages/ProgramDetails.tsx` — locale prefix `ar/en`; hreflang only emits `ar`, `en`, `x-default`.
- `src/pages/UniversityDetails.tsx` — locale prefix `ar/en`; hreflang only emits `ar`, `en`, `x-default`.
- `src/pages/Universities.tsx` — `rolloutLocales = ['en', 'ar']`; non-rollout locales collapse to `/en`.
- `src/pages/Countries.tsx` — search explicitly reads `name_ar` and `name_en`; sort branches on Arabic vs other.
- `src/pages/Country.tsx` — SEO fallback reads `name_en || name_ar`.
- `src/lib/localization/displayAdapter.ts` — legacy resolution names and fallback order include `_en` and `_ar` as first-class paths.
- `src/hooks/useLocalizedField.ts` — comment explicitly documents `field_en`, `field_ar` compatibility fallback.
- `src/hooks/useDeterministicLocalizer.ts` — only Arabic gets localized output; all other locales remain original English/base title.

## 6. Hardcoded text inventory

User-facing hardcoded text instances found during this sweep:
- `index.html` — static `<title>`, description, OG description, organization description, and keyword text.
- `src/components/LanguageToggle.tsx` — `Change language`, `Select Language`, `Search languages...`, `No languages found`, `languages available`.
- `src/components/CurrencySelector.tsx` — `Select currency`.
- `src/components/layout/WalletHeaderWidget.tsx` — `المحفظة`, `الرصيد المتاح`, `Available Balance`, `USD`, `معلق`, `المحفظة قيد التطوير`, `قريباً`, `حدث خطأ في تحميل البيانات`, `إعادة المحاولة`.
- `src/components/shortlist/ShortlistDrawer.tsx` — `Favorites`, `Log in to save programs and universities`, `No favorites yet`, `Browse programs`, `My Account`, plus Arabic counterparts and inline unknown/university fallbacks.
- `src/components/compare/CompareDrawer.tsx` — `Programs excluded`, `Select 2 programs`, `Comparing...`, `Compare Programs`, `Ask Bot: Which is best?`, `Clear All`, `Loading comparison data...`, `No valid programs to compare`, `Selected programs:`, `Compare Now`, plus Arabic counterparts.
- `src/components/CompareFloatingButton.tsx` — `Compare (${count})` and Arabic counterpart.
- `src/components/CompareButton.tsx` — `Removed from comparison`, `Maximum reached`, `You can compare up to ... programs`, `Added to comparison` as fallback literals.
- `src/components/ProgramCard.tsx` — `View Details` Arabic/English fallback.
- `src/components/chat/SearchResultsPanel.tsx` — `No matching programs`, `Clarify your preferences - country, major, or budget`, `Search Results`, `programs`, `Minimize`, `Fullscreen`, `Close`, `Loading...`, `Auto-saved`, plus Arabic counterparts.
- `src/components/chat/ChatHistorySidebar.tsx` — `Today`, `Yesterday`, `days ago`, `History`, `New chat`, `No history yet`, `Start a chat`, plus Arabic counterparts.
- `src/components/country/AdditionalServices.tsx` — `Additional Services for Students`.
- `src/components/country/CustomerReviews.tsx` — `What Our Students Say`, `Google Review`.
- `src/components/country/ExploreCities.tsx` — `Universities`, `Students`.
- `src/components/ThemeToggle.tsx` — `Toggle theme`.
- `src/components/HeroSlider.tsx` — `Previous`, `Next`.
- `src/components/FloatingChat.tsx` — `AI Assistant`.
- `src/components/SocialShareBar.tsx` — `Copy Link`, `Copied!`, `Copy link`.
- `src/components/layout/Layout.tsx` — `Connect Study World` image alt and `Institution Dashboard` title.
- `src/components/chat/DeepSearchLayout.tsx` — `Results:`, `My Account`, `Favorites`, `Wallet`, `Minimize`, `Close` plus Arabic counterparts.
- `src/components/chat/MalakChatInterface.tsx` — paused-state banner and input placeholder text.
- `src/components/university/UniversityLocationMap.tsx` — map mode labels, location labels, and fallback messages in Arabic/English pairs.

## 7. Backlog delta

Already represented well in `docs/i18n-remediation-backlog-final.md`:
- Compare drawer/button/floating compare issues remain within **Cluster A**.
- Language toggle, wallet widget, currency selector/context, and bootstrap defaults remain within **Cluster B**.
- Shortlist drawer and display adapter fallback ladders remain within **Cluster C**.
- Program/university details and universities page locale-prefix/canonical/hreflang drift remain within **Cluster D**.
- Countries/search-result discovery semantics remain within **Cluster E**.
- Currency formatting/default behavior and card-level copy fallback remain within **Cluster F**.

Missing or not clearly represented enough:
- `src/hooks/useDeterministicLocalizer.ts` Arabic-only behavior is not clearly called out as its own shared-hook risk.
- `src/components/chat/ChatHistorySidebar.tsx` is not clearly captured despite being a user-facing shell/history navigation surface with hardcoded bilingual copy.
- `src/components/chat/SearchResultsPanel.tsx` remains implied in discovery/search discussion, but the number of direct hardcoded user-facing states is under-described.
- `src/components/seo/SEOHead.tsx` is not a defect by itself, but the backlog does not explicitly mention that the helper allows page-local SEO copy/policy drift because it has no enforced i18n contract.
- `src/components/UniversityCard.tsx` two-locale path generation is only indirectly covered; it should be called out as an inherited routing surface under Cluster D.

Current backlog classifications that appear too weak / too strong:
- **Too weak:** Cluster F is labeled locale-files-only, but `CurrencyContext.tsx` shows formatter locale, default currency, live-rate fallback behavior, and literal `Free` are code-level policy, so this cluster is at least partly **needs wiring** rather than fully locale-files-only.
- **Too weak:** Cluster E under-describes chat-side discovery panels/history surfaces that still embed bilingual text and date logic.
- **Still valid:** Cluster A as P0 and Cluster D as P1 remain supported by code evidence.
- **Still valid with caution:** Cluster C remains architectural because shared helper fallback ladders still encode `_en/_ar` and page/component-level display policy drift.

## 8. Ownership recommendation

For every net-new finding:
- **F15 — `useDeterministicLocalizer.ts`**
  - Primary owner cluster: **Cluster C — UI-level locale fallback ladders / display policy**.
  - Secondary relation: **Cluster E** because it can affect discovery result naming behavior.
- **F17 — `ChatHistorySidebar.tsx`**
  - Primary owner cluster: **Cluster B — Global shell localization**.
  - Secondary relation: **Cluster E — Discovery/search localization semantics**.
- **F20 — `SEOHead.tsx` policy leak**
  - Primary owner cluster: **Cluster D — Route locale, canonical URL, and hreflang policy**.
  - Secondary relation: **Cluster B** because it influences top-level metadata consistency.
- **SearchResultsPanel under-described hardcoded-state density**
  - Primary owner cluster: **Cluster E**.
  - Secondary relation: **Cluster B** because it is a persistent split-view shell surface.
- **UniversityCard locale-prefixed navigation inheritance gap**
  - Primary owner cluster: **Cluster D**.
  - Secondary relation: **Cluster C** due to co-located display fallback behavior.

## 9. Closure discipline

- Nothing in this report is runtime-proven.
- This report is **code-evidence only**.
- Remediation is a **separate step**.
- No finding here should be marked closed solely because locale files exist.
- Any finding classified as **needs wiring** or **needs architecture** requires code-path changes beyond locale dictionary edits.
