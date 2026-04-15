import { useEffect, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Play, CheckCircle2, Lock, ChevronRight } from "lucide-react";
import { DSButton } from "@/components/design-system/DSButton";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getProgress, isLessonAccessible, getModulesForPath } from "@/lib/russianCourse";
import { useRussianActivation } from "@/hooks/useRussianActivation";
import { useLearningState } from "@/hooks/useLearningState";
import { resolveRussianPathContext } from "@/lib/russianPathState";
import { BusuuNavBar } from "@/components/languages/dashboard/BusuuNavBar";
import { buildRussianStudentNavTabs, getRussianStudentNavHref } from '@/lib/russianStudentNav';

export default function RussianModule() {
  const { moduleSlug } = useParams<{ moduleSlug: string }>();
  const [searchParams] = useSearchParams();
  const isTeacherMode = searchParams.get("teacher_mode") === "1";
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === "ar";
  const BackArrow = isAr ? ArrowRight : ArrowLeft;
  const { loading: activationLoading, isActivated } = useRussianActivation();
  const { enrollment, loading } = useLearningState();
  const progress = getProgress();
  const allModules = useMemo(() => getModulesForPath([]), []);
  const { resolvedPath, pathModules } = useMemo(() => resolveRussianPathContext(enrollment), [enrollment]);
  const effectiveModules = isTeacherMode ? allModules : pathModules;
  const teacherCurriculumHref = useMemo(
    () => getRussianStudentNavHref("courses", { teacherMode: isTeacherMode }),
    [isTeacherMode],
  );
  const mod = effectiveModules.find((module) => module.slug === moduleSlug);

  useEffect(() => {
    if (activationLoading || loading) return;

    if (isTeacherMode) {
      if (!mod) navigate(teacherCurriculumHref, { replace: true });
      return;
    }

    if (!isActivated) {
      navigate("/languages/russian/plan", { replace: true });
      return;
    }

    if (!resolvedPath || !mod) navigate("/languages/russian/dashboard?tab=courses", { replace: true });
  }, [activationLoading, loading, isTeacherMode, isActivated, resolvedPath, mod, navigate, teacherCurriculumHref]);

  if (activationLoading || loading || (isTeacherMode ? !mod : !isActivated || !resolvedPath || !mod)) return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-[#18191A]">
      <BusuuNavBar
        tabs={buildRussianStudentNavTabs()}
        activeTab="courses"
        onTabChange={(tab) => navigate(getRussianStudentNavHref(tab, { teacherMode: isTeacherMode }))}
        notifications={[]}
        courseLabel={t('languages.catalog.russian.name')}
        languageFlag="🇷🇺"
      />
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  const completedCount = mod.lessons.filter((lesson) => progress.completedLessons.includes(lesson.slug)).length;

  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-[#18191A]">
      <BusuuNavBar
        tabs={buildRussianStudentNavTabs()}
        activeTab="courses"
        onTabChange={(tab) => navigate(getRussianStudentNavHref(tab, { teacherMode: isTeacherMode }))}
        progressPercent={0}
        streakDays={0}
        notifications={[]}
        courseLabel={t('languages.catalog.russian.name')}
        languageFlag="🇷🇺"
      />
      <div className="min-h-[80vh]">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <DSButton
            variant="ghost"
            size="sm"
            onClick={() => navigate(teacherCurriculumHref)}
            className="gap-1.5 mb-6 text-muted-foreground hover:text-foreground"
          >
            <BackArrow className="w-4 h-4" />
            {t("languages.dashboard.tabs.courses")}
          </DSButton>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {mod.num}
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">{t(mod.titleKey)}</h1>
                <p className="text-sm text-muted-foreground">{completedCount}/{mod.lessons.length} {t("languages.dashboard.lessonsCompleted")}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">{t(mod.descKey)}</p>
          </motion.div>

          <div className="space-y-2.5">
            {mod.lessons.map((lesson, i) => {
              const completed = progress.completedLessons.includes(lesson.slug);
              const accessible = isTeacherMode
                ? true
                : isLessonAccessible(lesson.slug, progress, pathModules, resolvedPath!.startModule);

              return (
                <motion.div
                  key={lesson.slug}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => accessible && navigate(`/languages/russian/lessons/${lesson.slug}${isTeacherMode ? '?teacher_mode=1' : ''}`)}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl border transition-all",
                    accessible ? "cursor-pointer hover:border-primary/30" : "opacity-50",
                    completed ? "border-primary/20 bg-primary/5" : "border-border bg-card"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    completed ? "bg-primary text-primary-foreground" :
                    accessible ? "bg-primary/10 text-primary" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {completed ? <CheckCircle2 className="w-4 h-4" /> :
                     !accessible ? <Lock className="w-3.5 h-3.5" /> :
                     <Play className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", accessible ? "text-foreground" : "text-muted-foreground")}>
                      {t(lesson.titleKey)}
                    </p>
                  </div>
                  {accessible && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
