# Languages Section i18n Audit

## 1. Executive snapshot
- **Overall judgment on Languages section:** structurally broken for a 12-language baseline. The section is translation-key-driven in many React surfaces, but the implementation is still Russian-first, en/ar-biased in data contracts, and partially dependent on hardcoded fallback copy and language-specific storage / routing assumptions.
- **Total findings:** 18
- **locale-files-only count:** 4
- **needs wiring count:** 7
- **needs architecture count:** 7
- **section-local vs inherited/global counts:** 14 section-local, 4 inherited/global

### Snapshot notes
- The section is **not blocked by a single locale-file gap**. Missing locale entries are widespread, but several failures sit in routing, runtime data shaping, legacy product fields, and Russian-only activation / course contracts.
- The most severe issues cluster around the Russian-learning path, placement flow, dashboard runtime, and course enrollment surfaces.
- The section currently behaves like **one implemented language (Russian) with en/ar-era compatibility assumptions**, not like a reusable 12-language system.

## 2. Route and file map

### Exact route/page entry points for the Languages section
- `/languages` -> `src/pages/languages/LanguagesLanding.tsx`
- `/languages/russian` -> `src/pages/languages/RussianLanding.tsx`
- `/languages/russian/onboarding` -> `src/pages/languages/RussianOnboarding.tsx`
- `/languages/russian/plan` -> `src/pages/languages/RussianPlan.tsx`
- `/languages/russian/dashboard` -> `src/pages/languages/RussianDashboard.tsx`
- `/languages/russian/placement-auth` -> `src/pages/languages/PlacementAuth.tsx`
- `/languages/russian/placement-test` -> `src/pages/languages/PlacementTest.tsx`
- `/languages/russian/modules/:moduleSlug` -> `src/pages/languages/RussianModule.tsx`
- `/languages/russian/lessons/:lessonSlug` -> `src/pages/languages/RussianLesson.tsx`
- `/languages/russian/checkpoints/:templateKey` -> `src/pages/languages/RussianCheckpoint.tsx`
- `/languages/russian/exams/:examSetKey` -> `src/pages/languages/RussianExam.tsx`
- `/my-learning` -> `src/pages/languages/MyLearning.tsx`

### Major imported files/components/hooks used by this section
**Page shell / inherited UI**
- `src/components/layout/Layout.tsx`
- `src/components/layout/GlobalTopBar.tsx`
- `src/components/layout/HeaderAuth.tsx`
- `src/components/layout/Footer.tsx`
- `src/App.tsx`

**Languages-specific components**
- `src/components/languages/CourseEnrollmentModal.tsx`
- `src/components/languages/assessment/AssessmentRunner.tsx`
- `src/components/languages/assessment/AssessmentSectionRenderer.tsx`
- `src/components/languages/assessment/AssessmentSubmitBar.tsx`
- `src/components/languages/assessment/AssessmentAttemptSummary.tsx`
- `src/components/languages/assessment/CheckpointLaunchCard.tsx`
- `src/components/languages/assessment/ExamLaunchCard.tsx`
- `src/components/languages/dashboard/DashboardOverviewTab.tsx`
- `src/components/languages/dashboard/DashboardAssignmentsTab.tsx`
- `src/components/languages/dashboard/DashboardProgressTab.tsx`
- `src/components/languages/dashboard/DashboardWordsTab.tsx`
- `src/components/languages/dashboard/DashboardExamsTab.tsx`
- `src/components/languages/dashboard/Intensive750Panel.tsx`

**Hooks / state / data access**
- `src/hooks/useCourseProducts.ts`
- `src/hooks/useLearningState.ts`
- `src/hooks/useRussianActivation.ts`
- `src/hooks/useRussianDashboardData.ts`
- `src/hooks/useRussianCheckpointLaunch.ts`
- `src/hooks/useRussianCheckpointSubmit.ts`
- `src/hooks/useRussianExamLaunch.ts`
- `src/hooks/useRussianExamSubmit.ts`

**Runtime / util / content-contract files**
- `src/lib/russianCourse.ts`
- `src/lib/russianPathState.ts`
- `src/lib/russianExecutionPackSeed.ts`
- `src/lib/russianExecutionPackWriters.ts`
- `src/lib/russianAssessmentExecution.ts`
- `src/lib/russianPlacementQuestionBank.ts`
- `src/lib/russianPlacementEngine.ts`
- `src/lib/russianIntensive750Runtime.ts`
- `src/lib/russianIntensive750AssessmentRuntime.ts`
- `src/lib/learningPathResolver.ts`

