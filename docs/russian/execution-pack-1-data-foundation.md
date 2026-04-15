# Russian Section — Execution Pack 1: Data/Foundation Layer

## 1. Migration plan

### Migration 01 — Course graph foundation
Create these tables in order:
1. `russian_learning_courses`
2. `russian_learning_modules`
3. `russian_learning_lessons`
4. `russian_learning_lesson_sections`

### Migration 02 — Readiness + placement foundation
Create these tables in order:
1. `russian_readiness_dimensions`
2. `russian_learner_readiness_profiles`
3. `russian_assessment_templates`
4. `russian_placement_results`
5. `russian_learner_unlocks`

### Migration 03 — Checkpoint + exam execution foundation
Create these tables in order:
1. `russian_assessment_attempts`
2. `russian_exam_sets`
3. `russian_exam_attempts`

### Migration 04 — Seed pass
Seed in this order:
1. readiness dimensions
2. courses
3. modules
4. lessons
5. lesson sections
6. assessment templates
7. exam sets

### Migration 05 — App wiring
Wire these app surfaces next:
1. placement submit → `russian_placement_results`
2. readiness recalculation job/function → `russian_learner_readiness_profiles`
3. dashboard query → `russian_learning_courses`, `russian_learning_modules`, `russian_learning_lessons`, `russian_learner_unlocks`, `russian_learner_readiness_profiles`, latest attempts
4. lesson completion + checkpoint pass → `russian_learner_unlocks`

---

## 2. Exact tables and fields

### `russian_learning_courses`
| field | type | required | notes |
|---|---|---:|---|
| id | uuid pk | yes | generated |
| course_key | text unique | yes | stable system key |
| language_code | text | yes | `ru` for this slice |
| title | text | yes | |
| description | text | no | |
| goal_type | text | yes | `prep_exam` / `university_study` / `daily_life` |
| academic_track | text | yes | `shared_foundation` / `academic_core` / `medicine` / `engineering` / `humanities_social` |
| delivery_mode | text | yes | `self_paced` baseline |
| visibility | text | yes | `draft` / `active` / `archived` |
| version | text | yes | start `v1` |
| placement_required | boolean | yes | default true |
| readiness_profile_enabled | boolean | yes | default true |
| dashboard_enabled | boolean | yes | default true |
| sort_order | integer | yes | |
| metadata | jsonb | yes | no contract-critical fields outside this doc |
| created_at | timestamptz | yes | |
| updated_at | timestamptz | yes | |

### `russian_learning_modules`
| field | type | required | notes |
|---|---|---:|---|
| id | uuid pk | yes | generated |
| course_id | uuid fk → `russian_learning_courses.id` | yes | cascade delete |
| module_key | text unique | yes | stable system key |
| slug | text unique | yes | route-safe |
| title | text | yes | |
| description | text | no | |
| module_type | text | yes | `instruction` / `checkpoint` / `review` / `exam_prep` |
| domain_track | text | yes | same track enum as course |
| cefr_band | text | no | `A0`, `A1`, `A1+`, `A2` as needed |
| ordinal | integer | yes | unique inside course |
| unlock_rule | jsonb | yes | progression gate |
| estimated_minutes | integer | yes | |
| checkpoint_family_key | text | no | links a checkpoint module family |
| metadata | jsonb | yes | |
| created_at | timestamptz | yes | |
| updated_at | timestamptz | yes | |

### `russian_learning_lessons`
| field | type | required | notes |
|---|---|---:|---|
| id | uuid pk | yes | generated |
| module_id | uuid fk → `russian_learning_modules.id` | yes | cascade delete |
| lesson_key | text unique | yes | stable system key |
| slug | text unique | yes | route-safe |
| title | text | yes | |
| lesson_type | text | yes | `content` / `practice` / `checkpoint` / `review` / `exam_set` |
| track_scope | text | yes | track gate |
| ordinal | integer | yes | unique inside module |
| estimated_minutes | integer | yes | |
| readiness_weight | numeric(5,2) | yes | contribution to readiness rollup |
| checkpoint_family_key | text | no | used for checkpoint lessons |
| unlock_rule | jsonb | yes | gate definition |
| metadata | jsonb | yes | |
| created_at | timestamptz | yes | |
| updated_at | timestamptz | yes | |

