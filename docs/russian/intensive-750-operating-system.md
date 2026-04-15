# Russian Intensive 750 USD Track Operating System

## 1. Executive snapshot
- Program key: `russian_intensive_750_v1`.
- Baseline held fixed: shared-core truth model, execution-pack foundation, learner readiness/unlocks model, checkpoint/exam runtime model, and learner-facing checkpoint/exam execution lane.
- Intensive scope: 120 lessons delivered over 20 weeks at 6 lessons per week.
- Operating distinction: this is not a longer content list; it is an assessment-gated staged program with mandatory weekly exams, stage exams, milestone exams, mock exams, and readiness-based advancement.
- Package positioning in system logic:
  - `250_usd` = lower-intensity completion-first lane.
  - `500_usd` = medium-intensity stage-gated lane.
  - `750_usd` = high-intensity assessment-gated lane with stricter review closure and deeper final readiness proof.

## 2. Intensive 750 operating model

### 2.1 Core runtime rules
```json
{
  "programKey": "russian_intensive_750_v1",
  "totalLessons": 120,
  "totalWeeks": 20,
  "lessonsPerWeek": 6,
  "studyDaysPerWeek": 6,
  "weeklyVocabularyTarget": {
    "newWords": 45,
    "reviewWords": 90,
    "retentionTargetPercent": 82
  },
  "homeworkExpectation": {
    "focusedReviewBlocks": 3,
    "writingTasks": 2,
    "listeningTasks": 2,
    "minimumIndependentStudyMinutes": 300
  },
  "advancementMode": "assessment_gated",
  "reviewStrictness": "required_before_advance",
  "finalReadinessDepth": "deep"
}
```

### 2.2 Stage architecture
| stage key | lesson range | week range | objective | readiness target | exam/checkpoint gates | unlock to next stage |
|---|---:|---:|---|---|---|---|
| `foundation_bootcamp` | 1-24 | 1-4 | Stabilize script, sound decoding, survival interaction, and accelerated-study stamina. | `building`, 42+, target `A0+` | Weekly Exams W01-W04, Foundation Stage Exam W04 | Lessons 1-24 complete + weekly exams clear + stage exam pass 70%+ |
| `core_beginner_structure` | 25-48 | 5-8 | Build reliable sentence formation, controlled case awareness, and early reading/listening discipline. | `building`, 55+, target `A1` | Weekly Exams W05-W08, Stage Exam W08, Milestone Exam 01 W08 | Lessons 25-48 complete + remediation closed + stage exam 72%+ + milestone 74%+ |
| `academic_core` | 49-78 | 9-13 | Establish academic reading, lecture-response, note handling, and paragraph writing. | `on_track`, 68+, target `A1+` | Weekly Exams W09-W13, Stage Exam W13, Milestone Exam 02 W13 | Lessons 49-78 complete + stage exam 75%+ + milestone 76%+ + no high writing/listening weakness |
| `track_overlay` | 79-102 | 14-17 | Attach discipline overlays while keeping shared-core academic flow intact. | `on_track`, 78+, target `A2-` | Weekly Exams W14-W17, Stage Exam W17, Milestone Exam 03 W17 | Lessons 79-102 complete + overlay remediation closed + stage exam 78%+ + milestone 80%+ |
| `intensive_exam_readiness` | 103-120 | 18-20 | Convert learned Russian into timed exam readiness through mocks, review compression, and final proof. | `ready`, 86+, target `A2` | Weekly Exams W18-W20, Mock Exam 01 W19, Mock Exam 02 W20, Final Readiness Gate W20 | Program completion only after all lessons complete + both mocks submitted + final gate 82%+ + no unresolved blocking weakness |

## 3. Weekly rhythm map