**Locale files materially involved**
- `src/locales/en/common.json`
- `src/locales/ar/common.json`
- `src/locales/bn/common.json`
- `src/locales/de/common.json`
- `src/locales/es/common.json`
- `src/locales/fr/common.json`
- `src/locales/hi/common.json`
- `src/locales/ja/common.json`
- `src/locales/ko/common.json`
- `src/locales/pt/common.json`
- `src/locales/ru/common.json`
- `src/locales/zh/common.json`

### Likely primary owner files for remediation batching
1. `src/pages/languages/RussianLanding.tsx`
2. `src/pages/languages/PlacementTest.tsx`
3. `src/pages/languages/RussianDashboard.tsx`
4. `src/components/languages/dashboard/DashboardOverviewTab.tsx`
5. `src/components/languages/CourseEnrollmentModal.tsx`
6. `src/hooks/useCourseProducts.ts`
7. `src/hooks/useRussianActivation.ts`
8. `src/lib/russianExecutionPackWriters.ts`
9. `src/lib/russianAssessmentExecution.ts`
10. `src/App.tsx`

## 3. Findings ledger

| ID | File | Surface | Finding | Severity | Classification | Section-local or inherited/global | Notes |
|---|---|---|---|---|---|---|---|
| LANG-001 | `src/pages/languages/LanguagesLanding.tsx` + locale files | `/languages` landing hero, product cards, pricing, “more languages” | Landing keys exist mostly only in en/ar; 10 baseline locales miss `languages.badge`, `languages.hero.*`, `languages.product.*`, `languages.catalog.russian.*`, `languages.moreLanguages`, `languages.comingSoon`, `languages.startLearning`. | High | locale-files-only | section-local | Existing `t()` wiring is present, but the contract is not populated beyond rollout locales. |
| LANG-002 | `src/pages/languages/RussianLanding.tsx` + `src/components/languages/CourseEnrollmentModal.tsx` + locale files | Russian landing, pricing cards, cohorts, enrollment modal | `languages.enrollment.*` namespace is missing in **all 12 locales** for most referenced keys, including CTA, statuses, pricing notes, modal steps, course/card copy, bank transfer copy, and cohort labels. | Critical | needs wiring | section-local | This is more than translation content missing: the namespace is referenced broadly but not established as a complete translation contract. |
| LANG-003 | `src/pages/languages/RussianLesson.tsx` + locale files | Lesson header, content label, vocabulary label, progression, CTA labels | `languages.lesson.*` keys are referenced but absent in every locale, so the lesson UI has no translation contract for its visible copy. | Critical | needs wiring | section-local | Includes progression status labels and the back-to-dashboard CTA label. |
| LANG-004 | `src/pages/languages/PlacementAuth.tsx` + locale files | Placement auth gate | `languages.placementAuth.*` keys are missing in every locale, leaving the sign-in / create-account gate untranslated by contract. | High | needs wiring | section-local | Impacts title, subtitle, two CTAs, and back button. |
| LANG-005 | `src/pages/languages/PlacementTest.tsx` + locale files | Placement test flow and result screen | `languages.placementV2.*` result labels, CTA labels, status labels, and summary labels are missing in every locale. | Critical | needs wiring | section-local | This affects the entire placement flow, especially results and readiness summaries. |
| LANG-006 | `src/components/languages/assessment/*` + locale files | Checkpoint/exam runner, cards, submit bar | `languages.assessment.*` surface labels are absent in 11 locales and often absent in en/ar too for runner/card UI. | High | needs wiring | section-local | Assessment shell is translation-key-driven, but its translation namespace is incomplete. |
| LANG-007 | `src/pages/languages/RussianDashboard.tsx` + `src/components/languages/dashboard/*` + locale files | Dashboard tabs, stats, exams, assignments, intensive panel | `languages.dashboard.*` coverage is incomplete across the baseline: 63 dashboard keys are missing in 10 locales, 13 keys are missing in all locales, and the intensive panel is partly missing even in Arabic. | Critical | needs wiring | section-local | Dashboard is the densest untranslated surface in the section. |
| LANG-008 | `src/pages/languages/RussianPlan.tsx`, `RussianOnboarding.tsx`, `MyLearning.tsx` + locale files | Onboarding, plan, my-learning dashboard | `languages.plan.*`, `languages.onboarding.*`, and `languages.home.*` are only partially populated for rollout locales and mostly absent for the other 10 baseline locales. | High | locale-files-only | section-local | React usage is already key-driven; missing content expansion is the main blocker here. |
| LANG-009 | `src/App.tsx`, `src/pages/languages/LanguagesLanding.tsx` | Route map and language catalog cards | The section advertises English/Turkish/French/German/Chinese cards and routes, but only `/languages/russian` and nested Russian pages actually exist. | Critical | needs architecture | section-local | This makes the section Russian-only while visually implying a broader language catalog. |
| LANG-010 | `src/hooks/useCourseProducts.ts`, `src/components/languages/CourseEnrollmentModal.tsx` | Course product names/descriptions in modal | Course product display is built on `name_en/name_ar/description_en/description_ar` and `displayLocale.startsWith("ar")`, which is explicitly a legacy en/ar compatibility model. | Critical | needs architecture | section-local | Not translation-key-driven, not 12-language-safe, and not scalable for additional language-course catalogs. |
| LANG-011 | `src/hooks/useRussianActivation.ts`, `src/pages/languages/*`, `src/lib/russianAssessmentExecution.ts` | Activation, enrollment, routing, persistent learning state | The section hardcodes `language: "russian"`, `language_key: "russian"`, Russian-only payment inference, Russian-only dashboard routes, and Russian-only localStorage payloads. | Critical | needs architecture | section-local | The learning runtime is bound to one language instead of a generalized language-course contract. |
| LANG-012 | `src/pages/languages/RussianLesson.tsx` | Vocabulary auto-save logic | Vocabulary persistence assumes each localized string is formatted as `"Russian — Meaning"` and parses it with `split(' — ')`. | Critical | needs architecture | section-local | This is a hardcoded content grammar, not a translation contract. It will break for other writing systems and any differently structured locale copy. |
| LANG-013 | `src/lib/russianExecutionPackWriters.ts`, `src/lib/russianAssessmentExecution.ts`, seed JSON | Runtime course/module/assessment metadata | Dashboard/runtime payloads emit raw human-facing strings such as `Russian Shared Core`, DB seed titles, raw module titles, raw lesson titles, `Section`, and `Intensive runtime assessment · ...`. | Critical | needs architecture | section-local | The runtime relies on seeded human text rather than translation keys or localized metadata objects. |
| LANG-014 | `src/components/languages/dashboard/DashboardOverviewTab.tsx` | Dashboard overview tab | The file redeclares `isAr`, `humanizeValue`, and `formatDimensionLabel`, then forces `isAr = false`; this breaks RTL-awareness and silently disables safer fallback behavior. | High | needs wiring | section-local | This is a section-only defect visible on the Languages dashboard surface. |
| LANG-015 | `src/pages/languages/RussianLanding.tsx` | Comparison table pricing headers | The comparison table hardcodes `$250`, `$500`, and `$750` in visible UI instead of using translation or product-driven pricing data. | High | needs architecture | section-local | Prices already exist in product records elsewhere in the page, so this introduces duplicated non-contract UI content. |
| LANG-016 | `src/components/layout/Layout.tsx`, `src/components/layout/HeaderAuth.tsx` | Header/logo/admin/account visible on Languages pages | Visible shell text includes hardcoded `Connect Study World`, hardcoded `Institution Dashboard`, and Arabic-only avatar alt text `صورة شخصية`. | Medium | needs wiring | inherited/global | These are not Languages-section files, but they render on the section and violate no-hardcoded-user-text policy on this surface. |
| LANG-017 | `src/components/layout/GlobalTopBar.tsx` | Top bar rendered on Languages pages | The top bar forces `dir="ltr"`, which is an inherited shell-level layout assumption rather than a locale-driven direction contract. | Medium | needs architecture | inherited/global | This affects all Languages routes because they use `Layout`. |
| LANG-018 | `src/pages/languages/*`, `src/components/languages/*`, `src/components/layout/Footer.tsx`, `NavHintBadges.tsx` | Directional behavior | Multiple surfaces use `language === 'ar'`, `startsWith('ar')`, or equivalent Arabic-only checks instead of a baseline RTL-capability / locale metadata contract. | High | needs architecture | inherited/global | Even where only direction is intended, the implementation remains ar-specific rather than locale-capability-driven. |

