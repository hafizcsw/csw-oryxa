import type { Language } from '@/i18n/languages';
import type { RussianLessonBlock, RussianLessonRuntime, RussianVocabItem } from '@/lib/russianLessonRuntime';

type TFn = (key: string, options?: Record<string, unknown>) => string;

function resolve(t: TFn, key: string, _language: Language, enDefault?: string) {
  const localized = t(key);
  if (localized && localized !== key) return localized;
  // Always fall back to English default content rather than a generic "unavailable" message
  return enDefault ?? key;
}

function localizeVocabItems(items: RussianVocabItem[], t: TFn, language: Language, lessonSlug: string, blockId: string) {
  return items.map((item, idx) => ({
    ...item,
    notes: item.notes
      ? resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${blockId}.payload.items.${idx}.notes`, language, item.notes)
      : item.notes,
  }));
}

function localizeBlock(block: RussianLessonBlock, t: TFn, language: Language, lessonSlug: string): RussianLessonBlock {
  const title = resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.title`, language, block.title);

  switch (block.type) {
    case 'text_explanation':
      return {
        ...block,
        title,
        payload: {
          paragraphs: block.payload.paragraphs.map((p, i) =>
            resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.paragraphs.${i}`, language, p)
          ),
        },
      };
    case 'vocab_list':
      return {
        ...block,
        title,
        payload: {
          items: localizeVocabItems(block.payload.items, t, language, lessonSlug, block.id),
        },
      };
    case 'audio_player':
      return {
        ...block,
        title,
        payload: {
          transcript: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.transcript`, language, block.payload.transcript),
          audioLabel: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.audioLabel`, language, block.payload.audioLabel),
          assetId: block.payload.assetId,
          src: block.payload.src,
          durationSeconds: block.payload.durationSeconds,
          caption: block.payload.caption
            ? resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.caption`, language, block.payload.caption)
            : block.payload.caption,
          fallbackText: block.payload.fallbackText
            ? resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.fallbackText`, language, block.payload.fallbackText)
            : block.payload.fallbackText,
        },
      };
    case 'pronunciation_drill':
      return {
        ...block,
        title,
        payload: {
          prompt: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.prompt`, language, block.payload.prompt),
          targetPhrases: block.payload.targetPhrases.map((phrase, i) =>
            resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.targetPhrases.${i}`, language, phrase)
          ),
        },
      };
    case 'letter_sound_map':
      return {
        ...block,
        title,
        payload: {
          mappings: block.payload.mappings.map((mapping, i) => ({
            ...mapping,
            sound: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.mappings.${i}.sound`, language, mapping.sound),
          })),
        },
      };
    case 'copywriting_drill':
      return {
        ...block,
        title,
        payload: {
          instructions: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.instructions`, language, block.payload.instructions),
          lines: block.payload.lines.map((line, i) =>
            resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.lines.${i}`, language, line)
          ),
        },
      };
    case 'multiple_choice':
      return {
        ...block,
        title,
        payload: {
          prompt: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.prompt`, language, block.payload.prompt),
          options: block.payload.options.map((option, i) => ({
            ...option,
            label: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.options.${i}.label`, language, option.label),
          })),
        },
      };
    case 'fill_in_blank':
      return {
        ...block,
        title,
        payload: {
          prompt: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.prompt`, language, block.payload.prompt),
          sentence: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.sentence`, language, block.payload.sentence),
          answers: block.payload.answers,
        },
      };
    case 'matching':
      return {
        ...block,
        title,
        payload: {
          prompt: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.prompt`, language, block.payload.prompt),
          pairs: block.payload.pairs.map((pair, i) => ({
            left: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.pairs.${i}.left`, language, pair.left),
            right: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.pairs.${i}.right`, language, pair.right),
          })),
        },
      };
    case 'ordering':
      return {
        ...block,
        title,
        payload: {
          prompt: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.prompt`, language, block.payload.prompt),
          tokens: block.payload.tokens.map((token, i) =>
            resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.tokens.${i}`, language, token)
          ),
          correctOrder: block.payload.correctOrder,
        },
      };
    case 'reading_task':
      return {
        ...block,
        title,
        payload: {
          prompt: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.prompt`, language, block.payload.prompt),
          passage: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.passage`, language, block.payload.passage),
          questions: block.payload.questions.map((question, i) =>
            resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.questions.${i}`, language, question)
          ),
        },
      };
    case 'speaking_task':
      return {
        ...block,
        title,
        payload: {
          prompt: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.prompt`, language, block.payload.prompt),
          cues: block.payload.cues.map((cue, i) =>
            resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.cues.${i}`, language, cue)
          ),
        },
      };
    case 'task_scenario':
      return {
        ...block,
        title,
        payload: {
          scenario: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.scenario`, language, block.payload.scenario),
          task: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.task`, language, block.payload.task),
          successCriteria: block.payload.successCriteria.map((criteria, i) =>
            resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.successCriteria.${i}`, language, criteria)
          ),
        },
      };
    case 'recycle_review':
      return {
        ...block,
        title,
        payload: {
          focus: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.focus`, language, block.payload.focus),
          recycledItems: localizeVocabItems(block.payload.recycledItems, t, language, lessonSlug, block.id),
          action: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.action`, language, block.payload.action),
        },
      };
    case 'image_figure':
      return {
        ...block,
        title,
        payload: {
          assetId: block.payload.assetId,
          src: block.payload.src,
          alt: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.alt`, language, block.payload.alt),
          caption: block.payload.caption
            ? resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.caption`, language, block.payload.caption)
            : block.payload.caption,
          fallbackText: block.payload.fallbackText
            ? resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.fallbackText`, language, block.payload.fallbackText)
            : block.payload.fallbackText,
        },
      };
    case 'teacher_prompt':
      return {
        ...block,
        title,
        payload: {
          prompt: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.prompt`, language, block.payload.prompt),
          coachingTips: block.payload.coachingTips.map((tip, i) =>
            resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.coachingTips.${i}`, language, tip)
          ),
        },
      };
    case 'mini_quiz':
      return {
        ...block,
        title,
        payload: {
          items: block.payload.items.map((item, i) => ({
            question: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.items.${i}.question`, language, item.question),
            answer: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.items.${i}.answer`, language, item.answer),
          })),
        },
      };
    case 'homework_assignment':
      return {
        ...block,
        title,
        payload: {
          task: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.task`, language, block.payload.task),
          submissionHint: resolve(t, `languages.russian.runtime.blocks.${lessonSlug}.${block.id}.payload.submissionHint`, language, block.payload.submissionHint),
        },
      };
    default:
      return { ...(block as Record<string, unknown>), title } as unknown as RussianLessonBlock;
  }
}

export function localizeRussianRuntimeLesson(runtimeLesson: RussianLessonRuntime, t: TFn, language: Language): RussianLessonRuntime {
  const lessonSlug = runtimeLesson.lessonSlug;

  return {
    ...runtimeLesson,
    title: resolve(t, `languages.russian.runtime.lessons.${lessonSlug}.title`, language, runtimeLesson.title),
    objective: resolve(t, `languages.russian.runtime.lessons.${lessonSlug}.objective`, language, runtimeLesson.objective),
    canDoOutcomes: runtimeLesson.canDoOutcomes.map((outcome, index) =>
      resolve(t, `languages.russian.runtime.lessons.${lessonSlug}.canDoOutcomes.${index}`, language, outcome)
    ),
    teacherNotes: runtimeLesson.teacherNotes.map((note, index) =>
      resolve(t, `languages.russian.runtime.lessons.${lessonSlug}.teacherNotes.${index}`, language, note)
    ),
    orderedBlocks: runtimeLesson.orderedBlocks.map((block) => localizeBlock(block, t, language, lessonSlug)),
  };
}
