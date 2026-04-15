# Russian Learner-Facing Checkpoint / Exam Execution Lane

## Scope lock
This pack prepares the next major implementation lane only:
- learner-facing checkpoint launch from dashboard
- learner-facing exam launch from Exams tab
- eligibility guards
- fetch helpers for checkpoint/exam payloads
- submit helpers for `russian_assessment_attempts` and `russian_exam_attempts`
- post-submit sync back into dashboard / unlocks / readiness

This pack does **not** reopen research, blueprint, placement design, overall dashboard architecture, AI, teacher flows, marketplace, or broad i18n cleanup.

---

## 1. Execution plan

### Phase 1 — contracts and data adapters
1. Add learner-assessment route constants and page shells.
2. Add typed read contracts for checkpoint template launch data and exam-set launch data.
3. Add typed submit contracts for checkpoint attempts and exam attempts.
4. Add helper functions in the Russian runtime layer that:
   - validate learner eligibility from current dashboard/runtime truth,
   - fetch the launch payload,
   - persist the submission,
   - run post-submit sync,
   - return the updated dashboard-facing outcome.

### Phase 2 — checkpoint launch surface
1. Add a dashboard CTA when `dashboard.checkpoint.status` is `eligible` or `unlocked`.
2. Route the learner into a checkpoint runner page for `shared_core_checkpoint_01_v1`.
3. Show locked-state messaging when status is `locked`.
4. Show latest attempt summary when `latestAttemptId` / `latestPercentScore` already exists.

### Phase 3 — checkpoint runner and submit flow
1. Load checkpoint template payload by `template_key`.
2. Render a simple section/item runner using current stored blueprint JSON.
3. Submit answers into `russian_assessment_attempts`.
4. Immediately call `syncRussianLearnerState(userId)` after a successful submit.
5. Refetch dashboard payload and return the learner to `/languages/russian/dashboard` with the updated checkpoint + unlock state.

### Phase 4 — exam launch surface
1. Add an Exams-tab CTA when `dashboard.exam.status` is `eligible` or `unlocked`.
2. Route the learner into an exam runner page for `shared_core_exam_set_01_v1`.
3. Show locked-state messaging when status is `locked`.
4. Show latest attempt summary when an exam attempt already exists.

### Phase 5 — exam runner and submit flow
1. Load exam-set payload by `exam_set_key`.
2. Render a simple section/item runner using current stored exam blueprint JSON.
3. Submit answers into `russian_exam_attempts`.
4. Immediately call `syncRussianLearnerState(userId)` after a successful submit.
5. Refetch dashboard payload and return the learner to dashboard / Exams tab with updated exam status.

### Phase 6 — acceptance pass
1. Prove learner can launch Checkpoint 01 without admin SQL.
2. Prove learner can submit Checkpoint 01 and unlock modules 6-8 through app flow only.
3. Prove learner can launch Exam Set 01 without admin SQL.
4. Prove learner can submit Exam Set 01 and see completed state through app flow only.

---

## 2. Exact files to build

### A. Types / contracts
1. `src/types/russianAssessmentExecution.ts`
   - launch payload interfaces
   - attempt input/output interfaces
   - route-param-safe key types
   - submission result payloads

### B. Runtime data helpers
2. `src/lib/russianAssessmentExecution.ts`
   - checkpoint launch fetch helper
   - exam launch fetch helper
   - checkpoint submit helper
   - exam submit helper
   - eligibility guard helpers
   - post-submit sync helper

### C. Hooks
3. `src/hooks/useRussianCheckpointLaunch.ts`
   - fetch checkpoint launch payload
4. `src/hooks/useRussianExamLaunch.ts`
   - fetch exam launch payload
5. `src/hooks/useRussianCheckpointSubmit.ts`
   - checkpoint mutation state
6. `src/hooks/useRussianExamSubmit.ts`
   - exam mutation state

### D. Route pages
7. `src/pages/languages/RussianCheckpoint.tsx`
   - learner checkpoint runner page
8. `src/pages/languages/RussianExam.tsx`
   - learner exam runner page

### E. UI components
9. `src/components/languages/assessment/CheckpointLaunchCard.tsx`
   - dashboard launch card / CTA wrapper
10. `src/components/languages/assessment/ExamLaunchCard.tsx`
   - Exams-tab launch card / CTA wrapper
11. `src/components/languages/assessment/AssessmentRunner.tsx`
   - shared runner shell for checkpoint/exam flows
12. `src/components/languages/assessment/AssessmentSectionRenderer.tsx`
   - blueprint-driven renderer
13. `src/components/languages/assessment/AssessmentSubmitBar.tsx`
   - submit / loading / completion actions
