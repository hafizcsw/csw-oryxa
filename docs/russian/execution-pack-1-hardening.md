# Russian Section — Execution Pack 1 Hardening

## 1. Collision audit

### Audit target
The original migration used generic public table names:
- `courses`
- `modules`
- `lessons`
- `lesson_sections`
- `readiness_dimensions`
- `learner_readiness_profiles`
- `placement_results`
- `learner_unlocks`
- `assessment_templates`
- `assessment_attempts`
- `exam_sets`
- `exam_attempts`

### Findings
1. **Immediate repo-level collision evidence is low but not enough to treat as safe.**
   - Repository search does not show existing SQL table creation for generic `courses`, `modules`, or `lessons` in this codebase today.
   - That only proves current absence, not future safety.
2. **Collision risk in `public` schema is still high.**
   - `courses`, `modules`, and `lessons` are globally generic product nouns.
   - This repo already contains multiple product domains: student portal, services, language learning, CRM-connected flows, ORX evidence, and future expansion surfaces.
   - Generic public names create avoidable ambiguity for analytics, BI, SQL joins, generated types, and later migrations.
3. **Generated client/type collision risk is real.**
   - Supabase type generation exposes public tables into one flat namespace.
   - Generic names would produce confusing client APIs and future name pressure.
4. **Migration rollback and maintenance risk is higher with generic names.**
   - Future feature work could reasonably need its own generic `courses` or `modules` concept.
   - Renaming after apply would be more expensive than hardening now.

### Audit conclusion
**Do not apply the generic table names.**
Use Russian-scoped public table names before first DB apply.

---

## 2. Final migration recommendation

### Recommended naming pattern
Use `russian_` + bounded-domain prefix.

### Final table set
- `russian_learning_courses`
- `russian_learning_modules`
- `russian_learning_lessons`
- `russian_learning_lesson_sections`
- `russian_readiness_dimensions`
- `russian_learner_readiness_profiles`
- `russian_placement_results`
- `russian_learner_unlocks`
- `russian_assessment_templates`
- `russian_assessment_attempts`
- `russian_exam_sets`
- `russian_exam_attempts`

### Recommendation details
1. Keep the tables in `public` to preserve the accepted architecture.
2. Rename **before first apply**, not through a follow-up rename migration.
3. Keep payload contracts unchanged; only persistence table names harden.
4. Keep existing bridge reference to `learning_enrollments` for compatibility with current Russian onboarding/enrollment flow.

---

## 3. Seed file plan

### Exact file structure
```text
supabase/seed/russian/
  01_readiness_dimensions.json
  02_courses.json
  03_modules_shared_core.json
  04_lessons_shared_core.json
  05_lesson_sections_shared_core.json
  06_assessment_templates.json
  07_exam_sets.json
```

### File responsibilities
1. `01_readiness_dimensions.json`
   - first 8 readiness dimensions
2. `02_courses.json`
   - shared core + academic core + medicine/engineering/humanities-social overlay course rows
3. `03_modules_shared_core.json`
   - first 10 shared-core modules
4. `04_lessons_shared_core.json`
   - first 30 shared-core lessons
5. `05_lesson_sections_shared_core.json`
   - 4 required sections per lesson: `intro`, `explanation`, `drill`, `quiz`
6. `06_assessment_templates.json`
   - placement + checkpoint 01 + checkpoint 02
7. `07_exam_sets.json`
   - first shared-core exam family

### First shared-core slice now prepared
- 5 course rows
- 10 shared-core modules
- 30 shared-core lessons
- 120 lesson-section rows
- 3 assessment templates
- 1 exam set

---

## 4. First wiring file list

### Placement results write
1. `src/pages/languages/PlacementTest.tsx`
2. `src/hooks/useLearningState.ts`
3. `src/lib/russianExecutionPackWriters.ts` *(new)*
4. `src/types/russianExecutionPack.ts`

### Learner readiness profiles compute/update
1. `src/lib/russianReadinessProfile.ts` *(new)*
2. `src/hooks/useRussianReadinessProfile.ts` *(new)*
3. `src/hooks/useLearningState.ts`
4. `src/lib/russianExecutionPackWriters.ts` *(new)*

### Learner unlocks write/update
1. `src/lib/russianLessonProgression.ts` *(new)*
2. `src/pages/languages/RussianLesson.tsx`
3. `src/lib/russianExecutionPackWriters.ts` *(new)*
4. `src/hooks/useRussianPlacementResult.ts` *(new)*

### Dashboard payload query
1. `src/hooks/useRussianDashboardData.ts` *(new)*
2. `src/pages/languages/RussianDashboard.tsx`
3. `src/components/languages/dashboard/DashboardOverviewTab.tsx`
4. `src/components/languages/dashboard/DashboardProgressTab.tsx`
5. `src/lib/russianDashboardContracts.ts` *(new)*
6. `src/types/russianExecutionPack.ts`

---

## 5. Implementation order

1. Finalize and apply the hardened migration with Russian-scoped table names.
2. Load `supabase/seed/russian/01_readiness_dimensions.json`.
3. Load `supabase/seed/russian/02_courses.json`.
4. Load `supabase/seed/russian/03_modules_shared_core.json`.
5. Load `supabase/seed/russian/04_lessons_shared_core.json`.
6. Load `supabase/seed/russian/05_lesson_sections_shared_core.json`.
7. Load `supabase/seed/russian/06_assessment_templates.json`.
8. Load `supabase/seed/russian/07_exam_sets.json`.
9. Add placement persistence writer to `russian_placement_results`.
10. Add readiness compute/update writer to `russian_learner_readiness_profiles`.
11. Add unlock persistence writer to `russian_learner_unlocks`.
12. Add dashboard aggregate query over course graph + readiness + unlocks + latest attempts.
13. Swap dashboard read path to the new aggregate query.
14. Then implement checkpoint 01 unlock/write path.
