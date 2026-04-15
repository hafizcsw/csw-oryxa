# Russian Section Staging Closure Handoff

## Current closure target
The Russian section is no longer blocked on shared-core learner execution or intensive generated-family persistence. The remaining closure step is **capturing final staging/live runtime-proof evidence**.

## Source of truth
Use `docs/russian/runtime-verification-checklist.md` as the executable proof pack.

## Exact apply order
1. `20260322110000_russian_execution_pack_1_foundation.sql`
2. `20260322124500_russian_execution_pack_1_runtime_closure.sql`
3. `20260322153000_russian_assessment_scoring_payloads.sql`
4. `20260323120000_russian_intensive_review_state.sql`

## Exact seed order
1. `01_readiness_dimensions.json`
2. `02_courses.json`
3. `03_modules_shared_core.json`
4. `04_lessons_shared_core.json`
5. `05_lesson_sections_shared_core.json`
6. `06_assessment_templates.json`
7. `07_exam_sets.json`

## What must be evidenced before calling the section runtime-proven
1. Shared-core placement, checkpoint, and exam learner journeys.
2. Real scored checkpoint/exam attempt payloads in DB.
3. Intensive runtime panel and Exams tab rendering additively.
4. Real persisted weekly + stage intensive attempts.
5. Real persisted mock/final attempts if week 19-20 proof is available.
6. Matching screenshots + SQL outputs with no UI/DB divergence.

## Smallest true blockers remaining
1. Final staging/live screenshot + SQL capture has not yet been recorded.
2. Week 19-20 proof still requires either a naturally progressed learner or the QA bootstrap script.

## Related docs
- Final proof pack: `docs/russian/runtime-verification-checklist.md`
- Intensive runtime proof: `docs/russian/intensive-750-runtime-verification-checklist.md`
- Intensive assessment proof: `docs/russian/intensive-750-assessment-verification-checklist.md`