### `russian_learning_lesson_sections`
| field | type | required | notes |
|---|---|---:|---|
| id | uuid pk | yes | generated |
| lesson_id | uuid fk → `russian_learning_lessons.id` | yes | cascade delete |
| section_key | text unique | yes | stable system key |
| section_type | text | yes | `intro` / `explanation` / `example` / `drill` / `vocabulary` / `dialogue` / `quiz` / `reflection` |
| ordinal | integer | yes | unique inside lesson |
| title | text | no | |
| content_json | jsonb | yes | actual section payload |
| estimated_minutes | integer | yes | |
| is_required | boolean | yes | |
| mastery_gate | jsonb | yes | completion/checkpoint rules |
| created_at | timestamptz | yes | |
| updated_at | timestamptz | yes | |

### `russian_readiness_dimensions`
| field | type | required | notes |
|---|---|---:|---|
| id | uuid pk | yes | generated |
| dimension_key | text unique | yes | stable system key |
| label | text | yes | |
| description | text | no | |
| dimension_group | text | yes | `foundation` / `academic` / `discipline` / `exam` |
| score_unit | text | yes | baseline `percent` |
| max_score | numeric(5,2) | yes | baseline `100` |
| dashboard_order | integer | yes | render order |
| is_active | boolean | yes | |
| metadata | jsonb | yes | |
| created_at | timestamptz | yes | |
| updated_at | timestamptz | yes | |

### `russian_learner_readiness_profiles`
| field | type | required | notes |
|---|---|---:|---|
| id | uuid pk | yes | generated |
| user_id | uuid | yes | current learner |
| course_id | uuid fk → `russian_learning_courses.id` | yes | one active profile per course |
| enrollment_id | uuid fk → `learning_enrollments.id` | no | bridge to current enrollment model |
| profile_status | text | yes | `active` / `superseded` / `archived` |
| current_cefr_band | text | no | |
| readiness_band | text | yes | `emerging` / `building` / `on_track` / `ready` |
| overall_readiness_score | numeric(5,2) | yes | |
| shared_foundation_score | numeric(5,2) | yes | |
| academic_core_score | numeric(5,2) | yes | |
| discipline_overlay_score | numeric(5,2) | yes | |
| exam_readiness_score | numeric(5,2) | yes | |
| placement_result_id | uuid fk → `russian_placement_results.id` | no | latest placement source |
| latest_checkpoint_attempt_id | uuid fk → `russian_assessment_attempts.id` | no | |
| latest_exam_attempt_id | uuid fk → `russian_exam_attempts.id` | no | |
| dimensions_json | jsonb | yes | per-dimension snapshot |
| recommendations_json | jsonb | yes | next actions |
| snapshot_version | text | yes | start `v1` |
| calculated_at | timestamptz | yes | |
| created_at | timestamptz | yes | |
| updated_at | timestamptz | yes | |

### `russian_placement_results`
| field | type | required | notes |
|---|---|---:|---|
| id | uuid pk | yes | generated |
| user_id | uuid | yes | |
| course_id | uuid fk → `russian_learning_courses.id` | yes | |
| assessment_template_id | uuid fk → `russian_assessment_templates.id` | no | placement blueprint used |
| attempt_no | integer | yes | unique by user/course |
| raw_score | numeric(6,2) | yes | |
| normalized_score | numeric(6,2) | yes | |
| placement_band | text | yes | `start_from_zero` / `basics_refresh` / `early_academic` |
| recommended_course_key | text | no | route selection result |
| recommended_start_module_key | text | no | |
| recommended_start_lesson_key | text | no | |
| unlocked_module_keys | text[] | yes | initial unlocks |
| unlocked_lesson_keys | text[] | yes | initial unlocks |
| dimension_scores_json | jsonb | yes | placement-derived dimension scores |
| answer_map_json | jsonb | yes | raw answer contract |
| result_payload | jsonb | yes | direct API response snapshot |
| completed_at | timestamptz | yes | |
| created_at | timestamptz | yes | |

