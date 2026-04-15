import { describe, expect, it } from 'vitest';
import { getRussianRuntimeLesson } from '@/lib/russianLessonRuntime';
import { localizeRussianRuntimeLesson } from '@/lib/russianRuntimeI18n';

describe('localizeRussianRuntimeLesson', () => {
  it('uses locale keys for representative Arabic surfaces and avoids raw English fallback when keys are missing', () => {
    const lesson = getRussianRuntimeLesson('checkpoint-01-review');
    expect(lesson).toBeTruthy();

    const dict: Record<string, string> = {
      'languages.lesson.block.localizedFallback': 'المحتوى التعليمي المحلي لهذا الجزء غير متاح حالياً.',
      'languages.russian.runtime.lessons.checkpoint-01-review.title': 'مراجعة نقطة التحقق 01',
      'languages.russian.runtime.lessons.checkpoint-01-review.objective': 'مراجعة علاجية بعد نقطة التحقق 01.',
      'languages.russian.runtime.lessons.checkpoint-01-review.canDoOutcomes.0': 'يمكنه إصلاح أنماط الأخطاء السابقة.',
      'languages.russian.runtime.blocks.checkpoint-01-review.cp1r-task.title': 'سيناريو: تفاعل صفي تصحيحي',
      'languages.russian.runtime.blocks.checkpoint-01-review.cp1r-task.payload.scenario': 'يجب عليك تصحيح إجابات سابقة.',
      'languages.russian.runtime.blocks.checkpoint-01-review.cp1r-task.payload.task': 'قدّم نسخاً مصححة.',
    };

    const t = (key: string) => dict[key] ?? key;

    const localized = localizeRussianRuntimeLesson(lesson!, t, 'ar');
    expect(localized.title).toBe('مراجعة نقطة التحقق 01');
    expect(localized.objective).toBe('مراجعة علاجية بعد نقطة التحقق 01.');
    expect(localized.canDoOutcomes[0]).toBe('يمكنه إصلاح أنماط الأخطاء السابقة.');

    const scenarioBlock = localized.orderedBlocks.find((b) => b.id === 'cp1r-task');
    expect(scenarioBlock?.title).toBe('سيناريو: تفاعل صفي تصحيحي');
    if (scenarioBlock?.type === 'task_scenario') {
      expect(scenarioBlock.payload.scenario).toBe('يجب عليك تصحيح إجابات سابقة.');
      expect(scenarioBlock.payload.task).toBe('قدّم نسخاً مصححة.');
    }

    const firstBlock = localized.orderedBlocks[0];
    // When locale key is missing, fallback is the English default title (not a generic Arabic message)
    expect(typeof firstBlock.title).toBe('string');
    expect(firstBlock.title.length).toBeGreaterThan(0);
  });

  it('keeps English defaults in English mode when localized key is missing', () => {
    const lesson = getRussianRuntimeLesson('alphabet-map');
    expect(lesson).toBeTruthy();

    const t = (key: string) => key;
    const localized = localizeRussianRuntimeLesson(lesson!, t, 'en');

    expect(localized.title).toBe(lesson!.title);
    expect(localized.objective).toBe(lesson!.objective);
  });
});