### 3.1 Fixed weekly rhythm
| operating variable | 750 intensive rule |
|---|---|
| Lessons per week | 6 |
| Active study days | 6 |
| New vocabulary target | 45 |
| Required vocabulary review | 90 reviewed items |
| Retention target | 82% |
| Focused review blocks | 3 per week |
| Writing tasks | 2 per week |
| Listening tasks | 2 per week |
| Independent study floor | 300 minutes |
| Weekly exam cadence | Every week after lesson 6 |
| Weekly review window | 3 days after weekly exam if failed |

### 3.2 Weekly state contract
```json
{
  "weekNumber": 10,
  "stageKey": "academic_core",
  "lessonRange": { "start": 55, "end": 60 },
  "lessonCompletionTarget": 6,
  "vocabularyTarget": { "newWords": 45, "reviewWords": 90 },
  "weeklyExamKey": "weekly_exam_w10",
  "weeklyExamDueAfterLesson": 60,
  "weeklyExamBlocking": true,
  "reviewWindowDays": 3,
  "unlocksNextWeekWhen": [
    "lessons_55_60_completed",
    "weekly_exam_w10_passed_or_cleared_on_retry",
    "required_review_blocks_completed"
  ]
}
```

## 4. Assessment cadence map

| layer | cadence | blocking | pass threshold | runtime effect |
|---|---|---:|---:|---|
| Lesson checks | Every lesson | Review-blocking | 80% | Unlocks next lesson inside the week; failed checks assign review blocks. |
| Weekly exams | Every week | Hard-blocking | 72% | Unlocks next week; failed exam locks next week until remediation + retry. |
| Stage exams | Weeks 4, 8, 13, 17 | Hard-blocking | 70% minimum, with stage-specific higher unlock thresholds | Unlocks next stage only when weekly obligations are also clear. |
| Milestone exams | Weeks 8, 13, 17 | Review-blocking | 74-80% by stage | Confirms cumulative retention; failed milestone leaves learner conditional with mandatory remediation. |
| Mock exams | Weeks 19, 20 | Hard-blocking | 80% | Required before final completion; weak-area output feeds final readiness state. |
| Final readiness gate | Week 20 close | Hard-blocking | 82% | Marks learner final-ready for intensive completion. |

## 5. Unlock / pass / review / retry rules

### 5.1 Lesson-to-lesson
- A lesson is considered operationally complete only when all required sections are complete and the lesson check reaches 80%.
- If a lesson check is below 80%, the learner receives targeted review blocks tied to weak dimensions.
- The next lesson within the same week stays conditionally available only after required review is completed.

### 5.2 Week-to-week
- Next week unlocks only when all 6 lessons are complete, the weekly exam is passed at 72%+, and all required review blocks are closed.
- Weekly exam failure creates `review_required` state and locks the next week.
- The learner gets up to 2 weekly exam retries in the 750 package.
- If both retries fail, the week is repeated and the dashboard marks `repeat_week_required`.

### 5.3 Stage-to-stage
- Next stage unlocks only when the stage lesson range is complete, all weekly exams in the stage are passed, the stage exam is passed, and no blocking weak area remains unresolved.
- Milestone exam failure does not reopen old stages, but it does prevent the learner from entering the next stage in `ready_to_advance` state; the learner enters `conditional_progress` until remediation closes.

### 5.4 Review / remediation triggers
| trigger | system action |
|---|---|
| Lesson check below 80% | Assign lesson-level review bundle. |
| Weekly exam below 72% | Lock next week, assign weekly remediation bundle, require retry. |
| Stage exam below threshold | Block next stage and require review week repeat. |
| Milestone exam below threshold | Allow only conditional continuation with mandatory review workload attached. |
| Mock exam below 80% | Keep learner in final readiness review mode and require mock retake. |
| Any high-severity weak area at stage close | Prevent stage advancement even if score thresholds are met. |

## 6. Package differentiation logic (250 / 500 / 750)