### `russian_learner_unlocks`
| field | type | required | notes |
|---|---|---:|---|
| id | uuid pk | yes | generated |
| user_id | uuid | yes | |
| course_id | uuid fk → `russian_learning_courses.id` | yes | |
| module_id | uuid fk → `russian_learning_modules.id` | no | one of module or lesson required |
| lesson_id | uuid fk → `russian_learning_lessons.id` | no | one of module or lesson required |
| unlock_type | text | yes | `module` / `lesson` / `checkpoint` / `exam_set` |
| unlock_source | text | yes | `placement` / `progression` / `manual` / `checkpoint_pass` / `exam_pass` |
| source_ref_id | uuid | no | source attempt/result id |
| unlocked_at | timestamptz | yes | |
| expires_at | timestamptz | no | null for persistent |
| created_at | timestamptz | yes | |

### `russian_assessment_templates`
| field | type | required | notes |
|---|---|---:|---|
| id | uuid pk | yes | generated |
| template_key | text unique | yes | stable system key |
| course_id | uuid fk → `russian_learning_courses.id` | yes | |
| template_type | text | yes | `placement` / `checkpoint` / `diagnostic` / `practice_exam` |
| checkpoint_family_key | text | no | e.g. `shared_core_checkpoint_01` |
| title | text | yes | |
| description | text | no | |
| version | text | yes | start `v1` |
| lesson_scope_keys | text[] | yes | lessons measured |
| module_scope_keys | text[] | yes | modules measured |
| track_scope | text | yes | |
| total_items | integer | yes | |
| passing_score | numeric(5,2) | no | |
| scoring_json | jsonb | yes | scoring rules |
| blueprint_json | jsonb | yes | item family blueprint |
| metadata | jsonb | yes | |
| created_at | timestamptz | yes | |
| updated_at | timestamptz | yes | |

### `russian_assessment_attempts`
| field | type | required | notes |
|---|---|---:|---|
| id | uuid pk | yes | generated |
| user_id | uuid | yes | |
| course_id | uuid fk → `russian_learning_courses.id` | yes | |
| assessment_template_id | uuid fk → `russian_assessment_templates.id` | yes | |
| learner_readiness_profile_id | uuid fk → `russian_learner_readiness_profiles.id` | no | |
| status | text | yes | `in_progress` / `submitted` / `graded` / `voided` |
| score | numeric(6,2) | yes | |
| percent_score | numeric(6,2) | yes | |
| passed | boolean | no | |
| attempt_no | integer | yes | unique by user/template |
| duration_seconds | integer | yes | |
| answers_json | jsonb | yes | |
| dimension_scores_json | jsonb | yes | |
| feedback_json | jsonb | yes | |
| submitted_at | timestamptz | yes | |
| created_at | timestamptz | yes | |
| updated_at | timestamptz | yes | |

### `russian_exam_sets`
| field | type | required | notes |
|---|---|---:|---|
| id | uuid pk | yes | generated |
| exam_set_key | text unique | yes | stable system key |
| course_id | uuid fk → `russian_learning_courses.id` | yes | |
| title | text | yes | |
| exam_family | text | yes | first slice uses one family |
| track_scope | text | yes | |
| version | text | yes | start `v1` |
| lesson_scope_keys | text[] | yes | tested lessons |
| module_scope_keys | text[] | yes | tested modules |
| total_sections | integer | yes | |
| total_items | integer | yes | |
| target_score | numeric(5,2) | no | |
| release_stage | text | yes | `draft` / `active` / `retired` |
| blueprint_json | jsonb | yes | section/item blueprint |
| metadata | jsonb | yes | |
| created_at | timestamptz | yes | |
| updated_at | timestamptz | yes | |

### `russian_exam_attempts`
| field | type | required | notes |
|---|---|---:|---|
| id | uuid pk | yes | generated |
| user_id | uuid | yes | |
| course_id | uuid fk → `russian_learning_courses.id` | yes | |
| exam_set_id | uuid fk → `russian_exam_sets.id` | yes | |
| learner_readiness_profile_id | uuid fk → `russian_learner_readiness_profiles.id` | no | |
| status | text | yes | `in_progress` / `submitted` / `graded` / `voided` |
| score | numeric(6,2) | yes | |
| percent_score | numeric(6,2) | yes | |
| readiness_band | text | no | post-exam band |
| passed | boolean | no | |
| attempt_no | integer | yes | unique by user/exam set |
| duration_seconds | integer | yes | |
| section_scores_json | jsonb | yes | |
| answers_json | jsonb | yes | |
| review_json | jsonb | yes | |
| submitted_at | timestamptz | yes | |
| created_at | timestamptz | yes | |
| updated_at | timestamptz | yes | |

