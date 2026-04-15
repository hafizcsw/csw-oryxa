# Russian Intensive 750 Assessment Verification Checklist

## Goal
Verify that generated intensive assessment families run through the accepted learner-facing exam execution lane and persist real attempt truth.

## Preconditions
1. Learner resolves into intensive mode.
2. Shared-core dashboard/checkpoint/exam routes already work.
3. Russian migrations and seeds are applied through `20260322153000_russian_assessment_scoring_payloads.sql`.
4. `learning_exam_notices` is available for learner-visible exam-route evidence.

## Verification steps
1. Open `/languages/russian/dashboard?tab=exams` in intensive mode.
2. Confirm the intensive panel renders and shared-core exam launch card remains visible.
3. Open the current intensive weekly exam route and submit one real attempt.
4. Re-open the weekly exam and confirm latest-attempt summary is shown.
5. Confirm a matching `russian_exam_attempts` row exists for the weekly exam-set key.
6. Progress to the end of the current stage window and submit the stage exam.
7. Confirm stage status updates from the persisted attempt row.
8. If the learner is at weeks 19-20, submit Mock 01, Mock 02, and Final Readiness Gate.
9. Confirm the dashboard/runtime now reflects persisted attempt counts, retry/pass state, completed mock count, and persisted review-block state.
10. Confirm shared-core `shared_core_exam_set_01_v1` still launches and submits unchanged.

## Current expected limitations
- Intensive families are still generated/runtime-authored rather than backed by separate editorial item-bank rows.
- Review-required/remediation is now persisted additively for intensive proof, but some weak-area derivation still comes from runtime/readiness signals.
- Local browser attempt history remains only as a fallback compatibility mirror when no DB truth exists yet.

## Pass criteria
- Intensive generated families launch through the learner-facing route.
- Weekly/stage/mock/final submissions create real `russian_exam_attempts` rows.
- Dashboard intensive state changes after refresh based on persisted attempt truth.
- Shared-core learner-facing checkpoint/exam flow remains intact.