| logic area | `250_usd` | `500_usd` | `750_usd` |
|---|---|---|---|
| Lessons per week | 3 | 4 | 6 |
| Weekly vocabulary target | 24 | 32 | 45 |
| Lesson checks | Completion-first | Mastery-gated | Mastery-gated |
| Weekly exams | None | Biweekly | Weekly |
| Stage exams | 2 | 4 | 4 |
| Mock exams | 0 | 1 | 2 |
| Required review on weakness | No | Yes | Yes |
| Review unlock threshold | 60% | 68% | 75% |
| Max retries before repeat week | 0 | 1 | 2 |
| Weekly unlock mode | Calendar-based | Completion-based | Assessment-gated |
| Next-stage gate | Lesson completion | Stage exam pass | Stage exam + readiness + review closure |
| Final readiness depth | Light | Standard | Deep |

### 6.1 Operational meaning of the 750 tier
The `750_usd` package is operationally stricter in five ways:
1. **Intensity**: 6 lessons/week and 45 new words/week instead of 3-4 lessons/week.
2. **Assessment frequency**: a weekly exam every week, not none or biweekly only.
3. **Review strictness**: unresolved review blocks block advancement, not just recommendations.
4. **Progression gating**: next week and next stage depend on assessment performance, not calendar or completion alone.
5. **Exam readiness depth**: two mock exams plus a final readiness gate are mandatory before completion.

## 7. Intensive dashboard contract

### 7.1 Extension rule
Keep the current shared-core dashboard architecture intact and add an intensive-mode extension payload rather than replacing existing dashboard surfaces.

### 7.2 Screen/state contract
```json
{
  "intensive750": {
    "stageKey": "academic_core",
    "stageTitle": "Academic Core",
    "currentWeek": 10,
    "weekStatus": "review_required",
    "lessonsDueThisWeek": [
      { "lessonRangeLabel": "L55-L56", "lessonNumbers": [55, 56], "status": "completed" },
      { "lessonRangeLabel": "L57-L58", "lessonNumbers": [57, 58], "status": "available" },
      { "lessonRangeLabel": "L59-L60", "lessonNumbers": [59, 60], "status": "review_required" }
    ],
    "weeklyExam": {
      "examKey": "weekly_exam_w10",
      "status": "due",
      "blocking": true,
      "dueAfterLesson": 60,
      "weakAreas": ["academic_reading", "writing_output"]
    },
    "stageExam": {
      "examKey": null,
      "status": "locked",
      "blocking": true
    },
    "weakAreas": [
      {
        "areaKey": "academic_reading",
        "label": "Academic reading",
        "severity": "high",
        "source": "weekly_exam"
      }
    ],
    "requiredReview": {
      "reviewBlockIds": ["review_w10_reading_01"],
      "mustCompleteBeforeAdvance": true
    },
    "readinessToAdvance": {
      "nextWeekReady": false,
      "nextStageReady": false,
      "reasons": ["Weekly exam not passed", "High-severity weak area remains open"]
    },
    "finalExamReadiness": {
      "readinessStatus": "building",
      "completedMockExams": 0,
      "targetMockExams": 2
    }
  }
}
```

### 7.3 Dashboard fields required beyond shared-core baseline
- current stage
- current week
- lessons due this week
- weekly exam state
- stage exam state
- weak areas
- required review
- readiness to advance
- final exam readiness

## 8. Data/state contract additions

### 8.1 Contract additions mapped to current execution-pack model
These are additive contracts layered onto the current `DashboardPayload`, readiness payload, and unlock/progression state. No parallel learner path is introduced.