## 4. 12-language baseline violations
- `LanguagesLanding` exposes a six-language catalog but only Russian has a real route tree and runtime. This is a catalog-level 12-language contract failure.
- `App.tsx` only defines nested subpages for `languages/russian/*`; there is no language-parameterized course route pattern.
- `useCourseProducts` and `CourseEnrollmentModal` rely on `name_en`, `name_ar`, `description_en`, and `description_ar` fields instead of translation keys or localized records.
- `CourseEnrollmentModal` chooses display content via `displayLocale.startsWith('ar')`, explicitly encoding Arabic-vs-non-Arabic fallback behavior.
- `LanguagesLanding`, `RussianLanding`, `RussianOnboarding`, `RussianPlan`, `RussianDashboard`, `RussianModule`, `PlacementAuth`, `PlacementTest`, `MyLearning`, and some dashboard components all use `language === 'ar'` to decide arrows/direction.
- `GlobalTopBar` hard-forces `dir="ltr"` even when the current locale should be RTL-capable.
- `RussianActivation`, placement persistence, assessment execution, and localStorage state all store or infer `russian` as the learning language rather than resolving from route/context.
- The course runtime is not language-agnostic: seed files, activation logic, assessment rows, lesson unlocks, and exam notices are all Russian-specific.
- Lesson vocabulary storage assumes a two-part `Russian — Meaning` localized string format, which is not 12-language-safe.
- Runtime dashboard payloads expose raw seeded course/module/lesson titles instead of a locale contract, so other locales cannot render localized runtime metadata without code changes.
- Russian comparison-table prices are duplicated as hardcoded UI literals even though pricing also exists as product data, creating a non-contract content path.
- The section’s placement / onboarding / dashboard flows are built around Russian path keys and Russian-learning assumptions instead of a reusable language-course surface.