---

## 3. Seed plan

### A. Shared foundation seed
Seed one base course:
- `course_key`: `russian_shared_core_v1`
- `goal_type`: `prep_exam`
- `academic_track`: `shared_foundation`

Seed the first 30 lessons under 10 modules, 3 lessons each:
1. `foundations_01_script_sounds`
2. `foundations_02_core_interaction`
3. `foundations_03_survival_navigation`
4. `academic_01_classroom_basics`
5. `academic_02_reading_patterns`
6. `academic_03_note_taking_response`
7. `grammar_01_case_awareness`
8. `grammar_02_verbs_motion_time`
9. `checkpoint_01_foundation`
10. `checkpoint_02_academic_entry`

Lesson naming contract for the first 30:
- module 1: alphabet map / sound rules / handwriting decoding
- module 2: greetings / self-introduction / personal information
- module 3: numbers dates time / directions places / shopping transport
- module 4: university vocabulary / classroom phrases / instructions questions
- module 5: reading simple notices / forms labels / short academic texts
- module 6: lecture listening cues / note-taking phrases / short written responses
- module 7: noun gender number / case pattern awareness / adjective agreement basics
- module 8: present past future / motion verbs intro / schedules deadlines
- module 9: checkpoint lesson A / checkpoint lesson B / checkpoint review
- module 10: checkpoint lesson C / checkpoint lesson D / checkpoint review

### B. Academic core seed
Seed one course overlay:
- `course_key`: `russian_academic_core_v1`
- attached after shared foundation
- modules focus on academic reading, lecture response, exam composition, and prep-year task language

### C. Medicine overlay seed
Seed one overlay course:
- `course_key`: `russian_medicine_overlay_v1`
- first modules: biology terminology, chemistry terminology, anatomy/clinical basics

### D. Engineering overlay seed
Seed one overlay course:
- `course_key`: `russian_engineering_overlay_v1`
- first modules: mathematics terminology, physics terminology, technical diagrams/instructions

### E. Humanities/social overlay seed
Seed one overlay course:
- `course_key`: `russian_humanities_social_overlay_v1`
- first modules: text analysis, argumentation vocabulary, history/society seminar language

### F. Readiness dimensions seed
Seed these dimensions in this exact order:
1. `script_sound_control`
2. `core_survival_communication`
3. `navigation_transactions`
4. `academic_classroom_comprehension`
5. `academic_reading_decoding`
6. `academic_response_production`
7. `grammar_control`
8. `exam_checkpoint_readiness`

### G. Assessment template seed
Seed these templates first:
1. `russian_placement_v1`
2. `shared_core_checkpoint_01_v1`
3. `shared_core_checkpoint_02_v1`

### H. Exam set seed
Seed this first family:
1. `shared_core_exam_set_01_v1`
   - scope: first 30 lessons
   - sections: reading, language use, listening-lite, written response

---

## 4. JSON payload shapes

### Placement result output
```json
{
  "placementResultId": "uuid",
  "courseKey": "russian_shared_core_v1",
  "attemptNo": 1,
  "placementBand": "basics_refresh",
  "rawScore": 18,
  "normalizedScore": 60,
  "recommendedCourseKey": "russian_shared_core_v1",
  "recommendedStartModuleKey": "foundations_03_survival_navigation",
  "recommendedStartLessonKey": "numbers-dates-time",
  "unlocks": {
    "moduleKeys": [
      "foundations_01_script_sounds",
      "foundations_02_core_interaction",
      "foundations_03_survival_navigation"
    ],
    "lessonKeys": [
      "alphabet-map",
      "sound-rules",
      "handwriting-decoding",
      "greetings",
      "self-introduction",
      "personal-information",
      "numbers-dates-time"
    ]
  },
  "dimensionScores": [
    { "dimensionKey": "script_sound_control", "score": 82, "band": "on_track" },
    { "dimensionKey": "core_survival_communication", "score": 68, "band": "building" },
    { "dimensionKey": "academic_classroom_comprehension", "score": 22, "band": "emerging" }
  ],
  "dashboardRedirect": {
    "dashboardRoute": "/languages/russian/dashboard",
    "resumeModuleKey": "foundations_03_survival_navigation",
    "resumeLessonKey": "numbers-dates-time"
  },
  "completedAt": "2026-03-22T00:00:00.000Z"
}
```