```json
{
  "stageProgress": {
    "stageKey": "academic_core",
    "stageStatus": "in_progress",
    "lessonRange": { "start": 49, "end": 78 },
    "completedLessonCount": 12,
    "requiredStageExamKey": "stage_exam_academic_core_w13",
    "stageUnlocked": true,
    "nextStageUnlocked": false
  },
  "weeklyStatus": {
    "weekNumber": 10,
    "weeklyExamKey": "weekly_exam_w10",
    "weeklyExamStatus": "retry_required",
    "remediationStatus": "assigned",
    "unlockedNextWeek": false
  },
  "weeklyExamState": {
    "attemptCount": 2,
    "maxRetries": 2,
    "bestScore": 69,
    "blocking": true
  },
  "levelExamState": {
    "stageExamKey": "stage_exam_academic_core_w13",
    "status": "locked",
    "requiredScore": 75,
    "blocking": true
  },
  "reviewRequiredState": {
    "hasRequiredReview": true,
    "reviewBlockIds": ["review_w10_reading_01"],
    "blockingReasons": ["weekly_exam_failure", "high_severity_reading"]
  },
  "intensiveReadinessState": {
    "overallStatus": "review_required",
    "readinessScore": 66,
    "minimumAdvancementScore": 68,
    "blockingReasons": ["Weekly exam below threshold"],
    "recommendedActions": ["Complete reading review", "Retry weekly exam"]
  }
}
```

### 8.2 Mapping notes
- `stageProgress` overlays the existing module/lesson progression truth rather than replacing it.
- `weeklyStatus` groups contiguous lesson ranges into dashboard-operable week units.
- `weeklyExamState` and `levelExamState` reuse the checkpoint/exam runtime approach and introduce cadence-specific keys only.
- `reviewRequiredState` can be derived from assessment attempts + readiness weak areas + remediation completion state.
- `intensiveReadinessState` extends the current readiness model with advancement-specific blocking reasons.

## 9. 120-lesson sequence map

### 9.1 Week-by-week implementation map
| week | lessons | stage | exam insertion | milestone | overlay mode |
|---:|---:|---|---|---|---|
| 1 | 1-6 | Foundation Bootcamp | Weekly Exam W01 | - | Shared core |
| 2 | 7-12 | Foundation Bootcamp | Weekly Exam W02 | - | Shared core |
| 3 | 13-18 | Foundation Bootcamp | Weekly Exam W03 | - | Shared core |
| 4 | 19-24 | Foundation Bootcamp | Weekly Exam W04 + Foundation Stage Exam | - | Shared core |
| 5 | 25-30 | Core Beginner Structure | Weekly Exam W05 | - | Shared core |
| 6 | 31-36 | Core Beginner Structure | Weekly Exam W06 | - | Shared core |
| 7 | 37-42 | Core Beginner Structure | Weekly Exam W07 | - | Shared core |
| 8 | 43-48 | Core Beginner Structure | Weekly Exam W08 + Stage Exam | Milestone Exam 01 | Shared core |
| 9 | 49-54 | Academic Core | Weekly Exam W09 | - | Shared core |
| 10 | 55-60 | Academic Core | Weekly Exam W10 | - | Shared core |
| 11 | 61-66 | Academic Core | Weekly Exam W11 | - | Shared core |
| 12 | 67-72 | Academic Core | Weekly Exam W12 | - | Shared core |
| 13 | 73-78 | Academic Core | Weekly Exam W13 + Stage Exam | Milestone Exam 02 | Shared core |
| 14 | 79-84 | Track Overlay | Weekly Exam W14 | - | Overlay attached |
| 15 | 85-90 | Track Overlay | Weekly Exam W15 | - | Overlay attached |
| 16 | 91-96 | Track Overlay | Weekly Exam W16 | - | Overlay attached |
| 17 | 97-102 | Track Overlay | Weekly Exam W17 + Stage Exam | Milestone Exam 03 | Overlay attached |
| 18 | 103-108 | Intensive Exam Readiness | Weekly Exam W18 | - | Overlay active |
| 19 | 109-114 | Intensive Exam Readiness | Weekly Exam W19 + Mock Exam 01 | Mock 01 | Overlay active |
| 20 | 115-120 | Intensive Exam Readiness | Weekly Exam W20 + Mock Exam 02 + Final Gate | Mock 02 + Final readiness | Overlay active |

### 9.2 Stage grouping summary
- Lessons 1-24: Foundation Bootcamp
- Lessons 25-48: Core Beginner Structure
- Lessons 49-78: Academic Core
- Lessons 79-102: Track Overlay
- Lessons 103-120: Intensive Exam Readiness

