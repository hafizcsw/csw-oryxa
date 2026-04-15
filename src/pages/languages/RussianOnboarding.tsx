import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Target, Clock, BarChart3, Timer, Check, Stethoscope, Wrench, BookOpen, HelpCircle } from "lucide-react";
import { DSButton } from "@/components/design-system/DSButton";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { needsAcademicTrack } from "@/lib/learningPathResolver";
import { getLanguageCourseDashboardRoute, getLanguageCourseOnboardingRoute, getLanguageCoursePlacementAuthRoute, getLanguageCoursePlacementTestRoute, getLanguageCoursePlanRoute, getLanguageCourseBaseRoute } from "@/lib/languageCourseConfig";
import { getLanguageCourseOnboardingStorageKey } from "@/lib/languageCourseState";
import { useRussianActivation } from "@/hooks/useRussianActivation";

const LANGUAGE_KEY = "russian";
const STORAGE_KEY = getLanguageCourseOnboardingStorageKey(LANGUAGE_KEY);

interface OnboardingState {
  goal: string;
  timeline: string;
  level: string;
  dailyMinutes: string;
  academicTrack?: string;
}

// Steps are dynamic based on goal selection
function getSteps(state: OnboardingState): string[] {
  const base = ["goal"];
  if (needsAcademicTrack(state.goal)) {
    base.push("academicTrack");
  }
  base.push("timeline", "level", "dailyMinutes");
  return base;
}

