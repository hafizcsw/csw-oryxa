import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, ChevronRight } from 'lucide-react';
import { DSButton } from '@/components/design-system/DSButton';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useLearningState } from '@/hooks/useLearningState';
import { useRussianActivation } from '@/hooks/useRussianActivation';
import { normalizeRussianPathInput, resolveRussianPath } from '@/lib/learningPathResolver';
import { buildRussianPlacementSessionPlan, scoreRussianPlacementSession } from '@/lib/russianPlacementEngine';
import type { RussianPlacementBlockCode, RussianPlacementMetaResponse } from '@/lib/russianPlacementTypes';
import { translateLanguageCourseValue } from '@/lib/languageCourseI18n';
import { getLanguageCourseDashboardRoute, getLanguageCourseOnboardingRoute, getLanguageCoursePlacementAuthRoute, getLanguageCoursePlanRoute } from '@/lib/languageCourseConfig';
import { getLanguageCourseOnboardingStorageKey, persistActiveLearningState } from '@/lib/languageCourseState';

const LANGUAGE_KEY = 'russian';
const STORAGE_KEY = getLanguageCourseOnboardingStorageKey(LANGUAGE_KEY);
const BLOCK_TITLES: Record<RussianPlacementBlockCode, string> = {
  A_SCRIPT: 'languages.placementV2.scriptTitle',
  B_GENERAL: 'languages.placementV2.generalTitle',
  C_COMPREHENSION: 'languages.placementV2.comprehensionTitle',
  D_ACADEMIC: 'languages.placementV2.academicTitle',
  E_TRACK: 'languages.placementV2.trackTitle',
  F_META: 'languages.placementV2.metaTitle',
};

