# Russian Intensive 750 Runtime Verification Checklist

## Goal
Verify that the additive intensive runtime slice is visible and consistent with the latest persisted intensive truth model.

## Preconditions
1. Learner can sign in and open `/languages/russian/dashboard`.
2. Intensive mode is active by either:
   - persisted intensive-compatible enrollment/package truth, preferred, or
   - accepted onboarding fallback truth.
3. Russian shared-core runtime seeds and migrations are already applied.
4. `learning_exam_notices.external_link` support is already present.
5. `russian_intensive_review_states` migration is already applied for persisted review-block evidence.

## Verification steps
1. Open `/languages/russian/dashboard`.
2. Confirm the Intensive 750 panel renders without replacing shared-core cards.
3. Confirm the panel shows current stage, current week, weekly exam state, required review state, and readiness-to-advance state.
4. Open `/languages/russian/dashboard?tab=exams`.
5. Confirm the Exams tab renders:
   - current weekly exam card
   - current stage exam card when applicable
   - mock/final cards from generated runtime exam states
   - shared-core exam card.
6. Submit or preload one persisted intensive weekly attempt and refresh.
7. Confirm the weekly card status now matches the persisted attempt / notice state.
8. Submit or preload one persisted stage attempt and refresh.
9. Confirm the stage card status now matches the persisted attempt state rather than schedule-only truth.
10. If the learner is at weeks 19-20, submit or preload mock/final attempts and confirm final-readiness counts/status update.
11. If reviewers cannot naturally reach weeks 19-20, use `node scripts/bootstrap-russian-intensive-proof.mjs 19` or `20` and paste the emitted browser-console snippet.

## What should now be true
- Intensive runtime still remains additive.
- Weekly/stage/mock/final state now prefers persisted exam-attempt truth when available.
- Learner-visible intensive routes are mirrored into `learning_exam_notices`.
- `completedMockExams` and final-readiness status can now move from persisted attempt truth.

## Remaining accepted hybrid areas
- Remediation/review-required is now persisted additively in `russian_intensive_review_states`, but some weak-area derivation still originates from runtime/readiness signals rather than a fully separate remediation workflow engine.
- Local intensive attempt history remains only as compatibility fallback when DB truth is unavailable.

## Pass criteria
- No shared-core dashboard surface disappears.
- Intensive cards/statuses match persisted truth after refresh.
- Non-intensive learners still do not see intensive runtime surfaces.