export default function RussianOnboarding() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { isActivated, loading: activationLoading } = useRussianActivation();
  const isAr = language === "ar";
  const BackArrow = isAr ? ArrowRight : ArrowLeft;
  const NextArrow = isAr ? ArrowLeft : ArrowRight;

  const [state, setState] = useState<OnboardingState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { goal: "", timeline: "", level: "", dailyMinutes: "", academicTrack: "" };
  });

  const steps = getSteps(state);
  const [stepIdx, setStepIdx] = useState(0);
  const currentStepKey = steps[stepIdx];

  useEffect(() => {
    if (!activationLoading && isActivated) {
      navigate(getLanguageCourseDashboardRoute(LANGUAGE_KEY), { replace: true });
    }
  }, [activationLoading, isActivated, navigate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // If goal changes and we're past the academicTrack step that no longer exists, adjust
  useEffect(() => {
    if (stepIdx >= steps.length) setStepIdx(steps.length - 1);
  }, [steps.length, stepIdx]);

  const currentValue = (state as any)[currentStepKey] || "";

  const STEP_CONFIGS: Record<string, { icon: typeof Target; titleKey: string; options: { value: string; labelKey: string; icon?: typeof Target }[] }> = {
    goal: {
      icon: Target,
      titleKey: "languages.onboarding.goal.title",
      options: [
        { value: "prep_exam", labelKey: "languages.onboarding.goal.prepExam" },
        { value: "university_study", labelKey: "languages.onboarding.goal.universityStudy" },
        { value: "daily_life", labelKey: "languages.onboarding.goal.dailyLife" },
        { value: "speaking", labelKey: "languages.onboarding.goal.speaking" },
        { value: "other", labelKey: "languages.onboarding.goal.other" },
      ],
    },
    academicTrack: {
      icon: BookOpen,
      titleKey: "languages.onboarding.academicTrack.title",
      options: [
        { value: "medicine", labelKey: "languages.onboarding.academicTrack.medicine", icon: Stethoscope },
        { value: "engineering", labelKey: "languages.onboarding.academicTrack.engineering", icon: Wrench },
        { value: "general_academic", labelKey: "languages.onboarding.academicTrack.generalAcademic", icon: BookOpen },
        { value: "not_sure", labelKey: "languages.onboarding.academicTrack.notSure", icon: HelpCircle },
      ],
    },
    timeline: {
      icon: Clock,
      titleKey: "languages.onboarding.timeline.title",
      options: [
        { value: "1_month", labelKey: "languages.onboarding.timeline.oneMonth" },
        { value: "3_months", labelKey: "languages.onboarding.timeline.threeMonths" },
        { value: "6_months", labelKey: "languages.onboarding.timeline.sixMonths" },
        { value: "no_deadline", labelKey: "languages.onboarding.timeline.noDeadline" },
      ],
    },
    level: {
      icon: BarChart3,
      titleKey: "languages.onboarding.level.title",
      options: [
        { value: "completely_new", labelKey: "languages.onboarding.level.completelyNew" },
        { value: "know_basics", labelKey: "languages.onboarding.level.knowBasics" },
        { value: "test_my_level", labelKey: "languages.onboarding.level.testMyLevel" },
      ],
    },
    dailyMinutes: {
      icon: Timer,
      titleKey: "languages.onboarding.daily.title",
      options: [
        { value: "15", labelKey: "languages.onboarding.daily.fifteen" },
        { value: "30", labelKey: "languages.onboarding.daily.thirty" },
        { value: "45", labelKey: "languages.onboarding.daily.fortyFive" },
        { value: "60", labelKey: "languages.onboarding.daily.sixtyPlus" },
      ],
    },
  };

  const current = STEP_CONFIGS[currentStepKey];
  const canProceed = !!currentValue;

  const handleSelect = (value: string) => {
    setState(prev => ({ ...prev, [currentStepKey]: value }));
  };

  const handleNext = async () => {
    if (stepIdx < steps.length - 1) {
      setStepIdx(s => s + 1);
    } else {
      if (state.level === "test_my_level") {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate(getLanguageCoursePlacementTestRoute(LANGUAGE_KEY));
        } else {
          navigate(getLanguageCoursePlacementAuthRoute(LANGUAGE_KEY));
        }
      } else {
        navigate(getLanguageCoursePlanRoute(LANGUAGE_KEY));
      }
    }
  };

  const handleBack = () => {
    if (stepIdx > 0) {
      setStepIdx(s => s - 1);
    } else {
      navigate(getLanguageCourseBaseRoute(LANGUAGE_KEY));
    }
  };

  return (
    <Layout>
      <div className="min-h-[80vh] flex flex-col">
        <div className="flex-1 max-w-xl mx-auto w-full px-4 py-8">
          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">
                {t("languages.onboarding.step", { current: stepIdx + 1, total: steps.length })}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {Math.round(((stepIdx + 1) / steps.length) * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={false}
                animate={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex justify-between mt-2.5">
              {steps.map((_, i) => (
                <div key={i} className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
                  i < stepIdx ? "bg-primary text-primary-foreground" :
                  i === stepIdx ? "bg-primary/15 text-primary ring-2 ring-primary" :
                  "bg-muted text-muted-foreground"
                )}>
                  {i < stepIdx ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepKey}
              initial={{ opacity: 0, x: isAr ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isAr ? 20 : -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <current.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground">{t(current.titleKey)}</h2>
              </div>

              <div className="space-y-2.5">
                {current.options.map((opt) => {
                  const selected = currentValue === opt.value;
                  const OptIcon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleSelect(opt.value)}
                      className={cn(
                        "w-full text-start p-3.5 rounded-xl border-2 transition-all flex items-center justify-between gap-3",
                        selected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30 bg-card"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {OptIcon && (
                          <OptIcon className={cn("w-5 h-5 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                        )}
                        <span className={cn("text-sm font-medium", selected ? "text-primary" : "text-foreground")}>
                          {t(opt.labelKey)}
                        </span>
                      </div>
                      {selected && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 gap-4">
            <DSButton variant="outline" size="sm" onClick={handleBack} className="gap-1.5">
              <BackArrow className="w-4 h-4" />
              {t("languages.onboarding.back")}
            </DSButton>
            <DSButton
              onClick={handleNext}
              disabled={!canProceed}
              className="gap-1.5 flex-1 max-w-[200px]"
            >
              {stepIdx === steps.length - 1 ? t("languages.onboarding.seePlan") : t("languages.onboarding.next")}
              <NextArrow className="w-4 h-4" />
            </DSButton>
          </div>
        </div>
      </div>
    </Layout>
  );
}