## 10. Track-aware intensive extension

### 10.1 Overlay attach point
Track overlays attach at **Stage 4 / Lesson 79**. Shared-core progression remains the truth baseline through Lesson 78.

### 10.2 Branches defined now
```json
{
  "overlayAttachStageKey": "track_overlay",
  "overlayAttachLessonStart": 79,
  "supportedTracks": [
    "medicine",
    "engineering",
    "humanities_social"
  ],
  "overlayRuntimeRule": "shared_core_lessons_continue_as_primary_sequence; overlay tasks swap vocabulary sets, reading passages, writing prompts, and selected exam items"
}
```

### 10.3 Adaptation logic by track
- **Medicine**: overlay weak areas emphasize terminology retention, patient/history style reading, and procedural listening cues.
- **Engineering**: overlay weak areas emphasize process description, diagram/data interpretation language, and precise instruction following.
- **Humanities/Social**: overlay weak areas emphasize argument summary, source commentary, and abstract academic vocabulary transfer.
- Intensive logic does not branch into separate programs; it only swaps overlay assets, overlay review bundles, and overlay-weighted exam items after Lesson 79.

## 11. File list for future implementation
- `src/types/russianIntensive750.ts`
- `src/lib/russianIntensive750Plan.ts`
- `src/types/russianExecutionPack.ts` *(optional additive payload extension for dashboard/readiness transport)*
- `src/lib/russianAssessmentExecution.ts` *(add weekly/stage/milestone/mock cadence key handling when runtime wiring starts)*
- `src/components/languages/dashboard/DashboardOverviewTab.tsx` *(render intensive stage/week/review state)*
- `src/components/languages/dashboard/DashboardExamsTab.tsx` *(render weekly/stage/mock/final readiness exam states)*
- `src/pages/languages/RussianDashboard.tsx` *(attach intensive-mode payload reader)*
- `supabase/seed/russian/*` *(future stage/week/exam cadence seed assets only when actual content rows are authored)*
- `docs/russian/intensive-750-operating-system.md`

## 12. Recommended execution order
1. Lock the operating contracts in `src/types/russianIntensive750.ts`.
2. Lock the program map/constants in `src/lib/russianIntensive750Plan.ts`.
3. Extend dashboard payload typing additively in `src/types/russianExecutionPack.ts` when transport wiring begins.
4. Add cadence-aware runtime readers/writers for weekly exam, stage exam, milestone, mock, and final readiness state.
5. Add dashboard rendering for intensive stage/week/review/readiness surfaces.
6. Add seed/runtime rows for new assessment families only after the operating contract is approved.
7. Add overlay-specific assets for medicine / engineering / humanities-social starting at Lesson 79.

## 13. Progress estimate and closure state

### 13.1 Progress estimate
- Intensive 750 track logic block: **92% closed**.
- Russian section overall: **74% closed**.

### 13.2 What this block closes
- Full 120-lesson intensive program architecture.
- Stage map with explicit objectives, readiness targets, gates, and unlock rules.
- Weekly rhythm model that can drive dashboard state later.
- Exact assessment cadence and blocking logic.
- Operational package differentiation for `250_usd`, `500_usd`, and `750_usd`.
- Intensive dashboard extension contract.
- Additive data/state contract layer for stage, week, review, and readiness.
- Implementation-ready 120-lesson sequencing map.
- Track-aware overlay attach rule for medicine, engineering, and humanities-social.

### 13.3 What remains after this block
- Wire these new intensive contracts into the real dashboard payload and UI surfaces.
- Add actual assessment seed rows for weekly/stage/milestone/mock/final readiness families.
- Author overlay-specific lessons/tasks/assets for medicine, engineering, and humanities-social from Lesson 79 onward.
- Connect remediation completion state into runtime writers/unlocks.
- After this, placement redesign can be taken as a separate block if still needed, but it is not opened here.
