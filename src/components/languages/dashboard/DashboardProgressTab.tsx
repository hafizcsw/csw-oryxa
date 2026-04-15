import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { BookOpen, CheckCircle2, GraduationCap, TrendingUp, MessageSquare, Target, Award, BarChart3, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Module } from "@/lib/russianCourse";
import { getModulesByCEFR, getAllLessonsFromModules } from "@/lib/russianCourse";
import type { StudyStats, LearningEnrollment } from "@/hooks/useLearningState";
import type { DashboardPayload } from '@/types/russianExecutionPack';
import { translateLanguageCourseValue } from "@/lib/languageCourseI18n";
import type { StudentOperatingSystemData } from '@/types/studentOperatingSystem';
import type { LessonProgressionEntry, CourseState } from '@/hooks/useStudentProgression';

interface Props {
  operatingSystemData?: StudentOperatingSystemData | null;
  studyStats: StudyStats;
  vocabCount: number;
  enrollment: LearningEnrollment | null;
  pathModules: Module[];
  dashboardData?: DashboardPayload | null;
  releasedLessons: LessonProgressionEntry[];
  courseState: CourseState | null;
  phase1a?: any;
  phase1b?: any;
  phase1c?: any;
  phase1Full?: any;
}

function ProgressRing({ percent, size = 64, stroke = 5, children }: { percent: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const o = c - (percent / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={o} strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={cn(
          "h-full rounded-full",
          percent === 100 ? "bg-emerald-500" : "bg-primary"
        )}
      />
    </div>
  );
}

const CEFR_ICONS: Record<string, LucideIcon> = {
  'A0': BookOpen,
  'A1': MessageSquare,
  'A2': GraduationCap,
  'B1': TrendingUp,
  'B2': Award,
};

const CEFR_COLORS: Record<string, string> = {
  'A0': 'from-amber-500 to-orange-500',
  'A1': 'from-blue-500 to-cyan-500',
  'A2': 'from-violet-500 to-purple-500',
  'B1': 'from-emerald-500 to-teal-500',
  'B2': 'from-rose-500 to-pink-500',
};

export function DashboardProgressTab({ studyStats, vocabCount, enrollment, pathModules, dashboardData, operatingSystemData, releasedLessons, courseState }: Props) {
  const { t } = useLanguage();
  const humanizeValue = (value: string) => translateLanguageCourseValue(t, `languages.dashboard.runtimeLabels.${value}`, value);

  // Real facts from teacher-controlled progression + completed live sessions
  const completedSessionLessonSlugs = useMemo(
    () => new Set(
      (operatingSystemData?.sessions ?? [])
        .filter((s) => s.status === 'completed' && Boolean(s.targetLessonSlug))
        .map((s) => s.targetLessonSlug as string)
    ),
    [operatingSystemData?.sessions]
  );
  const completedLessons = useMemo(
    () => releasedLessons.filter((l) => l.status === 'completed' && Boolean(l.completed_at) && completedSessionLessonSlugs.has(l.lesson_slug)),
    [releasedLessons, completedSessionLessonSlugs]
  );
  const completedLessonSlugs = useMemo(() => new Set(completedLessons.map(l => l.lesson_slug)), [completedLessons]);
  const completedCount = completedLessons.length;
  const allLessons = useMemo(() => pathModules.flatMap(m => m.lessons), [pathModules]);
  const totalCount = allLessons.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // CEFR-aligned progress
  const cefrLevels = useMemo(() => getModulesByCEFR(pathModules), [pathModules]);

  const cefrStats = useMemo(() => cefrLevels.map(level => {
    const lessons = getAllLessonsFromModules(level.modules);
    const completed = lessons.filter(l => completedLessonSlugs.has(l.slug)).length;
    const percent = lessons.length > 0 ? Math.round((completed / lessons.length) * 100) : 0;
    return { ...level, lessonsTotal: lessons.length, lessonsCompleted: completed, percent };
  }), [cefrLevels, completedLessonSlugs]);

  // Module-level progress
  const moduleStats = useMemo(() => pathModules.map(mod => {
    const modCompleted = completedLessons.filter(l => l.module_slug === mod.slug).length;
    const modPercent = mod.lessons.length > 0 ? Math.round((modCompleted / mod.lessons.length) * 100) : 0;
    return { ...mod, modCompleted, modPercent, total: mod.lessons.length };
  }), [pathModules, completedLessons]);

  // Sessions completed
  const completedSessions = operatingSystemData?.sessions?.filter(s => s.status === 'completed').length || 0;

  // Current CEFR level (first incomplete)
  const currentCefrIdx = cefrStats.findIndex(s => s.percent < 100);
  const currentCefr = currentCefrIdx >= 0 ? cefrStats[currentCefrIdx] : cefrStats[cefrStats.length - 1];

  return (
    <div className="space-y-4">
      {/* ─── Overall Progress Hero ─── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-2xl border border-border p-5">
        <div className="flex items-center gap-4">
          <ProgressRing percent={progressPercent} size={80} stroke={6}>
            <span className="text-xl font-extrabold text-foreground">{progressPercent}%</span>
          </ProgressRing>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-foreground">{t("languages.dashboard.progressTitle")}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {completedCount}/{totalCount} {t("languages.dashboard.lessonsCompleted")}
            </p>
            {currentCefr && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                  {t(`languages.russian.cefr.${currentCefr.level.replace('+', '_plus')}`)}
                </span>
                {courseState && (
                  <span className={cn(
                    "text-xs font-semibold px-2.5 py-1 rounded-full",
                    courseState.progression_status === 'active' ? "bg-emerald-500/10 text-emerald-600" :
                    courseState.progression_status === 'paused' ? "bg-amber-500/10 text-amber-600" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {humanizeValue(courseState.progression_status)}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
          {[
            { label: t("languages.dashboard.lessonsCompleted"), value: completedCount, icon: CheckCircle2 },
            { label: t("languages.dashboard.sessionsLabel"), value: completedSessions, icon: Target },
            { label: t("languages.dashboard.totalLabel", { defaultValue: "Total" }), value: totalCount, icon: BarChart3 },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-muted/30">
              <s.icon className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ─── CEFR Level Progress ─── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="bg-card rounded-2xl border border-border p-5">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Award className="w-4 h-4" />
          {t("languages.dashboard.milestones")}
        </h3>

        <div className="space-y-4">
          {cefrStats.map((level, i) => {
            const Icon = CEFR_ICONS[level.level] || BookOpen;
            const isActive = i === currentCefrIdx;
            const isDone = level.percent === 100;
            const gradientCls = CEFR_COLORS[level.level] || 'from-gray-500 to-gray-600';

            return (
              <motion.div
                key={level.level}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "rounded-xl border p-4 transition-all",
                  isActive ? "border-primary/50 bg-primary/5 shadow-sm" :
                  isDone ? "border-emerald-500/30 bg-emerald-500/5" :
                  "border-border"
                )}
              >
                <div className="flex items-center gap-3 mb-2.5">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center text-white bg-gradient-to-br shrink-0",
                    gradientCls,
                    !isDone && !isActive && "opacity-40"
                  )}>
                    {isDone ? <CheckCircle2 className="w-4.5 h-4.5" /> : <Icon className="w-4.5 h-4.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">
                        {t(`languages.russian.cefr.${level.level.replace('+', '_plus')}`)}
                      </h4>
                      <span className={cn(
                        "text-xs font-bold",
                        isDone ? "text-emerald-600" : isActive ? "text-primary" : "text-muted-foreground"
                      )}>
                        {level.percent}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {level.lessonsCompleted}/{level.lessonsTotal} {t("languages.dashboard.lessonsCompleted")}
                    </p>
                  </div>
                </div>
                <ProgressBar percent={level.percent} />
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ─── Module Progress Grid ─── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-card rounded-2xl border border-border p-5">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          {t("languages.dashboard.moduleProgressTitle", { defaultValue: "Module Progress" })}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {moduleStats.map((mod) => (
            <div key={mod.slug} className={cn(
              "rounded-xl border p-3 text-center transition-all",
              mod.modPercent === 100 ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"
            )}>
              <ProgressRing percent={mod.modPercent} size={48} stroke={4}>
                <span className="text-[11px] font-bold text-foreground">{mod.modPercent}%</span>
              </ProgressRing>
              <p className="text-[11px] font-semibold text-foreground mt-2 line-clamp-2 leading-tight">{t(mod.titleKey)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{mod.modCompleted}/{mod.total}</p>
              <span className="text-[9px] font-medium text-muted-foreground/70 mt-0.5 block">{mod.cefrLevel}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ─── Recent Completed Lessons ─── */}
      {completedLessons.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-card rounded-2xl border border-border p-5">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {t("languages.dashboard.completedLessonsTitle", { defaultValue: "Completed Lessons" })}
          </h3>
          <div className="space-y-1.5">
            {completedLessons.slice(0, 10).map(lesson => {
              const mod = pathModules.find(m => m.slug === lesson.module_slug);
              return (
                <div key={lesson.id} className="flex items-center gap-2.5 py-2 px-3 rounded-lg border border-border/30 bg-muted/20">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {t(`languages.russian.runtime.lessons.${lesson.lesson_slug}.title`, { defaultValue: lesson.lesson_slug })}
                    </p>
                    {mod && (
                      <p className="text-[10px] text-muted-foreground truncate">{t(mod.titleKey)}</p>
                    )}
                  </div>
                  {lesson.mastery_score !== null && (
                    <span className="text-[11px] font-bold text-primary shrink-0">{lesson.mastery_score}%</span>
                  )}
                  {lesson.completed_at && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(lesson.completed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ─── Checkpoint & Readiness ─── */}
      {dashboardData && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl border border-border p-5">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
            {t("languages.dashboard.readinessDimensionsTitle")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs font-semibold text-foreground">{t("languages.dashboard.checkpoint01")}</p>
              <p className="text-sm text-muted-foreground mt-1">{dashboardData.checkpoint.currentCompletedLessons}/{dashboardData.checkpoint.requiredCompletedLessons} {t("languages.dashboard.lessonsLabel")}</p>
              <span className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1.5 inline-block",
                dashboardData.checkpoint.status === 'passed' ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"
              )}>
                {humanizeValue(dashboardData.checkpoint.status)}
              </span>
            </div>
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs font-semibold text-foreground">{t("languages.dashboard.examSet01")}</p>
              <p className="text-sm text-muted-foreground mt-1">{humanizeValue(dashboardData.exam.status)}</p>
              {dashboardData.exam.latestPercentScore !== null && (
                <p className="text-primary font-bold mt-1">{dashboardData.exam.latestPercentScore}%</p>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