14. `src/components/languages/assessment/AssessmentAttemptSummary.tsx`
   - latest attempt score / pass state / submitted time

### F. Existing files to extend only
15. `src/components/languages/dashboard/DashboardOverviewTab.tsx`
   - add checkpoint launch card / CTA using existing dashboard structure
16. `src/components/languages/dashboard/DashboardExamsTab.tsx` *(or current Exams tab file if differently named in repo)*
   - add exam launch card / CTA using existing tab structure
17. `src/App.tsx` or the current route registration file
   - add learner routes for checkpoint/exam execution
18. `src/lib/russianExecutionPackWriters.ts`
   - reuse `syncRussianLearnerState(userId)` as the authoritative post-submit sync path

### G. Docs / verification
19. `docs/russian/learner-assessment-execution-lane.md`
   - this contract
20. `docs/russian/staging-closure-handoff.md`
   - point the next-lane handoff at this file

---

## 3. Data flow

### Checkpoint launch flow
1. Dashboard loads existing `DashboardPayload`.
2. If `dashboard.checkpoint.status` is `eligible` or `unlocked`, show launch CTA.
3. CTA navigates to `/languages/russian/checkpoints/shared_core_checkpoint_01_v1`.
4. Route page calls checkpoint launch helper.
5. Launch helper reads:
   - checkpoint template row from `russian_assessment_templates`,
   - learner dashboard/runtime truth from `getRussianDashboardPayload(userId)`,
   - latest checkpoint attempt row from `russian_assessment_attempts` for summary state.
6. Helper returns a single launch payload to drive the page.

### Checkpoint submit flow
1. Learner submits answers.
2. Submit helper writes a new `russian_assessment_attempts` row.
3. Submit helper calls `syncRussianLearnerState(userId)`.
4. Submit helper refetches `getRussianDashboardPayload(userId)`.
5. UI redirects to dashboard and displays updated checkpoint/unlock state.

### Exam launch flow
1. Exams tab reads existing `DashboardPayload`.
2. If `dashboard.exam.status` is `eligible` or `unlocked`, show launch CTA.
3. CTA navigates to `/languages/russian/exams/shared_core_exam_set_01_v1`.
4. Route page calls exam launch helper.
5. Launch helper reads:
   - exam-set row from `russian_exam_sets`,
   - learner dashboard/runtime truth from `getRussianDashboardPayload(userId)`,
   - latest exam attempt row from `russian_exam_attempts`.
6. Helper returns a single launch payload to drive the page.

### Exam submit flow
1. Learner submits answers.
2. Submit helper writes a new `russian_exam_attempts` row.
3. Submit helper calls `syncRussianLearnerState(userId)`.
4. Submit helper refetches `getRussianDashboardPayload(userId)`.
5. UI redirects to dashboard / Exams tab with updated exam state.

---

## 4. Route plan

### New routes
- `/languages/russian/checkpoints/:templateKey`
- `/languages/russian/exams/:examSetKey`

### Route guard rules

#### Checkpoint route
Allow only when all are true:
- learner is activated for Russian
- learner has a Russian enrollment
- `templateKey === 'shared_core_checkpoint_01_v1'`
- dashboard checkpoint status is `eligible`, `unlocked`, or `passed`

Redirect to dashboard when:
- template key is unknown
- learner is not activated
- checkpoint status is `locked`

#### Exam route
Allow only when all are true:
- learner is activated for Russian
- learner has a Russian enrollment
- `examSetKey === 'shared_core_exam_set_01_v1'`
- dashboard exam status is `eligible`, `unlocked`, or `completed`

Redirect to dashboard or Exams tab when:
- exam set key is unknown
- learner is not activated
- exam status is `locked`

### Post-submit redirects
- checkpoint submit success -> `/languages/russian/dashboard`
- exam submit success -> `/languages/russian/dashboard?tab=exams`

---

## 5. Mutation / read contracts

### Read contract: checkpoint launch
```ts
interface RussianCheckpointLaunchPayload {
  courseKey: string;
  templateKey: string;
  title: string;
  version: string;
  checkpointFamilyKey: string | null;
  status: 'locked' | 'eligible' | 'unlocked' | 'passed';
  requiredCompletedLessons: number;
  currentCompletedLessons: number;
  passingScore: number | null;
  totalItems: number;
  lessonScopeKeys: string[];
  moduleScopeKeys: string[];
  scoringJson: Record<string, unknown>;
  blueprintJson: Record<string, unknown>;
  latestAttempt: {
    attemptId: string | null;
    percentScore: number | null;
    passed: boolean | null;
    submittedAt: string | null;
  };
}
```

