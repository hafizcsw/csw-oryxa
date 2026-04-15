import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, ChevronRight, Lock, CheckCircle2, X, ShieldCheck, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALL_RUSSIAN_MODULES, getModulesByCEFR, getAllLessonsFromModules, getModuleCheckpointId, getPassedCheckpoints, markCheckpointPassed, isLessonBlockedByCheckpoint } from '@/lib/russianCourse';
import type { Module, Lesson } from '@/lib/russianCourse';
import { useMemo, useState, useCallback } from 'react';
import { getLessonImage } from '@/lib/russianLessonImages';

interface DashboardCoursesTabProps {
  progressPercent: number;
  completedLessonSlugs?: Set<string>;
  pathModuleSlugs?: string[];
  teacherMode?: boolean;
}

const LEVEL_ICONS: Record<string, string> = {
  'A0': '🌱', 'A1': '🪴', 'A1+': '🌿', 'A2': '🌳',
  'A2+': '🌲', 'B1': '🏵️', 'B1+': '💐', 'B2': '🌸',
};

// Busuu-style CEFR level colors
const LEVEL_ACCENT: Record<string, { bg: string; border: string; text: string; line: string }> = {
  'A0': { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', line: 'bg-emerald-400' },
  'A1': { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', line: 'bg-emerald-500' },
  'A1+': { bg: 'bg-teal-50 dark:bg-teal-950/30', border: 'border-teal-500', text: 'text-teal-600 dark:text-teal-400', line: 'bg-teal-500' },
  'A2': { bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-500', text: 'text-sky-600 dark:text-sky-400', line: 'bg-sky-500' },
  'A2+': { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-500', text: 'text-blue-600 dark:text-blue-400', line: 'bg-blue-500' },
  'B1': { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-500', text: 'text-violet-600 dark:text-violet-400', line: 'bg-violet-500' },
  'B1+': { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-500', text: 'text-purple-600 dark:text-purple-400', line: 'bg-purple-500' },
  'B2': { bg: 'bg-pink-50 dark:bg-pink-950/30', border: 'border-pink-500', text: 'text-pink-600 dark:text-pink-400', line: 'bg-pink-500' },
};

function LessonAvatar({ lesson, status, accent }: { lesson: Lesson; status: 'completed' | 'active' | 'locked'; accent: typeof LEVEL_ACCENT['A0'] }) {
  const image = getLessonImage(lesson.slug);

  return (
    <div className="relative">
      <div className={cn(
        "w-14 h-14 rounded-full overflow-hidden border-[3px] transition-all",
        status === 'completed' ? 'border-emerald-500 shadow-md shadow-emerald-500/20' :
        status === 'active' ? `${accent.border} shadow-md` :
        'border-muted opacity-50 grayscale'
      )}>
        {image ? (
          <img src={image} alt="" className="w-full h-full object-cover" loading="lazy" width={56} height={56} />
        ) : (
          <div className={cn(
            "w-full h-full flex items-center justify-center text-lg font-bold",
            status === 'locked' ? 'bg-muted text-muted-foreground' : `${accent.bg} ${accent.text}`
          )}>
            {lesson.slug.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      {/* Checkmark badge */}
      {status === 'completed' && (
        <div className="absolute -bottom-0.5 -end-0.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-card">
          <CheckCircle2 className="w-3 h-3 text-white" />
        </div>
      )}
      {/* Lock badge */}
      {status === 'locked' && (
        <div className="absolute -bottom-0.5 -end-0.5 w-5 h-5 rounded-full bg-muted flex items-center justify-center border-2 border-card">
          <Lock className="w-2.5 h-2.5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

export function DashboardCoursesTab({ progressPercent, completedLessonSlugs, pathModuleSlugs, teacherMode = false }: DashboardCoursesTabProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [showCefrInfo, setShowCefrInfo] = useState(false);
  const [passedCheckpoints, setPassedCheckpoints] = useState(() => getPassedCheckpoints());

  const cefrLevels = useMemo(() => {
    const modules = pathModuleSlugs?.length
      ? ALL_RUSSIAN_MODULES.filter(m => pathModuleSlugs.includes(m.slug))
      : ALL_RUSSIAN_MODULES;
    return getModulesByCEFR(modules.length > 0 ? modules : ALL_RUSSIAN_MODULES);
  }, [pathModuleSlugs]);

  const getLevelProgress = (modules: Module[]) => {
    if (!completedLessonSlugs || completedLessonSlugs.size === 0) return 0;
    const lessons = getAllLessonsFromModules(modules);
    if (lessons.length === 0) return 0;
    const completed = lessons.filter(l => completedLessonSlugs.has(l.slug)).length;
    return Math.round((completed / lessons.length) * 100);
  };

  // Determine which lessons are accessible (sequential unlock + checkpoint gates)
  const allOrderedLessons = useMemo(() => {
    return cefrLevels.flatMap(level => getAllLessonsFromModules(level.modules));
  }, [cefrLevels]);

  const completedArr = useMemo(() => completedLessonSlugs ? [...completedLessonSlugs] : [], [completedLessonSlugs]);

  const allModules = useMemo(() => cefrLevels.flatMap(l => l.modules), [cefrLevels]);

  const getLessonStatus = (lessonSlug: string): 'completed' | 'active' | 'locked' => {
    if (completedLessonSlugs?.has(lessonSlug)) return 'completed';
    if (teacherMode) return 'active';
    // Check checkpoint gate
    if (isLessonBlockedByCheckpoint(lessonSlug, allModules, completedArr)) return 'locked';
    const idx = allOrderedLessons.findIndex(l => l.slug === lessonSlug);
    if (idx === 0) return 'active';
    if (idx > 0 && completedLessonSlugs?.has(allOrderedLessons[idx - 1].slug)) return 'active';
    const firstIncomplete = allOrderedLessons.find(l => !completedLessonSlugs?.has(l.slug));
    if (firstIncomplete?.slug === lessonSlug) return 'active';
    return 'locked';
  };

  const handlePassCheckpoint = useCallback((cpId: string) => {
    markCheckpointPassed(cpId);
    setPassedCheckpoints(getPassedCheckpoints());
  }, []);

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">{t('languages.dashboard.courses.completeRussian')}</h2>
        {/* CEFR level selector pills */}
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          {cefrLevels.map(level => {
            const progress = getLevelProgress(level.modules);
            const isActive = expandedLevel === level.level;
            const accent = LEVEL_ACCENT[level.level] || LEVEL_ACCENT['A1'];
            return (
              <button
                key={level.level}
                onClick={() => setExpandedLevel(isActive ? null : level.level)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 text-sm font-medium transition-all",
                  isActive ? `${accent.border} ${accent.bg} ${accent.text}` :
                  progress === 100 ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' :
                  'border-border bg-card text-muted-foreground hover:bg-muted/50'
                )}
              >
                <span className="text-base">{LEVEL_ICONS[level.level] || '📚'}</span>
                {t(level.labelKey)}
              </button>
            );
          })}
        </div>
        {/* CEFR info link */}
        <button onClick={() => setShowCefrInfo(true)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1">
          <Info className="w-3.5 h-3.5" />
          {t('languages.russian.cefr.explained')}
        </button>
      </motion.div>

      {/* CEFR Level Sections with Busuu-style timeline */}
      {cefrLevels.map((level, levelIdx) => {
        const progress = getLevelProgress(level.modules);
        const accent = LEVEL_ACCENT[level.level] || LEVEL_ACCENT['A1'];
        const allLessons = getAllLessonsFromModules(level.modules);
        const isExpanded = expandedLevel === null || expandedLevel === level.level;

        if (!isExpanded) return null;

        return (
          <motion.div
            key={level.level}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: levelIdx * 0.05 }}
          >
            {/* Module headers */}
            {level.modules.map((mod, modIdx) => {
              const modLessons = mod.lessons;
              const modCompleted = completedLessonSlugs ? modLessons.filter(l => completedLessonSlugs.has(l.slug)).length : 0;
              const modProgress = modLessons.length > 0 ? Math.round((modCompleted / modLessons.length) * 100) : 0;

              return (
                <div key={mod.slug} className="mb-2">
                  {/* Chapter header */}
                  <div className={cn(
                    "rounded-2xl border-2 p-4 mb-1",
                    modProgress === 100 ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20' :
                    modProgress > 0 ? `${accent.border} ${accent.bg}` :
                    'border-border bg-card'
                  )}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-foreground">{t(mod.titleKey)}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t('languages.russian.cefr.chapters', { count: modLessons.length })}
                        </p>
                      </div>
                      {modProgress > 0 && (
                        <span className={cn("text-sm font-bold", modProgress === 100 ? 'text-emerald-600' : accent.text)}>
                          {modProgress}%
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    {modProgress > 0 && (
                      <div className="mt-2 h-2 w-full bg-border/50 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${modProgress}%` }}
                          transition={{ duration: 0.6 }}
                          className={cn("h-full rounded-full", modProgress === 100 ? 'bg-emerald-500' : accent.line)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Vertical timeline lessons */}
                  <div className="relative ps-10 py-2">
                    {/* Vertical connector line */}
                    <div className={cn(
                      "absolute start-[30px] top-0 bottom-0 w-[3px] rounded-full",
                      modProgress === 100 ? 'bg-emerald-400' : modProgress > 0 ? accent.line : 'bg-border'
                    )} />

                    {modLessons.map((lesson, lessonIdx) => {
                      const status = getLessonStatus(lesson.slug);
                      const isLast = lessonIdx === modLessons.length - 1;
                      const isEndOfGroup = (lessonIdx + 1) % 3 === 0 && !isLast;
                      const groupIndex = Math.floor(lessonIdx / 3);
                      const cpId = getModuleCheckpointId(mod.slug, groupIndex);
                      const groupLessons = modLessons.slice(groupIndex * 3, groupIndex * 3 + 3);
                      const allGroupCompleted = groupLessons.every(l => completedLessonSlugs?.has(l.slug));
                      const cpPassed = passedCheckpoints.has(cpId);

                      return (
                        <div key={lesson.slug}>
                          <motion.div
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: lessonIdx * 0.04 }}
                            className={cn("relative flex items-center gap-4 py-3", !isLast && !isEndOfGroup && "mb-1")}
                          >
                            {/* Avatar positioned on the timeline */}
                            <div className="absolute start-[-8px] z-10">
                              <LessonAvatar lesson={lesson} status={status} accent={accent} />
                            </div>

                            {/* Lesson content card */}
                            <button
                              onClick={() => {
                                  if (status !== 'locked') navigate(`/languages/russian/lessons/${lesson.slug}${teacherMode ? '?teacher_mode=1' : ''}`);
                              }}
                              disabled={status === 'locked'}
                              className={cn(
                                "flex-1 ms-12 text-start rounded-xl p-3 transition-all",
                                status === 'active' ? `${accent.bg} border-2 ${accent.border} shadow-sm hover:shadow-md` :
                                status === 'completed' ? 'bg-card border border-border hover:bg-muted/30' :
                                'bg-muted/30 border border-border/50 cursor-not-allowed'
                              )}
                            >
                              <h4 className={cn(
                                "text-sm font-semibold",
                                status === 'locked' ? 'text-muted-foreground' : 'text-foreground'
                              )}>
                                {t(lesson.titleKey)}
                              </h4>
                              <p className={cn(
                                "text-xs mt-0.5 line-clamp-1",
                                status === 'locked' ? 'text-muted-foreground/60' : 'text-muted-foreground'
                              )}>
                                {t(lesson.objectiveKey)}
                              </p>
                            </button>

                            {status !== 'locked' && (
                              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                            )}
                          </motion.div>

                          {/* Checkpoint gate after every 3 lessons */}
                          {isEndOfGroup && !teacherMode && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="relative my-3"
                            >
                              <div className="absolute start-[30px] top-0 bottom-0 w-[3px] rounded-full bg-border" />
                              <div className={cn(
                                "ms-10 rounded-xl border-2 p-4 flex items-center gap-3 transition-all",
                                cpPassed
                                  ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20'
                                  : allGroupCompleted
                                    ? `${accent.border} ${accent.bg} cursor-pointer hover:shadow-md`
                                    : 'border-border bg-muted/40'
                              )}>
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                  cpPassed
                                    ? 'bg-emerald-500 text-white'
                                    : allGroupCompleted
                                      ? `${accent.bg} ${accent.text}`
                                      : 'bg-muted text-muted-foreground'
                                )}>
                                  {cpPassed ? <Trophy className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className={cn(
                                    "text-sm font-bold",
                                    cpPassed ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground'
                                  )}>
                                    {t('languages.russian.checkpoint.title', { defaultValue: 'اختبار نقطة التفتيش' })}
                                  </h4>
                                  <p className="text-xs text-muted-foreground">
                                    {cpPassed
                                      ? t('languages.russian.checkpoint.passed', { defaultValue: 'تم اجتياز الاختبار بنجاح ✓' })
                                      : allGroupCompleted
                                        ? t('languages.russian.checkpoint.ready', { defaultValue: 'أكملت الدروس — اضغط لبدء الاختبار' })
                                        : t('languages.russian.checkpoint.locked', { defaultValue: 'أكمل الدروس الثلاثة أعلاه لفتح الاختبار' })
                                    }
                                  </p>
                                </div>
                                {!cpPassed && allGroupCompleted && (
                                  <button
                                    onClick={() => handlePassCheckpoint(cpId)}
                                    className={cn(
                                      "px-4 py-2 rounded-lg text-sm font-medium text-white shrink-0 transition-all",
                                      accent.line, "hover:opacity-90"
                                    )}
                                  >
                                    {t('languages.russian.checkpoint.start', { defaultValue: 'ابدأ الاختبار' })}
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </motion.div>
        );
      })}

      {/* CEFR Explanation Dialog */}
      <AnimatePresence>
        {showCefrInfo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowCefrInfo(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground">{t('languages.russian.cefr.explainedTitle')}</h3>
                <button onClick={() => setShowCefrInfo(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-5">{t('languages.russian.cefr.explainedIntro')}</p>
              <div className="space-y-3">
                {(['A0', 'A1', 'A2', 'B1', 'B2'] as const).map((level) => (
                  <div key={level} className="flex gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                    <span className="text-2xl flex-shrink-0">{LEVEL_ICONS[level] || '📚'}</span>
                    <div>
                      <div className="text-sm font-semibold text-foreground">{t(`languages.russian.cefr.${level}`)}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">{t(`languages.russian.cefr.${level}_desc`)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowCefrInfo(false)}
                className="w-full mt-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
              >
                {t('languages.russian.cefr.close')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