## 5. Hardcoded text inventory

### Section-local hardcoded user-facing text
- `src/pages/languages/RussianLesson.tsx`: `"Russian — Meaning"` parsing contract used to split saved vocabulary text.
- `src/pages/languages/RussianLanding.tsx`: hardcoded comparison-table prices `$250`, `$500`, `$750`.
- `src/lib/russianExecutionPackWriters.ts`: fallback course title `"Russian Shared Core"`.
- `src/lib/russianAssessmentExecution.ts`: fallback assessment title `"Section"`.
- `src/lib/russianAssessmentExecution.ts`: persisted exam notice description `"Intensive runtime assessment · ${payload.examFamily}"`.
- Seed-backed runtime metadata surfaced without translation keys from:
  - `src/lib/russianExecutionPackSeed.ts`
  - `supabase/seed/russian/02_courses.json`
  - `supabase/seed/russian/03_modules_shared_core.json`
  - `supabase/seed/russian/04_lessons_shared_core.json`
  - `supabase/seed/russian/06_assessment_templates.json`
  - `supabase/seed/russian/07_exam_sets.json`

### Inherited/global hardcoded user-facing text visible on Languages pages
- `src/components/layout/Layout.tsx`: logo alt `"Connect Study World"`.
- `src/components/layout/Layout.tsx`: admin button title `"Institution Dashboard"`.
- `src/components/layout/HeaderAuth.tsx`: avatar image alt `"صورة شخصية"`.

### Non-user-facing / debug hardcoded strings noted but not counted as UI copy failures
- Debug console text in `Layout`, `HeaderAuth`, `PlacementTest`, and hooks.
- Storage keys and status codes used internally across placement / activation / dashboard runtime.