export default function PlacementTest() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isAr = language === 'ar';
  const BackArrow = isAr ? ArrowRight : ArrowLeft;
  const ForwardArrow = isAr ? ArrowLeft : ArrowRight;
  const { savePlacementResult } = useLearningState();
  const { isActivated, upsertEnrollmentState } = useRussianActivation();
  const formatPlacementValue = (prefix: string, value: string) => translateLanguageCourseValue(t, `${prefix}.${value}`, value);

  const [metaAnswers, setMetaAnswers] = useState<RussianPlacementMetaResponse>({});
  const [stepIndex, setStepIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReturnType<typeof scoreRussianPlacementSession> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate(getLanguageCoursePlacementAuthRoute(LANGUAGE_KEY), { replace: true });
    });
  }, [navigate]);

  const plan = useMemo(() => buildRussianPlacementSessionPlan(answers), [answers]);
  const steps = useMemo(() => [
    { type: 'meta' as const, titleKey: 'languages.placementV2.metaTitle', items: plan.metaQuestions },
    ...plan.blockOrder.map((block) => ({ type: 'block' as const, block, titleKey: BLOCK_TITLES[block], items: plan.questionsByBlock[block] ?? [] })),
    { type: 'result' as const, titleKey: 'languages.placementV2.resultsTitle', items: [] },
  ], [plan]);
  const currentStep = steps[stepIndex];
  const currentItem = currentStep?.items[questionIndex] as any;
  const totalSteps = steps.length;
  const currentAnswer = currentItem ? answers[currentItem.id] : undefined;
  const scoredBlocksCompleted = steps.slice(1, -1).reduce((sum, step, index) => {
    if (index + 1 >= stepIndex) return sum;
    return sum + step.items.length;
  }, 0);
  const progressCurrent = currentStep?.type === 'block' ? scoredBlocksCompleted + questionIndex + 1 : stepIndex === 0 ? 0 : plan.totalScoredQuestions;

  const handleMetaSelect = (value: string) => {
    setAnswers((prev) => ({ ...prev, [currentItem.id]: value }));
    setMetaAnswers((prev) => ({ ...prev, [currentItem.id]: value }));
  };

  const finishTest = async () => {
    const nextResult = scoreRussianPlacementSession(plan, answers, metaAnswers);
    setResult(nextResult);
    setStepIndex(steps.length - 1);
    setQuestionIndex(0);

    await savePlacementResult(nextResult.weighted_score, plan.totalScoredQuestions, nextResult.legacy_result_category, answers, nextResult as unknown as Record<string, unknown>);

    try {
      const onboarding = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...onboarding,
        goal: onboarding.goal ?? metaAnswers.goal,
        timeline: onboarding.timeline ?? metaAnswers.urgency,
        academicTrack: onboarding.academicTrack ?? metaAnswers.intendedTrack,
        placementResult: nextResult.placement_band,
        placementScore: nextResult.weighted_score,
        placementLegacyCategory: nextResult.legacy_result_category,
        placementV2Result: nextResult,
      }));
    } catch (error) {
      console.error('[PlacementTest] localStorage persist error', error);
    }
  };

  const handleNext = async () => {
    if (questionIndex < currentStep.items.length - 1) {
      setQuestionIndex((value) => value + 1);
      return;
    }
    if (stepIndex < steps.length - 2) {
      setStepIndex((value) => value + 1);
      setQuestionIndex(0);
      return;
    }
    await finishTest();
  };

  const handleBack = () => {
    if (questionIndex > 0) {
      setQuestionIndex((value) => value - 1);
      return;
    }
    if (stepIndex > 0) {
      const previousStep = steps[stepIndex - 1];
      setStepIndex((value) => value - 1);
      setQuestionIndex(Math.max(0, previousStep.items.length - 1));
      return;
    }
    navigate(getLanguageCourseOnboardingRoute(LANGUAGE_KEY));
  };

  const handleStartLearning = async () => {
    if (!result) return;
    const onboarding = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const normalized = normalizeRussianPathInput({
      ...onboarding,
      goal: onboarding.goal ?? metaAnswers.goal ?? 'prep_exam',
      timeline: onboarding.timeline ?? (metaAnswers.urgency === '1_month' ? '1_month' : metaAnswers.urgency === '3_months' ? '3_months' : 'no_deadline'),
      level: onboarding.level ?? 'test_my_level',
      dailyMinutes: onboarding.dailyMinutes ?? '30',
      academicTrack: onboarding.academicTrack ?? metaAnswers.intendedTrack ?? 'humanities_social',
      placementResult: result.placement_band,
      placementScore: result.weighted_score,
    });
    const resolvedPath = normalized ? resolveRussianPath(normalized) : null;

    await upsertEnrollmentState({
      path_key: resolvedPath?.pathKey ?? result.recommended_path,
      placement_result: result.legacy_result_category,
      placement_score: result.weighted_score,
      enrollment_status: 'placement_done',
      payment_status: isActivated ? 'paid' : 'unpaid',
    });

    if (!isActivated) return navigate(getLanguageCoursePlanRoute(LANGUAGE_KEY));

    persistActiveLearningState(LANGUAGE_KEY, resolvedPath?.pathKey ?? result.recommended_path);
    navigate(getLanguageCourseDashboardRoute(LANGUAGE_KEY));
  };

  if (currentStep?.type === 'result' && result) {
    const readinessRows = [
      ['script_readiness', result.script_readiness],
      ['general_readiness', result.general_readiness],
      ['academic_readiness', result.academic_readiness],
      ['prep_readiness', result.prep_readiness],
    ] as const;
    return (
      <Layout>
        <div className="min-h-[80vh]">
          <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">{t('languages.placementV2.resultsTitle')}</h1>
              <p className="text-sm text-muted-foreground mt-2">{t('languages.placementV2.resultsSubtitle')}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('languages.placementV2.bandLabel')}</p>
                <p className="mt-2 text-lg font-bold text-primary">{formatPlacementValue('languages.placementV2.results.bands', result.placement_band)}</p>
                <p className="mt-3 text-sm text-muted-foreground">{t('languages.placementV2.weightedScoreLabel')}: {result.weighted_score}%</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('languages.placementV2.confidenceLabel')}</p>
                <p className="mt-2 text-lg font-bold text-primary">{formatPlacementValue('languages.placementV2.results.confidence', result.confidence)}</p>
                <p className="mt-3 text-sm text-muted-foreground">{result.confidence_score}/100</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{t('languages.placementV2.recommendedPathLabel')}</p>
                <p className="mt-2 text-lg font-bold text-primary">{formatPlacementValue('languages.placementV2.results.paths', result.recommended_path)}</p>
                <p className="mt-3 text-sm text-muted-foreground">{t('languages.placementV2.startModuleLabel')}: {formatPlacementValue('languages.placementV2.results.modules', result.start_module)}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('languages.placementV2.readinessTitle')}</h2>
                {readinessRows.map(([key, value]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>{formatPlacementValue('languages.placementV2.results.readiness', key)}</span>
                      <span className="font-bold text-primary">{value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('languages.placementV2.trackSignalTitle')}</h2>
                {Object.entries(result.track_signal).map(([track, value]) => (
                  <div key={track} className="flex items-center justify-between text-sm">
                    <span>{formatPlacementValue('languages.placementV2.results.areas', `track_${track}`)}</span>
                    <span className="font-bold text-primary">{value}%</span>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground pt-2">{formatPlacementValue('languages.placementV2.results.trackRecommendation', result.track_recommendation)}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
                <p className="text-sm"><span className="text-muted-foreground">{t('languages.placementV2.startStageLabel')}:</span> <span className="font-semibold">{formatPlacementValue('languages.placementV2.results.stages', result.start_stage)}</span></p>
                <p className="text-sm"><span className="text-muted-foreground">{t('languages.placementV2.startLessonBandLabel')}:</span> <span className="font-semibold">{formatPlacementValue('languages.placementV2.results.lessonBands', result.start_lesson_band)}</span></p>
                <p className="text-sm"><span className="text-muted-foreground">{t('languages.placementV2.strongestAreaLabel')}:</span> <span className="font-semibold">{formatPlacementValue('languages.placementV2.results.areas', result.strongest_area)}</span></p>
                <p className="text-sm"><span className="text-muted-foreground">{t('languages.placementV2.weakestAreaLabel')}:</span> <span className="font-semibold">{formatPlacementValue('languages.placementV2.results.areas', result.weakest_area)}</span></p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{t('languages.placementV2.reviewFocusLabel')}</p>
                <div className="flex flex-wrap gap-2">
                  {result.recommended_review_focus.map((area) => (
                    <span key={area} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{formatPlacementValue('languages.placementV2.results.areas', area)}</span>
                  ))}
                </div>
                <div className="mt-4 text-xs text-muted-foreground space-y-1">
                  <p>{result.gates.script_gate_pass ? t('languages.placementV2.results.gates.script_gate_pass') : t('languages.placementV2.results.gates.script_gate_hold')}</p>
                  <p>{result.gates.academic_gate_pass ? t('languages.placementV2.results.gates.academic_gate_pass') : t('languages.placementV2.results.gates.academic_gate_hold')}</p>
                  <p>{result.gates.prep_gate_pass ? t('languages.placementV2.results.gates.prep_gate_pass') : t('languages.placementV2.results.gates.prep_gate_hold')}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">{t('languages.placementV2.dashboardFlagsLabel')}</p>
              <div className="flex flex-wrap gap-2">
                {result.dashboard_flags.map((flag) => (
                  <span key={flag} className="rounded-full border border-border px-3 py-1 text-xs text-foreground">{formatPlacementValue('languages.placementV2.results.flags', flag)}</span>
                ))}
              </div>
            </div>

            <div className="flex justify-center">
              <DSButton size="lg" onClick={handleStartLearning} className="gap-2 px-8">
                {isActivated ? t('languages.placementV2.ctaStart') : t('languages.placementV2.ctaActivate')}
                <ChevronRight className="w-5 h-5" />
              </DSButton>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-[80vh]">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <DSButton variant="ghost" size="sm" onClick={handleBack} className="gap-1 text-muted-foreground hover:text-foreground p-0 h-auto">
                <BackArrow className="w-4 h-4" />
                {t('languages.placementV2.back')}
              </DSButton>
              <span className="text-xs text-muted-foreground font-medium">{t('languages.placementV2.progressLabel', { current: stepIndex + 1, total: totalSteps })}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }} transition={{ duration: 0.3 }} />
            </div>
          </div>

          <div className="mb-6">
            <p className="text-xs uppercase tracking-wider text-primary font-semibold">{t(currentStep.titleKey)}</p>
            <p className="text-sm text-muted-foreground mt-2">{currentStep.type === 'meta' ? t('languages.placementV2.metaSubtitle') : t('languages.placementV2.reviewNotice')}</p>
            {currentStep.type === 'block' && <p className="text-xs text-muted-foreground mt-1">{t('languages.placementV2.questionCounter', { current: progressCurrent, total: plan.totalScoredQuestions })}</p>}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={`${stepIndex}-${questionIndex}`} initial={{ opacity: 0, x: isAr ? -20 : 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: isAr ? 20 : -20 }} transition={{ duration: 0.2 }} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-lg font-bold text-foreground">{t(currentItem.promptKey)}</p>
              {'instructionKey' in currentItem && currentItem.instructionKey && <p className="mt-2 text-sm text-muted-foreground">{t(currentItem.instructionKey)}</p>}
              {'contentKey' in currentItem && currentItem.contentKey && <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm text-foreground">{t(currentItem.contentKey)}</div>}
              <div className="mt-5 space-y-2.5">
                {currentItem.options.map((opt: { id: string; labelKey: string }) => {
                  const selected = currentAnswer === opt.id;
                  return (
                    <button key={opt.id} onClick={() => currentStep.type === 'meta' ? handleMetaSelect(opt.id) : setAnswers((prev) => ({ ...prev, [currentItem.id]: opt.id }))} className={cn('w-full text-start p-3.5 rounded-xl border-2 transition-all', selected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/30 bg-card')}>
                      <span className={cn('text-sm font-medium', selected ? 'text-primary' : 'text-foreground')}>{t(opt.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex justify-end">
            <DSButton onClick={handleNext} disabled={!currentAnswer} className="gap-1.5 min-w-[140px]">
              {stepIndex === steps.length - 2 ? t('languages.placementV2.finish') : t('languages.placementV2.next')}
              <ForwardArrow className="w-4 h-4" />
            </DSButton>
          </div>
        </div>
      </div>
    </Layout>
  );
}
