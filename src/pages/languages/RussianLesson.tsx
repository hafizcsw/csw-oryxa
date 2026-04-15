import { useEffect, useMemo, useState, useCallback } from "react";
import { portalInvoke } from '@/api/portalInvoke';
import { BusuuNavBar } from "@/components/languages/dashboard/BusuuNavBar";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle, BookOpen, Volume2, Eye, ChevronUp, ChevronDown, Loader2, Flame, RotateCcw, Trophy } from "lucide-react";
import { DSButton } from "@/components/design-system/DSButton";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  getNextLesson,
  getPreviousLesson,
  getProgress,
  markLessonComplete,
  setCurrentPosition,
  isLessonAccessible,
  getModulesForPath,
  getLessonBlockProgress,
  markLessonBlockComplete,
  getLessonBlockMasteryStatus,
} from "@/lib/russianCourse";
import { useLearningState } from "@/hooks/useLearningState";
import { useRussianActivation } from "@/hooks/useRussianActivation";
import { resolveRussianPathContext } from "@/lib/russianPathState";
import { getRussianLessonProgression } from '@/lib/russianExecutionPackWriters';
import { useRussianDashboardData } from '@/hooks/useRussianDashboardData';
import { parseLanguageCourseVocabularyEntry } from '@/lib/languageCourseI18n';
import { localizeRussianRuntimeLesson } from '@/lib/russianRuntimeI18n';
import { resolveRussianMediaAsset } from '@/lib/russianLessonMedia';
import { useStudentProgression } from '@/hooks/useStudentProgression';
import { buildRussianStudentNavTabs, getRussianStudentNavHref } from '@/lib/russianStudentNav';
import type { RussianLessonBlock } from '@/lib/russianLessonRuntime';
import { InteractiveLetterMap } from '@/components/languages/lesson/InteractiveLetterMap';
import { InteractiveMultipleChoice } from '@/components/languages/lesson/InteractiveMultipleChoice';
import { InteractiveMatching } from '@/components/languages/lesson/InteractiveMatching';
import { InteractiveFillBlank } from '@/components/languages/lesson/InteractiveFillBlank';
import { InteractiveOrdering } from '@/components/languages/lesson/InteractiveOrdering';
import { InteractiveMiniQuiz } from '@/components/languages/lesson/InteractiveMiniQuiz';
import { InteractivePronunciation } from '@/components/languages/lesson/InteractivePronunciation';
import { AlphabetSoundBoard } from '@/components/languages/lesson/AlphabetSoundBoard';
import { VocabularyMatchQuiz } from '@/components/languages/lesson/VocabularyMatchQuiz';
import { useRussianTTS } from '@/hooks/useRussianTTS';
import { useLessonProgress } from '@/hooks/useLessonProgress';

function AudioPlayerTTS({ transcript, caption }: { transcript: string; caption?: string | null }) {
  const { speak, isSpeaking, speakingText } = useRussianTTS();
  const phrases = transcript.split(/[.,;]\s*/).filter(Boolean);

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {phrases.map((phrase, i) => {
          const isThisSpeaking = speakingText === phrase;
          return (
            <button
              key={i}
              onClick={() => !isSpeaking && speak(phrase)}
              disabled={isSpeaking && !isThisSpeaking}
              className={cn(
                "flex items-center gap-2 w-full text-left rounded-lg px-3 py-2 text-sm transition-all",
                isThisSpeaking
                  ? "bg-primary/15 text-primary font-semibold"
                  : "bg-muted/30 text-foreground/80 hover:bg-muted/50 cursor-pointer"
              )}
            >
              {isThisSpeaking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              {phrase}
            </button>
          );
        })}
      </div>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </div>
  );
}