### Learner readiness profile
```json
{
  "profileId": "uuid",
  "userId": "uuid",
  "courseKey": "russian_shared_core_v1",
  "readinessBand": "building",
  "currentCefrBand": "A1",
  "overallReadinessScore": 54,
  "layerScores": {
    "sharedFoundation": 62,
    "academicCore": 38,
    "disciplineOverlay": 0,
    "examReadiness": 31
  },
  "dimensions": [
    {
      "dimensionKey": "script_sound_control",
      "label": "Script & sound control",
      "score": 82,
      "band": "on_track",
      "evidence": {
        "placementResultId": "uuid",
        "latestAssessmentAttemptId": null,
        "completedLessonCount": 6
      }
    }
  ],
  "recommendations": [
    {
      "type": "next_lesson",
      "targetKey": "numbers-dates-time",
      "reason": "Highest remaining gap in shared foundation path"
    },
    {
      "type": "checkpoint",
      "targetKey": "shared_core_checkpoint_01_v1",
      "reason": "Unlock after lesson 15 completion"
    }
  ],
  "calculatedAt": "2026-03-22T00:00:00.000Z"
}
```

### Dashboard payload
```json
{
  "course": {
    "courseKey": "russian_shared_core_v1",
    "title": "Russian Shared Core",
    "goalType": "prep_exam",
    "academicTrack": "shared_foundation"
  },
  "readiness": {
    "profileId": "uuid",
    "readinessBand": "building",
    "overallReadinessScore": 54,
    "surfaceDimensions": [
      { "dimensionKey": "script_sound_control", "score": 82, "band": "on_track" },
      { "dimensionKey": "academic_classroom_comprehension", "score": 22, "band": "emerging" },
      { "dimensionKey": "exam_checkpoint_readiness", "score": 31, "band": "emerging" }
    ]
  },
  "resume": {
    "moduleKey": "foundations_03_survival_navigation",
    "lessonKey": "numbers-dates-time",
    "lessonTitle": "Numbers, dates, and time"
  },
  "modules": [
    {
      "moduleKey": "foundations_01_script_sounds",
      "title": "Script and sounds",
      "ordinal": 1,
      "status": "completed",
      "isUnlocked": true,
      "completion": {
        "completedLessons": 3,
        "totalLessons": 3,
        "percent": 100
      }
    }
  ],
  "checkpoint": {
    "nextTemplateKey": "shared_core_checkpoint_01_v1",
    "isUnlocked": false,
    "requiredCompletedLessons": 15,
    "currentCompletedLessons": 7
  },
  "exam": {
    "nextExamSetKey": "shared_core_exam_set_01_v1",
    "status": "locked"
  },
  "updatedAt": "2026-03-22T00:00:00.000Z"
}
```

### Unlock state
```json
{
  "courseKey": "russian_shared_core_v1",
  "modules": [
    { "moduleKey": "foundations_01_script_sounds", "isUnlocked": true, "unlockSource": "placement", "unlockedAt": "2026-03-22T00:00:00.000Z" },
    { "moduleKey": "foundations_02_core_interaction", "isUnlocked": true, "unlockSource": "placement", "unlockedAt": "2026-03-22T00:00:00.000Z" },
    { "moduleKey": "checkpoint_01_foundation", "isUnlocked": false, "unlockSource": null, "unlockedAt": null }
  ],
  "lessons": [
    { "lessonKey": "numbers-dates-time", "isUnlocked": true, "unlockSource": "placement", "unlockedAt": "2026-03-22T00:00:00.000Z" }
  ]
}
```

### Lesson progression
```json
{
  "courseKey": "russian_shared_core_v1",
  "moduleKey": "foundations_03_survival_navigation",
  "lessonKey": "numbers-dates-time",
  "status": "in_progress",
  "sectionProgress": [
    { "sectionKey": "intro_numbers_dates_time", "status": "completed" },
    { "sectionKey": "drill_numbers_dates_time", "status": "in_progress" },
    { "sectionKey": "quiz_numbers_dates_time", "status": "locked" }
  ],
  "completion": {
    "percent": 50,
    "completedRequiredSections": 2,
    "totalRequiredSections": 4
  },
  "nextLessonKey": "directions-places",
  "checkpointEligibility": {
    "templateKey": "shared_core_checkpoint_01_v1",
    "isEligible": false
  },
  "updatedAt": "2026-03-22T00:00:00.000Z"
}
```

