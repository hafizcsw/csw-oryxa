# Russian Section Final Runtime-Proof Checklist

## Goal
Prove the accepted Russian section baseline end to end in staging/live with one executable pack covering:
- shared-core runtime truth
- learner-facing checkpoint/exam execution flow
- real scoring payloads
- intensive 750 runtime wiring
- intensive persisted truth for generated families
- latest i18n/localization surfaces needed for learner verification

This checklist is the current source of truth for calling the Russian section **runtime-proven**.

## 1. Runtime-proof dependency audit

### Platform/runtime prerequisites already expected in the environment
1. Authenticated learner login works.
2. `learning_enrollments` already exists and can hold a Russian enrollment.
3. `learning_exam_notices` exists with `external_link` support for learner-visible intensive exam notices.
   - base table: `supabase/migrations/20260321143555_2fc9271c-c765-43d8-8783-ceec548d90a3.sql`
   - `external_link`: `supabase/migrations/20260321150023_6233b675-e5ee-4f20-8a87-a475b3ee7385.sql`

### Russian apply order
Apply Russian migrations in this exact order:
1. `supabase/migrations/20260322110000_russian_execution_pack_1_foundation.sql`
2. `supabase/migrations/20260322124500_russian_execution_pack_1_runtime_closure.sql`
3. `supabase/migrations/20260322153000_russian_assessment_scoring_payloads.sql`
4. `supabase/migrations/20260323120000_russian_intensive_review_state.sql`

### Russian seed order
Import Russian seed data in this exact order:
1. `supabase/seed/russian/01_readiness_dimensions.json`
2. `supabase/seed/russian/02_courses.json`
3. `supabase/seed/russian/03_modules_shared_core.json`
4. `supabase/seed/russian/04_lessons_shared_core.json`
5. `supabase/seed/russian/05_lesson_sections_shared_core.json`
6. `supabase/seed/russian/06_assessment_templates.json`
7. `supabase/seed/russian/07_exam_sets.json`

### Pre-flight validation
Run this before live verification:
- `node scripts/validate-russian-shared-core-runtime.mjs`
- `node scripts/validate-russian-runtime-proof-pack.mjs`

### Required rows before user journeys begin
- `russian_shared_core_v1` exists in `russian_learning_courses`.
- `shared_core_checkpoint_01_v1` exists in `russian_assessment_templates`.
- `shared_core_exam_set_01_v1` exists in `russian_exam_sets` with `release_stage = 'active'`.
- learner has a Russian `learning_enrollments` row.
- for intensive proof, learner is intensive-active by either:
  - persisted enrollment/course-type truth, preferred, or
  - accepted onboarding fallback truth.

## 2. Exact staging/live user journeys

### Journey A — shared-core placement and checkpoint proof
1. Sign in as the staging learner.
2. Open `/languages/russian/placement-test`.
3. Submit the placement flow.
4. Open `/languages/russian/dashboard`.
5. Capture the placement-result evidence and dashboard evidence.
6. Complete the first 15 runtime lessons.
7. Re-open the dashboard and confirm Checkpoint 01 is `eligible` or `unlocked`.
8. Complete `checkpoint_01_a`, `checkpoint_01_b`, and `checkpoint_01_review`.
9. Confirm the dashboard still does **not** show checkpoint `passed` before a real attempt row exists.
10. Launch Checkpoint 01 from the learner-facing flow and submit a real attempt.
11. Refresh the dashboard once and confirm:
   - checkpoint becomes `passed`
   - post-checkpoint modules unlock
   - readiness profile points at the latest checkpoint attempt.

### Journey B — shared-core exam proof
1. Continue through the remaining shared-core lessons through lesson 30.
2. Open `/languages/russian/dashboard?tab=exams`.
3. Confirm `shared_core_exam_set_01_v1` is `eligible` or `unlocked` only after lesson completion + checkpoint pass.
4. Launch the shared-core exam through the learner-facing flow.
5. Submit one real attempt.
6. Confirm the exam state becomes `completed` only if the attempt is `passed = true`.
7. Confirm scored payload evidence exists in `russian_exam_attempts.feedback_json`.