function InteractiveBlock({
  block,
  checked,
  onToggle,
  showTeacherOnly,
  audioUnavailableLabel,
  imageUnavailableLabel,
}: {
  block: RussianLessonBlock;
  checked: boolean;
  onToggle: () => void;
  showTeacherOnly: boolean;
  audioUnavailableLabel: string;
  imageUnavailableLabel: string;
}) {
  if (block.type === 'teacher_prompt' && !showTeacherOnly) return null;

  const mediaAsset = ('assetId' in block.payload && block.payload.assetId)
    ? resolveRussianMediaAsset(block.payload.assetId)
    : null;

  // Full alphabet board (33 letters)
  if (block.type === 'letter_sound_map' && block.payload.mappings.length >= 30) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <AlphabetSoundBoard
          title={block.title}
          onComplete={onToggle}
          isCompleted={checked}
        />
      </div>
    );
  }

  // Interactive letter map (smaller groups)
  if (block.type === 'letter_sound_map') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <InteractiveLetterMap
          mappings={block.payload.mappings}
          title={block.title}
          onComplete={onToggle}
          isCompleted={checked}
        />
      </div>
    );
  }

  if (block.type === 'multiple_choice') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <InteractiveMultipleChoice
          prompt={block.payload.prompt}
          options={block.payload.options}
          title={block.title}
          onComplete={onToggle}
          isCompleted={checked}
        />
      </div>
    );
  }

  if (block.type === 'matching') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <InteractiveMatching
          prompt={block.payload.prompt}
          pairs={block.payload.pairs}
          title={block.title}
          onComplete={onToggle}
          isCompleted={checked}
        />
      </div>
    );
  }

  if (block.type === 'fill_in_blank') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <InteractiveFillBlank
          prompt={block.payload.prompt}
          sentence={block.payload.sentence}
          answers={block.payload.answers}
          title={block.title}
          onComplete={onToggle}
          isCompleted={checked}
        />
      </div>
    );
  }

  if (block.type === 'ordering') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <InteractiveOrdering
          prompt={block.payload.prompt}
          tokens={block.payload.tokens}
          correctOrder={block.payload.correctOrder}
          title={block.title}
          onComplete={onToggle}
          isCompleted={checked}
        />
      </div>
    );
  }

  if (block.type === 'mini_quiz') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <InteractiveMiniQuiz
          items={block.payload.items}
          title={block.title}
          onComplete={onToggle}
          isCompleted={checked}
        />
      </div>
    );
  }

  if (block.type === 'pronunciation_drill') {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <InteractivePronunciation
          prompt={block.payload.prompt}
          targetPhrases={block.payload.targetPhrases}
          title={block.title}
          onComplete={onToggle}
          isCompleted={checked}
        />
      </div>
    );
  }

  // Non-interactive blocks — enhanced styling
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-semibold text-sm text-foreground">{block.title}</h4>
        <button onClick={onToggle} className={cn(
          "text-xs px-2.5 py-1 rounded-lg font-medium transition-colors shrink-0",
          checked ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground hover:bg-muted/80'
        )}>
          {checked ? '✓' : '○'}
        </button>
      </div>

      {block.type === 'text_explanation' && (
        <div className="space-y-2">
          {block.payload.paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-foreground/80">{p}</p>
          ))}
        </div>
      )}

      {block.type === 'vocab_list' && (
        <div className="grid gap-1.5">
          {block.payload.items.map((v, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
              <span className="font-bold text-sm text-foreground">{v.term}</span>
              <span className="text-muted-foreground text-xs">—</span>
              <span className="text-sm text-muted-foreground">{v.translation}</span>
              <span className={cn(
                "ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded",
                v.priority === 'core' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}>{v.priority}</span>
            </div>
          ))}
        </div>
      )}

      {block.type === 'audio_player' && (
        <AudioPlayerTTS
          transcript={block.payload.transcript}
          caption={block.payload.caption || mediaAsset?.caption}
        />
      )}

      {block.type === 'copywriting_drill' && (
        <div className="space-y-2">
          <p className="text-sm text-foreground/80">{block.payload.instructions}</p>
          <div className="grid gap-1">
            {block.payload.lines.map((line, i) => (
              <div key={i} className="rounded-lg border border-dashed border-border p-2.5 text-center font-bold text-lg text-foreground tracking-wider">{line}</div>
            ))}
          </div>
        </div>
      )}

      {block.type === 'reading_task' && (
        <div className="space-y-3">
          <p className="text-sm text-foreground/80">{block.payload.prompt}</p>
          <div className="rounded-lg bg-muted/30 p-4 text-base font-medium text-foreground leading-relaxed">{block.payload.passage}</div>
          {block.payload.questions.length > 0 && (
            <div className="space-y-1.5">
              {block.payload.questions.map((q, i) => (
                <p key={i} className="text-sm text-primary">❓ {q}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {block.type === 'speaking_task' && (
        <div className="space-y-2">
          <p className="text-sm text-foreground/80">{block.payload.prompt}</p>
          <div className="flex flex-wrap gap-2">
            {block.payload.cues.map((cue, i) => (
              <span key={i} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium">{cue}</span>
            ))}
          </div>
        </div>
      )}

      {block.type === 'task_scenario' && (
        <div className="space-y-2">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
            <p className="text-sm text-foreground font-medium">{block.payload.scenario}</p>
          </div>
          <p className="text-sm text-foreground/80">📋 {block.payload.task}</p>
        </div>
      )}

      {block.type === 'recycle_review' && (
        <div className="space-y-2">
          <p className="text-sm text-foreground/80">{block.payload.focus}</p>
          <p className="text-sm text-primary font-medium">{block.payload.action}</p>
        </div>
      )}

      {block.type === 'image_figure' && (
        <>
          {(block.payload.src || mediaAsset?.src) ? (
            <figure>
              <img
                src={block.payload.src || mediaAsset?.src}
                alt={block.payload.alt || mediaAsset?.alt || ''}
                className="w-full rounded-xl border border-border/50"
                loading="lazy"
              />
              {(block.payload.caption || mediaAsset?.caption) && (
                <figcaption className="mt-2 text-xs text-muted-foreground text-center">{block.payload.caption || mediaAsset?.caption}</figcaption>
              )}
            </figure>
          ) : (
            <p className="text-xs text-muted-foreground">{block.payload.fallbackText ?? imageUnavailableLabel}</p>
          )}
        </>
      )}

      {block.type === 'teacher_prompt' && (
        <div className="space-y-2">
          <p className="text-sm text-foreground/80">{block.payload.prompt}</p>
          <div className="text-xs text-muted-foreground">{block.payload.coachingTips.join(' · ')}</div>
        </div>
      )}

      {block.type === 'homework_assignment' && (
        <div className="space-y-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-800/30 p-4">
          <p className="text-sm text-foreground font-medium">📝 {block.payload.task}</p>
          <p className="text-xs text-muted-foreground">{block.payload.submissionHint}</p>
        </div>
      )}
    </div>
  );
}

export default function RussianLesson() {
  const { lessonSlug } = useParams<{ lessonSlug: string }>();
  const [searchParams] = useSearchParams();
  const isTeacherMode = searchParams.get('teacher_mode') === '1';
  const teacherStudentId = searchParams.get('student_id'); // optional: specific student context
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const teacherCurriculumHref = useMemo(
    () => getRussianStudentNavHref('courses', { teacherMode: isTeacherMode }),
    [isTeacherMode],
  );
  const teacherModeLessonSuffix = isTeacherMode
    ? `?teacher_mode=1${teacherStudentId ? `&student_id=${teacherStudentId}` : ''}`
    : '';

  const { loading: activationLoading, isActivated } = useRussianActivation();
  const [completed, setCompleted] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [teacherMarkingComplete, setTeacherMarkingComplete] = useState(false);
  const { userId, enrollment, loading, syncLessonComplete, startStudySession, endStudySession, addVocabWord } = useLearningState();
  const { dashboard: dashboardData } = useRussianDashboardData(userId);
  const { isTeacherControlled, isLessonAccessible: isTeacherLessonAccessible } = useStudentProgression(userId);

  // New progress system with local+DB sync
  const { blockState, toggleBlock, streak, resetSection, masteredWords, addMasteredWord, masteredWordsCount } = useLessonProgress(userId, lessonSlug ?? null);

  const allModules = useMemo(() => getModulesForPath([]), []);
  const { resolvedPath, pathModules } = useMemo(() => resolveRussianPathContext(enrollment), [enrollment]);
  const effectiveModules = isTeacherMode ? allModules : pathModules;

  const found = useMemo(() => {
    for (const mod of effectiveModules) {
      const lesson = mod.lessons.find(item => item.slug === lessonSlug);
      if (lesson) return { lesson, module: mod };
    }
    return undefined;
  }, [effectiveModules, lessonSlug]);

  useEffect(() => {
    if (isTeacherMode) {
      if (!found) navigate(teacherCurriculumHref, { replace: true });
      return;
    }

    if (activationLoading || loading) return;
    if (!isActivated) return navigate("/languages/russian/plan", { replace: true });
    if (!found) return navigate("/languages/russian/dashboard", { replace: true });
    if (isTeacherControlled && !isTeacherLessonAccessible(found.lesson.slug)) return navigate("/languages/russian/dashboard", { replace: true });

    if (!isTeacherControlled) {
      const checkpointPassed = dashboardData?.checkpoint.status === 'passed';
      const runtimeLessonProgression = getRussianLessonProgression(found.lesson.slug, { checkpointPassed });
      if (!isLessonAccessible(found.lesson.slug, getProgress(), pathModules, resolvedPath?.startModule) || runtimeLessonProgression?.status === 'locked') {
        return navigate("/languages/russian/dashboard", { replace: true });
      }
    }
    setCurrentPosition(found.module.slug, found.lesson.slug);
    setCompleted(getProgress().completedLessons.includes(found.lesson.slug));
    startStudySession();

    return () => { if (found) endStudySession(found.lesson.slug, found.module.slug); };
  }, [isTeacherMode, activationLoading, loading, isActivated, found, navigate, startStudySession, endStudySession, pathModules, resolvedPath, dashboardData, teacherCurriculumHref]);

  if (isTeacherMode ? !found : (!found || !isActivated)) return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-[#18191A]">
      {/* Teacher mode: minimal bar with back to teacher dashboard */}
      {isTeacherMode ? (
        <div className="sticky top-0 z-40 bg-card border-b border-border">
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
            <button onClick={() => navigate('/staff/teacher')} className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {t('staff.teacher.back_to_dashboard', { defaultValue: 'Back to Teacher Dashboard' })}
            </button>
          </div>
        </div>
      ) : (
        <BusuuNavBar tabs={buildRussianStudentNavTabs()} activeTab="courses" onTabChange={(tab) => navigate(getRussianStudentNavHref(tab, { teacherMode: isTeacherMode }))} notifications={[]} courseLabel={t('languages.catalog.russian.name')} languageFlag="🇷🇺" />
      )}
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  const { lesson, module: mod } = found;
  const runtimeLesson = lesson.runtimeLesson;
  const localizedRuntimeLesson = runtimeLesson ? localizeRussianRuntimeLesson(runtimeLesson, t, language) : null;
  const nextLesson = getNextLesson(lesson.slug, pathModules);
  const previousLesson = getPreviousLesson(lesson.slug, pathModules);
  const mastery = getLessonBlockMasteryStatus(lesson.slug);
  const blocks = localizedRuntimeLesson?.orderedBlocks ?? [];
  const visibleBlocks = blocks.filter(b => b.type !== 'teacher_prompt' || isTeacherMode);

  const handleToggleBlock = (blockId: string) => {
    toggleBlock(blockId);
    // Also sync to legacy localStorage format for mastery check
    markLessonBlockComplete(lesson.slug, blockId, !Boolean(blockState[blockId]));
  };

  const handleComplete = () => {
    if (runtimeLesson && !mastery.blockMastered) return;
    markLessonComplete(lesson.slug);
    setCompleted(true);
    if (!isTeacherMode) {
      syncLessonComplete(lesson.slug, mod.slug);
    }
    if (runtimeLesson) {
      runtimeLesson.vocabulary.forEach((entry) => addVocabWord(entry.term, entry.translation, null, lesson.slug, mod.slug));
    } else {
      lesson.vocabularyKeys.forEach(vk => {
        const entry = parseLanguageCourseVocabularyEntry(vk);
        if (entry?.term) addVocabWord(entry.term, entry.meaning, null, lesson.slug, mod.slug);
      });
    }
  };

  // Teacher-specific: mark lesson complete for a specific student
  const handleTeacherMarkComplete = async () => {
    if (!teacherStudentId || !found) return;
    setTeacherMarkingComplete(true);
    try {
      const res = await portalInvoke('teacher_mark_lesson_complete', {
        student_user_id: teacherStudentId,
        lesson_slug: lesson.slug,
        module_slug: mod.slug,
        course_key: 'russian',
      });
      if (res.ok) {
        setCompleted(true);
        markLessonComplete(lesson.slug);
      }
    } catch (e) {
      console.error('[handleTeacherMarkComplete]', e);
    } finally {
      setTeacherMarkingComplete(false);
    }
  };

  const completedBlocks = visibleBlocks.filter(b => blockState[b.id]).length;
  const overallProgress = visibleBlocks.length > 0 ? completedBlocks / visibleBlocks.length : 0;

  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-[#18191A]">
      {/* Teacher mode: teacher-specific top bar */}
      {isTeacherMode ? (
        <div className="sticky top-0 z-40 bg-card border-b border-border">
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
            <button onClick={() => navigate('/staff/teacher')} className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              {t('staff.teacher.back_to_dashboard', { defaultValue: 'Back to Teacher Dashboard' })}
            </button>
            <div className="flex-1" />
            <span className="text-xs font-medium text-muted-foreground bg-primary/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              {t('staff.teacher.viewing_as_teacher', { defaultValue: 'Teacher View' })}
            </span>
          </div>
        </div>
      ) : (
        <BusuuNavBar tabs={buildRussianStudentNavTabs()} activeTab="courses" onTabChange={(tab) => navigate(getRussianStudentNavHref(tab, { teacherMode: isTeacherMode }))} notifications={[]} courseLabel={t('languages.catalog.russian.name')} languageFlag="🇷🇺" />
      )}

      {/* Sticky progress bar */}
      {localizedRuntimeLesson && (
        <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border">
          <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center gap-3">
            <button onClick={() => {
              if (!isTeacherMode) {
                endStudySession(lesson.slug, mod.slug);
              }

              navigate(teacherCurriculumHref);
            }} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{localizedRuntimeLesson.title}</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${overallProgress * 100}%` }} transition={{ duration: 0.3 }} />
              </div>
            </div>
            <span className="text-xs font-semibold text-primary shrink-0">{Math.round(overallProgress * 100)}%</span>
            {/* Streak badge */}
            {streak.currentStreak > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 text-xs font-bold shrink-0" title={t('languages.lesson.streak.tooltip', { defaultValue: 'Learning streak' })}>
                <Flame className="w-3.5 h-3.5" />
                {streak.currentStreak}
              </div>
            )}
            {/* Mastered words */}
            {masteredWordsCount > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold shrink-0" title={t('languages.lesson.mastered.tooltip', { defaultValue: 'Words mastered' })}>
                <Trophy className="w-3.5 h-3.5" />
                {masteredWordsCount}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="min-h-[80vh]"><div className="max-w-2xl mx-auto px-4 py-6">



        {!localizedRuntimeLesson && (
          <DSButton variant="ghost" size="sm" onClick={() => {
            if (!isTeacherMode) {
              endStudySession(lesson.slug, mod.slug);
            }

            navigate(teacherCurriculumHref);
          }} className="gap-1.5 mb-6 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />{t('languages.dashboard.tabs.courses')}
          </DSButton>
        )}

        {/* Lesson header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">{localizedRuntimeLesson?.lane ?? t(mod.titleKey)}</span>
            {completed && <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" />{t("languages.lesson.completed")}</span>}
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground mb-1.5">{localizedRuntimeLesson?.title ?? t(lesson.titleKey)}</h1>
          <p className="text-sm text-muted-foreground">{localizedRuntimeLesson?.objective ?? t(lesson.objectiveKey)}</p>
          {localizedRuntimeLesson?.canDoOutcomes?.length ? (
            <div className="mt-3 rounded-xl bg-primary/5 border border-primary/10 p-3">
              <p className="text-xs font-semibold text-primary mb-1.5">{t('languages.lesson.block.canDoTitle')}</p>
              <div className="space-y-1">
                {localizedRuntimeLesson.canDoOutcomes.map((outcome, idx) => (
                  <p key={idx} className="text-xs text-foreground/80 flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">✓</span>{outcome}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </motion.div>

        {/* Interactive blocks */}
        {localizedRuntimeLesson ? (
          <div className="space-y-4 mb-6">
            {visibleBlocks.map((block, idx) => (
              <motion.div
                key={block.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <InteractiveBlock
                  block={block}
                  checked={Boolean(blockState[block.id])}
                  onToggle={() => handleToggleBlock(block.id)}
                  showTeacherOnly={isTeacherMode}
                  audioUnavailableLabel={t('languages.lesson.block.audioUnavailable', { defaultValue: 'Audio asset unavailable.' })}
                  imageUnavailableLabel={t('languages.lesson.block.imageUnavailable', { defaultValue: 'Image asset unavailable.' })}
                />
              </motion.div>
            ))}

            {isTeacherMode && localizedRuntimeLesson.teacherNotes.length > 0 && (
              <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground space-y-1">
                {localizedRuntimeLesson.teacherNotes.map((note, i) => <p key={i}>• {note}</p>)}
              </div>
            )}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl border border-border p-6 mb-6">
            <div className="text-sm text-foreground leading-relaxed whitespace-pre-line">{t(lesson.contentKey)}</div>
          </motion.div>
        )}

        {/* Vocabulary section */}
        {localizedRuntimeLesson && localizedRuntimeLesson.vocabulary.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-2xl border border-border p-5 mb-6">
            <div className="flex items-center gap-2 mb-4"><Volume2 className="w-5 h-5 text-primary" /><h2 className="font-semibold text-foreground">{t("languages.lesson.vocabulary")}</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {localizedRuntimeLesson.vocabulary.map((vk, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 min-w-0 overflow-hidden">
                  <span className="font-bold text-sm text-foreground whitespace-nowrap">{vk.term}</span>
                  <span className="text-muted-foreground text-xs">—</span>
                  <span className="text-sm text-muted-foreground flex-1 truncate">{vk.translation}</span>
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0",
                    vk.priority === 'core' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}>{vk.priority}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* End-of-lesson vocabulary matching quiz */}
        {localizedRuntimeLesson && localizedRuntimeLesson.vocabulary.length >= 2 && (
          <VocabularyMatchQuiz
            vocabulary={localizedRuntimeLesson.vocabulary.map(v => ({ term: v.term, translation: v.translation }))}
            onComplete={() => {
              localizedRuntimeLesson.vocabulary.forEach(v => addMasteredWord(v.term, v.translation, lesson.slug));
            }}
          />
        )}

        {/* Streak summary + Reset */}
        {localizedRuntimeLesson && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="rounded-2xl border border-border bg-card p-4 mb-4 space-y-3">
            {!isTeacherMode && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-orange-500">
                  <Flame className="w-5 h-5" />
                  <div>
                    <p className="text-sm font-bold">{streak.currentStreak} {t('languages.lesson.streak.days', { defaultValue: 'day streak' })}</p>
                    <p className="text-[10px] text-muted-foreground">{t('languages.lesson.streak.todayBlocks', { defaultValue: '{{count}} blocks today', count: streak.todayBlocks })}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-500">
                  <Trophy className="w-5 h-5" />
                  <div>
                    <p className="text-sm font-bold">{masteredWordsCount} {t('languages.lesson.mastered.words', { defaultValue: 'words' })}</p>
                    <p className="text-[10px] text-muted-foreground">{t('languages.lesson.mastered.total', { defaultValue: 'mastered total' })}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Reset / Practice Again */}
            {showResetConfirm ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">
                    {isTeacherMode
                      ? t('languages.lesson.reset.teacherWarning', { defaultValue: 'This will reset the student\'s local progress for this lesson. Their recorded grades and teacher-tracked progress will NOT be affected.' })
                      : t('languages.lesson.reset.studentWarning', { defaultValue: 'This will reset your practice progress for this lesson only. Your teacher can still see your completed grades and overall progress.' })
                    }
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => setShowResetConfirm(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground border border-border transition-colors">
                    {t('common.cancel', { defaultValue: 'Cancel' })}
                  </button>
                  <button
                    onClick={() => { resetSection(lesson.slug); setShowResetConfirm(false); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  >
                    {t('languages.lesson.reset.confirm', { defaultValue: 'Reset lesson' })}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors w-full justify-center"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {isTeacherMode
                  ? t('languages.lesson.reset.teacherLabel', { defaultValue: 'Reset lesson for student' })
                  : t('languages.lesson.resetPractice', { defaultValue: 'Practice again' })
                }
              </button>
            )}
          </motion.div>
        )}

        {/* Navigation */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row items-center gap-3">
          {previousLesson && (
            <DSButton variant="outline" onClick={() => navigate(`/languages/russian/lessons/${previousLesson.slug}${teacherModeLessonSuffix}`)} className="gap-2 w-full sm:w-auto">
              <ArrowLeft className="w-4 h-4" />{t("languages.lesson.previousLesson")}
            </DSButton>
          )}
          {!isTeacherMode && !completed ? (
            <DSButton onClick={handleComplete} className="gap-2 w-full sm:w-auto" disabled={Boolean(runtimeLesson && !mastery.blockMastered)}>
              <CheckCircle className="w-4 h-4" />{t("languages.lesson.markComplete")}
            </DSButton>
          ) : isTeacherMode && teacherStudentId && !completed ? (
            <DSButton
              onClick={handleTeacherMarkComplete}
              className="gap-2 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={teacherMarkingComplete || Boolean(runtimeLesson && !mastery.blockMastered)}
            >
              {teacherMarkingComplete ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              {t("staff.teacher.mark_complete_for_student", { defaultValue: "Mark Complete for Student" })}
            </DSButton>
          ) : null}
          <DSButton onClick={() => nextLesson ? navigate(`/languages/russian/lessons/${nextLesson.slug}${teacherModeLessonSuffix}`) : navigate(teacherCurriculumHref)} className="gap-2 w-full sm:w-auto">
            {nextLesson ? t("languages.lesson.nextLesson") : t("languages.lesson.backToDashboard")}<ArrowRight className="w-4 h-4" />
          </DSButton>
        </motion.div>
      </div></div>
    </div>
  );
}
