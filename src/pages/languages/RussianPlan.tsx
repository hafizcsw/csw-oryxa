import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { CheckCircle, ArrowLeft, ArrowRight, BookOpen, Clock, Target, BarChart3, Rocket, CreditCard, Lock } from "lucide-react";
import { DSButton } from "@/components/design-system/DSButton";
import { motion } from "framer-motion";
import { useRussianActivation } from "@/hooks/useRussianActivation";
import { resolveRussianPath, type OnboardingState } from "@/lib/learningPathResolver";
import { getLanguageCourseDashboardRoute, getLanguageCourseOnboardingRoute, getLanguageCoursePlacementTestRoute } from "@/lib/languageCourseConfig";
import { getLanguageCourseOnboardingStorageKey, persistActiveLearningState } from "@/lib/languageCourseState";

const LANGUAGE_KEY = "russian";
const STORAGE_KEY = getLanguageCourseOnboardingStorageKey(LANGUAGE_KEY);

// Mapping helpers
function goalKeyMap(v: string) {
  const map: Record<string, string> = { prep_exam: "prepExam", university_study: "universityStudy", daily_life: "dailyLife", speaking: "speaking", other: "other" };
  return map[v] || v;
}
function timelineKeyMap(v: string) {
  const map: Record<string, string> = { "1_month": "oneMonth", "3_months": "threeMonths", "6_months": "sixMonths", no_deadline: "noDeadline" };
  return map[v] || v;
}
function levelKeyMap(v: string) {
  const map: Record<string, string> = { completely_new: "completelyNew", know_basics: "knowBasics", test_my_level: "testMyLevel" };
  return map[v] || v;
}
function dailyKeyMap(v: string) {
  const map: Record<string, string> = { "15": "fifteen", "30": "thirty", "45": "fortyFive", "60": "sixtyPlus" };
  return map[v] || v;
}