## 6. Russian-learning / language-course specific findings
- Russian course entry and all nested pages are fully hardcoded as `/languages/russian/*`, with no generalized language-course route model.
- Product retrieval and enrollment status in `useCourseProducts`, `useMyEnrollment`, and `useRussianActivation` are bound to `language_key = "russian"` or `language = "russian"`.
- Russian pricing UI is split between DB-driven product prices and hardcoded comparison-table prices, so the course surface has two competing sources of truth.
- Russian onboarding persists to `languages_russian_onboarding`, making the onboarding contract language-specific instead of route/language-param-specific.
- Placement results persist `active_learning_language: 'russian'` and `active_learning_dashboard_route: '/languages/russian/dashboard'`, which locks downstream runtime to one language implementation.
- Russian lesson progression and dashboard runtime consume seed titles directly; these titles are not emitted as translation keys.
- Russian vocabulary auto-save assumes the localized lesson vocabulary string contains a visible `Russian — Meaning` delimiter.
- Russian assessments persist notice descriptions with hardcoded English copy rather than key-driven translated descriptions.
- Russian enrollment modal still uses legacy `_ar/_en` product display fields; this directly conflicts with the baseline rule that `_ar/_en` are compatibility-only, not the primary UI architecture.
- Russian course dashboards are the most translation-deficient part of the section because they combine missing locale namespaces with Russian-only runtime contracts.

## 7. Inherited vs local split

### Issues caused by global shell/layout/header
- Hardcoded logo alt text in `Layout`.
- Hardcoded admin title `Institution Dashboard` in `Layout`.
- Hardcoded avatar alt text `صورة شخصية` in `HeaderAuth`.
- `GlobalTopBar` forces LTR regardless of active locale.

### Issues caused by Languages section itself
- Missing landing/product/russian/plan/home locale coverage.
- Missing placement, lesson, enrollment, dashboard, and assessment locale namespaces.
- Russian-only route tree and Russian-only localStorage / activation flows.
- Comparison table hardcoded prices.
- `DashboardOverviewTab` RTL/fallback bug from duplicate declarations.
- Lesson vocabulary parser tied to a hardcoded visible string format.

### Issues caused by shared localization utilities/contracts
- Course product display still depends on `name_ar/name_en` and `description_ar/description_en` compatibility fields rather than a proper multilingual display contract.
- Runtime payloads emit raw seeded titles rather than translation keys / localized metadata objects.
- Direction handling is frequently implemented as Arabic-specific branching instead of locale metadata / RTL capability.

## 8. Remediation grouping recommendation

### Group A — Establish section translation contract
- Create/normalize complete `languages.*` namespaces for landing, enrollment, lesson, placement, assessment, dashboard, plan, onboarding, and my-learning surfaces.
- Treat this as one contract-definition pass, not scattered per-file additions.
- Expected finding coverage: LANG-001, LANG-002, LANG-003, LANG-004, LANG-005, LANG-006, LANG-007, LANG-008.

### Group B — Remove en/ar legacy display architecture from course products
- Replace `name_en/name_ar` and `description_en/description_ar` UI selection with a translation-key or localized-content contract.
- Stop using `startsWith('ar')` as the content chooser.
- Expected finding coverage: LANG-010, part of LANG-018.

### Group C — Generalize language-course routing/state contracts
- Move from Russian-only route and storage assumptions to a language-course route model that can host multiple languages without new one-off page trees.
- Normalize activation, onboarding, placement, dashboard, and exam state around a language parameter instead of hardcoded `russian` values.
- Expected finding coverage: LANG-009, LANG-011.

### Group D — Convert runtime metadata to translation-driven contracts
- Replace seeded human-facing titles/descriptions in dashboard, modules, lessons, checkpoint/exam notices, and assessment payloads with stable keys or localized metadata objects.
- Remove fallback copy like `Russian Shared Core`, `Section`, and `Intensive runtime assessment · ...`.
- Expected finding coverage: LANG-012, LANG-013.

### Group E — Repair section-specific wiring defects
- Fix `DashboardOverviewTab` duplicate declarations and forced `isAr = false`.
- Remove duplicated price literals from the Russian comparison table in favor of one pricing source of truth.
- Expected finding coverage: LANG-014, LANG-015.

### Group F — Coordinate with shared shell / localization owners
- Remove hardcoded shell text that renders on Languages pages.
- Replace hardcoded top-bar direction and Arabic-only direction checks with locale metadata / RTL capability.
- Expected finding coverage: LANG-016, LANG-017, LANG-018.

## 9. Closure discipline
- This report is **code-evidence only**.
- **No runtime proof yet**: no browser verification, no user-journey execution, no screenshot confirmation.
- **No remediation performed yet**: no component fixes, no locale-file remediation, no CRM changes, no backlog edits.
