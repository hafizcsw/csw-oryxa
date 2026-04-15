import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRussianRuntimeLesson,
  getPhase1CSummary,
  getFullPhase1Summary,
  PHASE_1C_LESSON_ORDER,
} from '@/lib/russianLessonRuntime';
import {
  getLessonBlockProgress,
  markLessonBlockComplete,
  getLessonBlockMasteryStatus,
} from '@/lib/russianCourse';

describe('Phase 1 runtime proof smoke checks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('contains representative runtime lessons across 1A/1B/1C and checkpoint slices', () => {
    const phase1A = getRussianRuntimeLesson('alphabet-map');
    const phase1B = getRussianRuntimeLesson('classroom-phrases');
    const phase1C = getRussianRuntimeLesson('adjective-agreement-basics');
    const checkpoint = getRussianRuntimeLesson('checkpoint-01-a');
    const checkpointReview = getRussianRuntimeLesson('checkpoint-01-review');

    expect(phase1A).toBeTruthy();
    expect(phase1B).toBeTruthy();
    expect(phase1C).toBeTruthy();
    expect(checkpoint).toBeTruthy();
    expect(checkpointReview).toBeTruthy();

    expect(phase1B?.orderedBlocks.some((b) => b.type === 'task_scenario')).toBe(true);
    expect(phase1B?.orderedBlocks.some((b) => b.type === 'recycle_review')).toBe(true);
    expect(checkpoint?.orderedBlocks.length).toBeGreaterThan(0);
    expect(checkpointReview?.orderedBlocks.length).toBeGreaterThan(0);
  });

  it('tracks block toggle + mastery status for runtime lessons', () => {
    const lessonSlug = 'adjective-agreement-basics';
    const runtime = getRussianRuntimeLesson(lessonSlug);
    expect(runtime).toBeTruthy();

    const requiredBlocks = runtime!.orderedBlocks.filter((b) => b.required);
    expect(requiredBlocks.length).toBeGreaterThan(0);

    requiredBlocks.forEach((block) => {
      markLessonBlockComplete(lessonSlug, block.id, true);
    });

    const progress = getLessonBlockProgress();
    expect(progress[lessonSlug]).toBeTruthy();

    const mastery = getLessonBlockMasteryStatus(lessonSlug);
    expect(mastery.requiredCompleted).toBe(requiredBlocks.length);
    expect(mastery.requiredTotal).toBe(requiredBlocks.length);
    expect(mastery.percent).toBe(100);
    expect(mastery.blockMastered).toBe(true);
    expect(mastery.quizScoreEvaluated).toBe(false);
  });

  it('exposes identity metadata and compatibility remap notice inputs', () => {
    const canonical = getRussianRuntimeLesson('adjective-agreement-basics');
    const remapped = getRussianRuntimeLesson('classroom-phrases');

    expect(canonical?.identity.mappingMode).toBe('canonical');
    expect(remapped?.identity.mappingMode).toBe('compatibility_remap');
    expect(remapped?.identity.note).toContain('Legacy canonical slug retained');
  });

  it('returns local-preview summaries for phase 1C and full phase 1', () => {
    const phase1CCompleted = ['adjective-agreement-basics', 'checkpoint-01-a'];
    const phase1CSummary = getPhase1CSummary(phase1CCompleted);

    expect(phase1CSummary.phaseLessonsTotal).toBe(PHASE_1C_LESSON_ORDER.length);
    expect(phase1CSummary.phaseLessonsCompleted).toBe(2);
    expect(phase1CSummary.checkpointLessonsTotal).toBe(6);
    expect(phase1CSummary.checkpointLessonsCompleted).toBe(1);
    expect(phase1CSummary.source).toBe('local_preview');

    const full = getFullPhase1Summary(['alphabet-map', 'classroom-phrases', 'checkpoint-02-review']);
    expect(full.totalLessons).toBe(30);
    expect(full.completedLessons).toBe(3);
    expect(full.lessonsWithCanDo).toBe(30);
    expect(full.lessonsWithScenario).toBeGreaterThan(0);
    expect(full.source).toBe('local_preview');
  });
});