### Journey C — intensive activation and runtime panel proof
1. Put the learner into intensive mode.
   - Preferred: persisted intensive-compatible enrollment/package truth.
   - Accepted fallback: onboarding state with `goal = prep_exam | university_study`, `timeline = 3_months | 1_month`, and `dailyMinutes >= 45`.
   - For weeks 19-20 proof support, you may bootstrap a reviewer-safe QA state with `node scripts/bootstrap-russian-intensive-proof.mjs 19` or `node scripts/bootstrap-russian-intensive-proof.mjs 20`, then paste the emitted browser-console snippet before reloading the dashboard.
2. Open `/languages/russian/dashboard`.
3. Confirm the intensive panel renders without replacing shared-core surfaces.
4. Confirm the panel shows:
   - current stage
   - current week
   - weekly exam state
   - review-required state
   - readiness-to-advance state
5. Open `/languages/russian/dashboard?tab=exams` and confirm the intensive cards render alongside the shared-core exam card.

### Journey D — intensive weekly + stage persistence proof
1. From the Exams tab, open the current intensive weekly exam route.
2. Submit one real weekly attempt.
3. Return to the Exams tab and confirm:
   - weekly card status reflects the attempt outcome
   - latest-attempt summary loads on re-open
   - `learning_exam_notices` reflects the route/status.
4. Progress the learner to the end of the current intensive stage window.
5. Open the stage exam route.
6. Submit one real stage attempt.
7. Confirm stage status now updates from persisted attempt truth rather than schedule-only status.

### Journey E — intensive readiness proof (week 19-20 only)
1. Open `mock_exam_01_w19` and submit one real attempt.
2. Open `mock_exam_02_w20` and submit one real attempt.
3. Open `final_readiness_gate_w20` and submit one real attempt.
4. Confirm the dashboard/runtime now reflects:
   - mock attempt counts
   - mock pass/retry status
   - final readiness gate pass/retry status
   - `completedMockExams`
   - review-required / readiness blocking reasons.

## 3. Exact screenshots to capture

Capture these screenshots in this exact order:
1. Placement result screen after submission.
2. Dashboard overview immediately after placement.
3. Dashboard overview after 15 lessons with Checkpoint 01 visible as eligible/unlocked.
4. Dashboard overview immediately before checkpoint submission, showing checkpoint not yet passed.
5. Dashboard overview after checkpoint pass, showing post-checkpoint modules unlocked.
6. Exams tab showing shared-core exam availability.
7. Shared-core exam result screen after submission.
8. Intensive dashboard overview with the Intensive 750 panel visible.
9. Intensive Exams tab showing weekly + stage/mock/final cards alongside the shared-core exam card.
10. Weekly intensive exam result screen after submission.
11. Intensive Exams tab after weekly submission showing updated status.
12. Stage exam result screen after submission.
13. If week 19-20 is available: mock/final readiness result screens and the post-submit Exams tab/dashboard state.

## 4. Exact SQL evidence to capture

Run and save these exact queries.

### Core seed/runtime existence
```sql
select course_key
from russian_learning_courses
where course_key = 'russian_shared_core_v1';

select template_key, passing_score
from russian_assessment_templates
where template_key = 'shared_core_checkpoint_01_v1';

select exam_set_key, release_stage
from russian_exam_sets
where exam_set_key = 'shared_core_exam_set_01_v1';
```

### Placement + readiness
```sql
select placement_band,
       recommended_start_module_key,
       recommended_start_lesson_key,
       completed_at,
       result_payload
from russian_placement_results
where user_id = :user_id
order by completed_at desc;

select readiness_band,
       overall_readiness_score,
       latest_checkpoint_attempt_id,
       latest_exam_attempt_id,
       dimensions_json,
       calculated_at
from russian_learner_readiness_profiles
where user_id = :user_id;
```

### Unlock proof
```sql
select unlock_type,
       unlock_source,
       unlocked_at,
       module_id,
       lesson_id,
       assessment_template_id,
       exam_set_id
from russian_learner_unlocks
where user_id = :user_id
order by unlocked_at asc;

select lesson_slug, module_slug, completed_at
from learning_lesson_progress
where user_id = :user_id
order by completed_at asc;
```

### Shared-core attempts with latest scoring payloads
```sql
select a.id,
       t.template_key,
       a.percent_score,
       a.passed,
       a.section_scores_json,
       a.feedback_json,
       a.submitted_at
from russian_assessment_attempts a
join russian_assessment_templates t on t.id = a.assessment_template_id
where a.user_id = :user_id
order by a.submitted_at desc;

select e.id,
       s.exam_set_key,
       e.percent_score,
       e.passed,
       e.section_scores_json,
       e.feedback_json,
       e.review_json,
       e.submitted_at
from russian_exam_attempts e
join russian_exam_sets s on s.id = e.exam_set_id
where e.user_id = :user_id
order by e.submitted_at desc;
```