---

## 5. Frontend state shape

```ts
export type RussianExecutionPackState = {
  course: {
    courseKey: string;
    title: string;
    goalType: 'prep_exam' | 'university_study' | 'daily_life';
    academicTrack: 'shared_foundation' | 'academic_core' | 'medicine' | 'engineering' | 'humanities_social';
  };
  placement: {
    status: 'idle' | 'loading' | 'resolved';
    result: null | {
      placementResultId: string;
      placementBand: 'start_from_zero' | 'basics_refresh' | 'early_academic';
      recommendedStartModuleKey: string | null;
      recommendedStartLessonKey: string | null;
      unlockedModuleKeys: string[];
      unlockedLessonKeys: string[];
    };
  };
  readiness: {
    status: 'idle' | 'loading' | 'ready';
    profileId: string | null;
    readinessBand: 'emerging' | 'building' | 'on_track' | 'ready' | null;
    overallReadinessScore: number | null;
    dimensions: Array<{
      dimensionKey: string;
      label: string;
      score: number;
      band: 'emerging' | 'building' | 'on_track' | 'ready';
    }>;
  };
  dashboard: {
    resumeModuleKey: string | null;
    resumeLessonKey: string | null;
    nextCheckpointTemplateKey: string | null;
    nextExamSetKey: string | null;
  };
  unlocks: {
    moduleKeys: string[];
    lessonKeys: string[];
  };
  progression: {
    byLessonKey: Record<string, {
      status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
      percent: number;
      completedSectionKeys: string[];
      updatedAt: string | null;
    }>;
  };
};
```

---

## 6. First implementation slice mapping

### First 30 lessons shared core
Implement only this first slice now:
- modules 1–10 from the shared foundation seed
- exactly 30 lessons total
- no discipline overlay lessons in this slice
- medicine / engineering / humanities-social remain seed-only after shared core is stable

### First dashboard readiness surface
Render only these first three dimensions in the first dashboard surface:
1. `script_sound_control`
2. `academic_classroom_comprehension`
3. `exam_checkpoint_readiness`

### First checkpoint family
Implement one checkpoint family first:
- `checkpoint_family_key`: `shared_core_checkpoint_01`
- unlock after lesson 15 completion
- source lessons: first 15 lessons of shared core
- assessment template key: `shared_core_checkpoint_01_v1`
- first pass rule: `passing_score = 70`
- pass action: unlock modules 6–8 if not already unlocked

---

## 7. Files/folders to build first

### Backend / DB
1. `supabase/migrations/20260322110000_russian_execution_pack_1_foundation.sql`
2. `supabase/seed/russian/01_readiness_dimensions.json`
3. `supabase/seed/russian/02_courses.json`
4. `supabase/seed/russian/03_modules_shared_core.json`
5. `supabase/seed/russian/04_lessons_shared_core.json`
6. `supabase/seed/russian/05_lesson_sections_shared_core.json`
7. `supabase/seed/russian/06_assessment_templates.json`
8. `supabase/seed/russian/07_exam_sets.json`

### Frontend / state
1. `src/types/russianExecutionPack.ts`
2. `src/lib/russianDashboardContracts.ts`
3. `src/hooks/useRussianDashboardData.ts`
4. `src/hooks/useRussianPlacementResult.ts`
5. `src/hooks/useRussianReadinessProfile.ts`
6. `src/lib/russianLessonProgression.ts`

---

## 8. Implementation order

1. Apply foundation migration.
2. Seed readiness dimensions.
3. Seed `russian_shared_core_v1` course.
4. Seed first 10 modules and first 30 lessons.
5. Seed lesson sections for those 30 lessons.
6. Seed placement template and first checkpoint template.
7. Seed first exam set.
8. Replace placement write path to persist `russian_placement_results`.
9. Add readiness profile compute path writing `russian_learner_readiness_profiles`.
10. Add unlock persistence into `russian_learner_unlocks` after placement and lesson progression.
11. Build dashboard query contract from readiness + unlocks + module graph.
12. Ship first readiness surface.
13. Ship first checkpoint family.
14. Only after the shared core stabilizes, seed and expose medicine / engineering / humanities-social overlays.
