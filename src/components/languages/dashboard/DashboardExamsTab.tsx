import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileText, Calendar, BookOpen, AlertCircle, ChevronRight, ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { isPersistedRussianIntensiveExamNotice } from '@/lib/russianIntensive750AssessmentRuntime';
import { DSButton } from "@/components/design-system/DSButton";
import { RTL_LANGUAGES } from '@/i18n/languages';
import type { Module } from "@/lib/russianCourse";
import type { ExamNotice } from "@/hooks/useLearningState";
import type { DashboardPayload } from '@/types/russianExecutionPack';
import { ExamLaunchCard } from '@/components/languages/assessment/ExamLaunchCard';
import { Intensive750Panel } from '@/components/languages/dashboard/Intensive750Panel';
import { translateLanguageCourseValue } from "@/lib/languageCourseI18n";
import type { StudentOperatingSystemData } from '@/types/studentOperatingSystem';

interface Props {
  operatingSystemData?: StudentOperatingSystemData | null;
  examNotices: ExamNotice[];
  pathModules: Module[];
  dashboardData?: DashboardPayload | null;
}

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  upcoming: { color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
  completed: { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  missed: { color: "text-destructive", bg: "bg-destructive/10" },
  locked: { color: "text-muted-foreground", bg: "bg-muted" },
  eligible: { color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/10" },
  unlocked: { color: "text-primary", bg: "bg-primary/10" },
};

export function DashboardExamsTab({ examNotices, pathModules, dashboardData, operatingSystemData }: Props) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isAr = RTL_LANGUAGES.includes(language as never);
  const displayLocale = language || "en";
  const formatRuntimeLabel = (value: string) => translateLanguageCourseValue(t, `languages.dashboard.runtimeLabels.${value}`, value);
  const formatExamType = (value: string) => translateLanguageCourseValue(t, `languages.dashboard.examType.${value}`, value);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sharedCoreExam = dashboardData?.exam.nextExamSetKey ? {
    id: dashboardData.exam.nextExamSetKey,
    title: t('languages.assessment.sharedCoreExamTitle'),
    exam_type: 'practice_exam',
    description: t('languages.assessment.sharedCoreExamDesc'),
    module_coverage: pathModules.map((module) => module.slug),
    scheduled_at: null,
    status: dashboardData.exam.status,
    preparation_note: dashboardData.exam.releaseStage === 'active'
      ? t('languages.assessment.sharedCoreExamReadyNote')
      : t('languages.assessment.sharedCoreExamInactiveNote'),
    external_link: null,
  } : null;
  const persistedSharedExams = examNotices.filter((exam) => !isPersistedRussianIntensiveExamNotice(exam));
  const mergedExams = sharedCoreExam
    ? [sharedCoreExam, ...persistedSharedExams.filter((exam) => exam.id !== sharedCoreExam.id)]
    : persistedSharedExams;
  const selected = mergedExams.find((exam) => exam.id === selectedId);
  const intensiveExamCards = dashboardData?.intensive750?.isActive ? [
    {
      id: dashboardData.intensive750.weeklyExamState.examKey,
      title: t('languages.dashboard.intensive.weeklyExamCardTitle', { week: dashboardData.intensive750.weeklyStatus.weekNumber }),
      status: dashboardData.intensive750.weeklyExamState.status,
    },
    ...(dashboardData.intensive750.stageExamState.examKey ? [{
      id: dashboardData.intensive750.stageExamState.examKey,
      title: t('languages.dashboard.intensive.stageExamCardTitle', {
        stage: translateLanguageCourseValue(t, `languages.dashboard.intensive.stageKeys.${dashboardData.intensive750.stageProgress.stageKey}`, dashboardData.intensive750.stageProgress.stageKey),
      }),
      status: dashboardData.intensive750.stageExamState.status,
    }] : []),
    ...dashboardData.intensive750.generatedExamStates.mockExamStates.map((exam, index) => ({
      id: exam.examKey,
      title: t('languages.dashboard.intensive.mockExamTitle', { index: index + 1 }),
      status: exam.status,
    })),
    {
      id: dashboardData.intensive750.generatedExamStates.finalReadinessGate.examKey,
      title: t('languages.dashboard.intensive.finalReadinessGateTitle'),
      status: dashboardData.intensive750.generatedExamStates.finalReadinessGate.status,
    },
  ] : [];

  if (mergedExams.length === 0) {
    return (
      <>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <FileText className="w-7 h-7 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground mb-1">{t("languages.dashboard.noExams")}</h3>
        <p className="text-sm text-muted-foreground">{t("languages.dashboard.noExamsDesc")}</p>
      </motion.div>
      </>
    );
  }

  if (selected) {
    const style = STATUS_STYLES[selected.status] || STATUS_STYLES.upcoming;
    const BackArrow = isAr ? ArrowRight : ArrowLeft;
    const coverageModules = selected.module_coverage
      ? pathModules.filter(m => selected.module_coverage!.includes(m.slug))
      : [];

    return (
      <>
      <motion.div initial={{ opacity: 0, x: isAr ? -20 : 20 }} animate={{ opacity: 1, x: 0 }}
        className="space-y-4">
        {dashboardData?.intensive750?.isActive && <Intensive750Panel dashboardData={dashboardData} compact />}
        {dashboardData && <ExamLaunchCard dashboardData={dashboardData} />}
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <BackArrow className="w-4 h-4" />
          {t("languages.dashboard.backToExams")}
        </button>

        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-0.5">{selected.title}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", style.bg, style.color)}>
                  {formatRuntimeLabel(selected.status)}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {formatExamType(selected.exam_type)}
                </span>
              </div>
            </div>
          </div>

          {selected.description && (
            <p className="text-sm text-foreground">{selected.description}</p>
          )}

          {selected.scheduled_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{new Date(selected.scheduled_at).toLocaleDateString(displayLocale)}</span>
            </div>
          )}

          {coverageModules.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                {t("languages.dashboard.examCoverage")}
              </h4>
              <div className="space-y-1.5">
                {coverageModules.map(m => (
                  <div key={m.slug} className="flex items-center gap-2 text-sm text-foreground">
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                    {t(m.titleKey)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selected.preparation_note && (
            <div className="bg-amber-500/10 rounded-lg p-4 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">
                  {t("languages.dashboard.preparationTips")}
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300">{selected.preparation_note}</p>
              </div>
            </div>
          )}

          {selected.external_link && (
            <a href={selected.external_link} target="_blank" rel="noopener noreferrer">
              <DSButton variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" />
                {t("languages.dashboard.openExamLink")}
              </DSButton>
            </a>
          )}
        </div>
      </motion.div>
      </>
    );
  }

  return (
    <div className="space-y-3">
      {dashboardData?.intensive750?.isActive && <Intensive750Panel dashboardData={dashboardData} compact />}
      {dashboardData?.intensive750?.isActive && intensiveExamCards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {intensiveExamCards.map((exam) => {
            const canLaunch = ['due', 'retry_required', 'passed'].includes(exam.status);
            return (
              <div key={exam.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('languages.dashboard.intensive.intensiveAssessment')}</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{exam.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('languages.dashboard.intensive.statusWithValue', { status: formatRuntimeLabel(exam.status) })}
                  </p>
                </div>
                <DSButton variant={canLaunch ? 'primary' : 'outline'} disabled={!canLaunch} onClick={() => navigate(`/languages/russian/exams/${exam.id}`)}>
                  {canLaunch ? t('languages.dashboard.intensive.openAssessment') : t('languages.dashboard.intensive.assessmentLocked')}
                </DSButton>
              </div>
            );
          })}
        </div>
      )}
      {dashboardData && <ExamLaunchCard dashboardData={dashboardData} />}
      {mergedExams.map((exam, i) => {
        const style = STATUS_STYLES[exam.status] || STATUS_STYLES.upcoming;
        return (
          <motion.div
            key={exam.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setSelectedId(exam.id)}
            className="bg-card rounded-xl border border-border p-4 hover:border-primary/20 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-foreground mb-1">{exam.title}</h4>
                {exam.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{exam.description}</p>}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {formatExamType(exam.exam_type)}
                  </span>
                  {exam.scheduled_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(exam.scheduled_at).toLocaleDateString(displayLocale)}
                    </span>
                  )}
                  <span className={cn("px-2 py-0.5 rounded-full", style.bg, style.color)}>
                    {formatRuntimeLabel(exam.status)}
                  </span>
                </div>
                {exam.preparation_note && (
                  <div className="mt-2 p-2 rounded-lg bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5 line-clamp-1">
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="truncate">{exam.preparation_note}</span>
                  </div>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-2" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