### Intensive persisted-truth proof
```sql
select review_status,
       stage_key,
       week_number,
       source_exam_key,
       review_block_ids,
       blocking_reasons,
       weak_area_keys,
       resolved_at,
       updated_at
from russian_intensive_review_states
where user_id = :user_id
order by updated_at desc;

select exam_set_key,
       exam_family,
       metadata,
       release_stage,
       updated_at
from russian_exam_sets
where exam_set_key like 'weekly_exam_%'
   or exam_set_key like 'stage_exam_%'
   or exam_set_key like 'milestone_exam_%'
   or exam_set_key like 'mock_exam_%'
   or exam_set_key like 'final_readiness_gate_%'
order by exam_set_key asc;

select e.id,
       s.exam_set_key,
       s.exam_family,
       e.attempt_no,
       e.percent_score,
       e.passed,
       e.section_scores_json,
       e.feedback_json,
       e.submitted_at
from russian_exam_attempts e
join russian_exam_sets s on s.id = e.exam_set_id
where e.user_id = :user_id
  and (
    s.exam_set_key like 'weekly_exam_%'
    or s.exam_set_key like 'stage_exam_%'
    or s.exam_set_key like 'milestone_exam_%'
    or s.exam_set_key like 'mock_exam_%'
    or s.exam_set_key like 'final_readiness_gate_%'
  )
order by e.submitted_at desc;

select title,
       status,
       exam_type,
       external_link,
       created_at
from learning_exam_notices
where user_id = :user_id
  and external_link like '/languages/russian/exams/%'
order by created_at desc;
```

## 5. Exact pass/fail conditions

### Pass conditions for runtime-proven status
- Migrations apply cleanly in order.
- Seeds load in order with no FK/import failures.
- Shared-core placement writes placement + readiness + starter-unlock evidence.
- Checkpoint only becomes `passed` after a real `russian_assessment_attempts` pass row exists.
- Post-checkpoint modules unlock only after that passed checkpoint attempt exists.
- Shared-core exam only becomes available after the required lesson + checkpoint state exists.
- Shared-core checkpoint/exam learner flows submit real scored rows with populated `section_scores_json` / `feedback_json` payloads.
- Intensive dashboard/exams surfaces render additively without breaking shared-core surfaces.
- Intensive weekly/stage/mock/final families submit real `russian_exam_attempts` rows.
- Intensive exam cards and readiness/review state match the persisted intensive attempt evidence and learner-visible `learning_exam_notices` evidence.
- Screenshots and SQL evidence agree.

### Fail conditions
- Any post-checkpoint module unlocks before a real passed checkpoint attempt exists.
- Shared-core exam appears unlocked/completed without the required lesson + checkpoint conditions.
- Checkpoint/exam attempt rows are missing scoring payloads after learner submission.
- Intensive weekly/stage/mock/final cards remain static or diverge from persisted DB truth after submission.
- `learning_exam_notices` does not reflect learner-visible intensive routes/status.
- UI evidence and SQL evidence disagree.

## 6. Smallest true blockers remaining before runtime-proven status
1. **Live end-to-end evidence still needs to be captured in a real staging/live environment.** The code/doc path is ready, but runtime-proven status still requires actual screenshots + SQL proof.
2. **Intensive review persistence is now additive, but deeper remediation semantics are still partly derived from runtime/readiness signals.** This no longer blocks runtime proof, but it is the main remaining gap before calling the lane fully production-hardened.
3. **Intensive proof at weeks 19-20 still requires either a naturally progressed learner or the QA bootstrap script plus live evidence capture.** Without that final live run, mock/final readiness proof remains pending.

## 7. Related focused docs
- Shared-core + final proof pack: `docs/russian/runtime-verification-checklist.md`
- Intensive runtime specialization: `docs/russian/intensive-750-runtime-verification-checklist.md`
- Intensive assessment specialization: `docs/russian/intensive-750-assessment-verification-checklist.md`
- Closure handoff summary: `docs/russian/staging-closure-handoff.md`