### Read contract: exam launch
```ts
interface RussianExamLaunchPayload {
  courseKey: string;
  examSetKey: string;
  title: string;
  version: string;
  examFamily: string;
  status: 'locked' | 'eligible' | 'unlocked' | 'completed';
  releaseStage: 'draft' | 'active' | 'retired';
  targetScore: number;
  totalSections: number;
  totalItems: number;
  lessonScopeKeys: string[];
  moduleScopeKeys: string[];
  blueprintJson: Record<string, unknown>;
  latestAttempt: {
    attemptId: string | null;
    percentScore: number | null;
    passed: boolean | null;
    submittedAt: string | null;
  };
}
```

### Submit contract: checkpoint attempt
```ts
interface RussianCheckpointSubmitInput {
  templateKey: 'shared_core_checkpoint_01_v1';
  answersJson: Record<string, unknown>;
  durationSeconds: number;
}

interface RussianCheckpointSubmitResult {
  attemptId: string;
  percentScore: number;
  passed: boolean;
  submittedAt: string;
  dashboard: DashboardPayload;
}
```

### Submit contract: exam attempt
```ts
interface RussianExamSubmitInput {
  examSetKey: 'shared_core_exam_set_01_v1';
  answersJson: Record<string, unknown>;
  durationSeconds: number;
}

interface RussianExamSubmitResult {
  attemptId: string;
  percentScore: number;
  passed: boolean;
  submittedAt: string;
  dashboard: DashboardPayload;
}
```

### Persistence rules

#### Checkpoint submit helper writes
- table: `russian_assessment_attempts`
- required fields:
  - `user_id`
  - `course_id`
  - `assessment_template_id`
  - `status = 'submitted'` or `graded` depending on current scoring implementation
  - `score`
  - `percent_score`
  - `passed`
  - `attempt_no`
  - `duration_seconds`
  - `answers_json`
  - `dimension_scores_json`
  - `feedback_json`
  - `submitted_at`

#### Exam submit helper writes
- table: `russian_exam_attempts`
- required fields:
  - `user_id`
  - `course_id`
  - `exam_set_id`
  - `status = 'submitted'` or `graded` depending on current scoring implementation
  - `score`
  - `percent_score`
  - `passed`
  - `attempt_no`
  - `duration_seconds`
  - `answers_json`
  - `feedback_json`
  - `submitted_at`

### Post-submit sync contract
After either mutation succeeds, execute this exact sequence:
1. persist attempt row
2. call `syncRussianLearnerState(userId)`
3. call `getRussianDashboardPayload(userId)`
4. return the updated `DashboardPayload` in the mutation result

This keeps the current shared-core truth model intact and avoids introducing a second unlock/readiness authority.

---

## 6. UI behavior contract

### Dashboard checkpoint launch surface
- Use existing dashboard structure.
- Add a compact launch card in the current checkpoint area.
- States:
  - `locked`: disabled CTA + requirements text
  - `eligible` / `unlocked`: active CTA labeled Start Checkpoint 01
  - `passed`: active CTA labeled Review Checkpoint 01 plus latest score summary

### Exams tab launch surface
- Use existing Exams tab structure.
- Add a compact launch card for `shared_core_exam_set_01_v1`.
- States:
  - `locked`: disabled CTA + requirements text
  - `eligible` / `unlocked`: active CTA labeled Start Exam Set 01
  - `completed`: active CTA labeled Review Exam Set 01 plus latest score summary

### Runner page requirements
- show title / version / score target
- show attempt summary if prior attempt exists
- render sections/items from stored blueprint JSON
- disable duplicate submit while request is in flight
- show success/failure summary before redirect or on return state

---

## 7. Done definition
A. **Checkpoint flow done** when:
- learner can launch Checkpoint 01 from dashboard without admin help
- learner can submit answers through app UI
- app writes `russian_assessment_attempts`
- app syncs learner state
- dashboard reflects pass/fail and unlock changes immediately after submit

B. **Exam flow done** when:
- learner can launch Exam Set 01 from Exams tab without admin help
- learner can submit answers through app UI
- app writes `russian_exam_attempts`
- app syncs learner state
- dashboard / Exams tab reflects completion state immediately after submit

C. **Lane done** when:
- staging proof for checkpoint and exam no longer requires direct SQL writes
- current shared-core truth model remains unchanged
- no dashboard redesign was introduced

---

## 8. Progress estimate after this planning pack
- **Learner-facing checkpoint/exam lane:** **35%**
  - contracts, route plan, data flow, exact files, and done definition are now specified
  - implementation still remains to be built
- **Overall Russian section:** **76%**
  - shared-core slice remains the accepted code-ready baseline
  - the biggest remaining lane is now clearly bounded as learner-facing assessment execution