export default function RussianPlan() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { loading: activationLoading, isAuthenticated, activationStatus, isActivated, paymentRoute, upsertEnrollmentState } = useRussianActivation();
  const isAr = language === "ar";
  const Arrow = isAr ? ArrowLeft : ArrowRight;
  const BackArrow = isAr ? ArrowRight : ArrowLeft;

  const [state, setState] = useState<OnboardingState | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.goal && parsed.timeline && parsed.level && parsed.dailyMinutes) {
          setState(parsed);
          return;
        }
      }
    } catch {}
    navigate(getLanguageCourseOnboardingRoute(LANGUAGE_KEY));
  }, [navigate]);

  const requiresPlacementTest = state?.level === "test_my_level" && !state?.placementResult;
  const resolvedPath = state && !requiresPlacementTest ? resolveRussianPath(state) : null;
  const planPathKey = resolvedPath?.pathKey ?? null;
  const isPlacementTest = requiresPlacementTest;
  const isPaymentLocked = !!resolvedPath && !isActivated;

  useEffect(() => {
    if (!state || !resolvedPath || !isAuthenticated || isPlacementTest) return;

    void upsertEnrollmentState({
      path_key: planPathKey,
      goal: state.goal,
      timeline: state.timeline,
      level_mode: state.level,
      daily_minutes: Number(state.dailyMinutes) || 30,
      academic_track: state.academicTrack ?? null,
      placement_result: state.placementResult ?? null,
      placement_score: state.placementScore ?? null,
      enrollment_status: activationStatus === "active" ? "active" : "path_selected",
      payment_status:
        activationStatus === "active"
          ? "paid"
          : activationStatus === "payment_pending"
            ? "pending"
            : activationStatus === "failed_or_retry"
              ? "failed"
              : "unpaid",
    });
  }, [state, resolvedPath, planPathKey, isAuthenticated, isPlacementTest, upsertEnrollmentState, activationStatus]);

  if (!state) return null;

  const summaryItems = [
    { icon: Target, labelKey: "languages.plan.summary.goal", valueKey: `languages.onboarding.goal.${goalKeyMap(state.goal)}` },
    { icon: Clock, labelKey: "languages.plan.summary.timeline", valueKey: `languages.onboarding.timeline.${timelineKeyMap(state.timeline)}` },
    { icon: BarChart3, labelKey: "languages.plan.summary.level", valueKey: `languages.onboarding.level.${levelKeyMap(state.level)}` },
    { icon: BookOpen, labelKey: "languages.plan.summary.dailyTime", valueKey: `languages.onboarding.daily.${dailyKeyMap(state.dailyMinutes)}` },
  ];

  return (
    <Layout>
      <div className="min-h-[80vh]">
        <div className="max-w-2xl mx-auto px-4 py-10">
          {/* Back */}
          <DSButton variant="ghost" size="sm" onClick={() => navigate(getLanguageCourseOnboardingRoute(LANGUAGE_KEY))} className="gap-1.5 mb-6 text-muted-foreground hover:text-foreground">
            <BackArrow className="w-4 h-4" />
            {t("languages.plan.changeAnswers")}
          </DSButton>

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              {t("languages.plan.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("languages.plan.subtitle")}
            </p>
          </motion.div>

          {/* Summary */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-card rounded-xl border border-border p-5 mb-5">
            <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              {t("languages.plan.yourChoices")}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {summaryItems.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <item.icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-muted-foreground">{t(item.labelKey)}</p>
                    <p className="text-sm font-medium text-foreground">{t(item.valueKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recommended Plan */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-primary/5 rounded-xl border-2 border-primary/30 p-6 mb-6">
            <div className="flex items-center gap-2.5 mb-2">
              <Rocket className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("languages.plan.recommended")}</h3>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-primary mb-2">
              {isPlacementTest ? t("languages.plan.paths.placementTest.name") : resolvedPath ? t(resolvedPath.nameKey) : null}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {isPlacementTest ? t("languages.plan.paths.placementTest.desc") : resolvedPath ? t(resolvedPath.descKey) : null}
            </p>
            {!isPlacementTest && (
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {state.timeline === "1_month" ? 4 : state.timeline === "3_months" ? 12 : state.timeline === "6_months" ? 24 : 16} {t("languages.plan.weeks")}
                </span>
              </div>
            )}
          </motion.div>

          {!isPlacementTest && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-card rounded-xl border border-border p-5 mb-6"
            >
              <div className="flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{t("languages.product.pricingTitle")}</h3>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <p className="text-foreground">• {t("languages.product.freePlacement")}</p>
                <p className="text-foreground">• {t("languages.home.paymentRequired")}</p>
                <p className="text-muted-foreground">• {t("languages.product.fullPriceNote")}</p>
              </div>

              {isPaymentLocked && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-medium">
                  <Lock className="w-3.5 h-3.5" />
                  {activationStatus === "payment_pending" ? t("languages.home.awaitingPayment") : t("languages.home.paymentRequired")}
                </div>
              )}
            </motion.div>
          )}

          {/* CTA */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="flex flex-col items-center gap-3">
            <DSButton
              size="lg"
              disabled={activationLoading}
              onClick={async () => {
                if (isPlacementTest) {
                  navigate(getLanguageCoursePlacementTestRoute(LANGUAGE_KEY));
                  return;
                }

                if (!isActivated) {
                  if (!resolvedPath) return;
                  await upsertEnrollmentState({
                    path_key: resolvedPath.pathKey,
                    enrollment_status: activationStatus === "payment_pending" ? "awaiting_payment" : "path_selected",
                    payment_status:
                      activationStatus === "payment_pending"
                        ? "pending"
                        : activationStatus === "failed_or_retry"
                          ? "failed"
                          : "unpaid",
                  });
                  navigate(getLanguageCourseOnboardingRoute(LANGUAGE_KEY));
                  return;
                }

                persistActiveLearningState(LANGUAGE_KEY, resolvedPath?.pathKey ?? null);
                navigate(getLanguageCourseDashboardRoute(LANGUAGE_KEY));
              }}
              className="gap-2 text-base px-10 py-5 w-full sm:w-auto"
            >
              {isPlacementTest ? t("languages.plan.takeTest") : isActivated ? t("languages.plan.startNow") : t("languages.home.activateCourse")}
              <Arrow className="w-5 h-5" />
            </DSButton>
            <button onClick={() => navigate(getLanguageCourseOnboardingRoute(LANGUAGE_KEY))} className="text-sm text-muted-foreground hover:text-primary transition-colors">
              {t("languages.plan.changeAnswers")}
            </button>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
