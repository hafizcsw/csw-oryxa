import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap, BookOpen, Users, Target, ArrowLeft, ArrowRight,
  CheckCircle, Calendar, Shield, Sparkles, Clock, UserCheck,
  CreditCard, Star, Zap, ChevronDown, ChevronUp, Brain,
  LayoutList, Bot, Lock, Unlock, Info
} from "lucide-react";
import { DSButton } from "@/components/design-system/DSButton";
import { motion } from "framer-motion";
import { useCourseProducts, useMyEnrollment } from "@/hooks/useCourseProducts";
import { CourseEnrollmentModal } from "@/components/languages/CourseEnrollmentModal";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { translateLanguageCourseValue } from "@/lib/languageCourseI18n";
import { getLanguageCourseDashboardRoute, getLanguageCourseOnboardingRoute } from "@/lib/languageCourseConfig";
import { useRussianActivation } from "@/hooks/useRussianActivation";

export default function RussianLanding() {
  const { t, language } = useLanguage();

  const getTranslationList = (key: string, fallback: string[] = []) => {
    const value = t(key, { returnObjects: true, defaultValue: fallback }) as unknown;
    return Array.isArray(value) ? value.map((item) => String(item)) : fallback;
  };
  const formatEnrollmentValue = (suffix: string, value: string) => translateLanguageCourseValue(t, `languages.enrollment.${suffix}.${value}`, value);
  const navigate = useNavigate();
  const isAr = language === "ar";
  const Arrow = isAr ? ArrowLeft : ArrowRight;
  const BackArrow = isAr ? ArrowRight : ArrowLeft;

  const { products, cohorts, loading: productsLoading } = useCourseProducts("russian");
  const { enrollment, refresh: refreshEnrollment } = useMyEnrollment("russian");
  const { isActivated, loading: activationLoading } = useRussianActivation();
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [whyMoreOpen, setWhyMoreOpen] = useState(false);
  const [hasTeacherProgression, setHasTeacherProgression] = useState(false);

  // Check if student has teacher-assigned course state (bypasses payment gate)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from('student_course_state')
        .select('progression_status')
        .eq('student_user_id', user.id)
        .eq('course_key', 'russian')
        .maybeSingle();
      if (!cancelled && data?.progression_status === 'active') {
        setHasTeacherProgression(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (activationLoading) return;
    if (isActivated || hasTeacherProgression) {
      navigate(getLanguageCourseDashboardRoute("russian"), { replace: true });
    }
  }, [activationLoading, isActivated, hasTeacherProgression, navigate]);

  const benefits = [
    { icon: GraduationCap, key: "languages.russian.benefits.prepYear" },
    { icon: BookOpen, key: "languages.russian.benefits.university" },
    { icon: Users, key: "languages.russian.benefits.dailyLife" },
    { icon: Target, key: "languages.russian.benefits.career" },
  ];

  const courseTypeIcons: Record<string, typeof Star> = {
    regular: BookOpen,
    pro: Star,
    intensive_exam: Zap,
  };

  const courseTypeKeys: Record<string, string> = {
    regular: "regular",
    pro: "pro",
    intensive_exam: "intensive",
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString(language || "en", { year: "numeric", month: "long", day: "numeric" });
  };

  const enrollmentPending = enrollment && ["submitted", "under_review", "draft"].includes(enrollment.request_status);
  const enrollmentApproved = enrollment?.request_status === "approved";
  const enrollmentRejected = enrollment?.request_status === "rejected";

  // Comparison data
  const priceByCourseType = products.reduce<Record<string, number>>((acc, product) => {
    acc[courseTypeKeys[product.course_type] || product.course_type] = product.price_usd;
    return acc;
  }, {});

  const comparisonRows = [
    { key: "pace", regular: "standard", pro: "enhanced", intensive: "intensive" },
    { key: "bestFor", regular: "steadyLearners", pro: "seriousLearners", intensive: "examPrep" },
    { key: "format", regular: "group", pro: "group", intensive: "group" },
    { key: "intensity", regular: "moderate", pro: "high", intensive: "veryHigh" },
    { key: "examFocus", regular: "basic", pro: "strong", intensive: "examFocused" },
    { key: "duration", regular: "flexible", pro: "semesterBased", intensive: "threeMonths" },
    { key: "sessions", regular: "coreModules", pro: "expandedModules", intensive: "fiftyFivePlus" },
  ];

  const enrollSteps = [
    { num: "1", key: "step1", icon: LayoutList },
    { num: "2", key: "step2", icon: Calendar },
    { num: "3", key: "step3", icon: Brain },
    { num: "4", key: "step4", icon: CreditCard },
    { num: "5", key: "step5", icon: Shield },
    { num: "6", key: "step6", icon: CheckCircle },
  ];

  return (
    <Layout>
      <div className="min-h-[80vh]">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background py-12 lg:py-20">
          <div className="max-w-5xl mx-auto px-4">
            <DSButton variant="ghost" size="sm" onClick={() => navigate("/languages")} className="gap-2 mb-6 text-muted-foreground hover:text-foreground">
              <BackArrow className="w-4 h-4" />
              {t("languages.russian.backToLanguages")}
            </DSButton>
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <motion.div initial={{ opacity: 0, x: isAr ? 30 : -30 }} animate={{ opacity: 1, x: 0 }} className="flex-1 text-center lg:text-start">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold mb-4">
                  🇷🇺 {t("languages.russian.badge")}
                </div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 leading-tight">
                  {t("languages.russian.hero.title")}
                </h1>
                <p className="text-base md:text-lg text-muted-foreground mb-4 max-w-lg">
                  {t("languages.russian.hero.subtitle")}
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm font-medium mb-6">
                  <CheckCircle className="w-4 h-4" />
                  {t("languages.enrollment.freePlacementNote")}
                </div>
                <div className="flex flex-wrap gap-3">
                  <DSButton size="lg" onClick={() => navigate(getLanguageCourseOnboardingRoute("russian"))} className="gap-2 text-base px-8 py-5">
                    {t("languages.russian.startNow")}
                    <Arrow className="w-5 h-5" />
                  </DSButton>
                  <DSButton variant="outline" size="lg" onClick={() => {
                    document.getElementById("pricing-section")?.scrollIntoView({ behavior: "smooth" });
                  }} className="gap-2 text-base px-6 py-5">
                    <CreditCard className="w-5 h-5" />
                    {t("languages.enrollment.viewPricing")}
                  </DSButton>
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                className="flex-shrink-0 text-[100px] lg:text-[140px] leading-none select-none">
                🇷🇺
              </motion.div>
            </div>
          </div>
        </section>

        {/* Group Course Model Banner */}
        <section className="max-w-5xl mx-auto px-4 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">{t("languages.enrollment.groupCourseTitle")}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{t("languages.enrollment.groupCourseDesc")}</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { icon: Calendar, key: "languages.enrollment.realStartDates" },
                { icon: UserCheck, key: "languages.enrollment.groupBasedFormat" },
                { icon: Shield, key: "languages.enrollment.adminApproval" },
              ].map(({ icon: Icon, key }, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                  <Icon className="w-4 h-4 text-primary shrink-0" />
                  {t(key)}
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Enrollment Status Banner */}
        {enrollment && (
          <section className="max-w-5xl mx-auto px-4 pb-6">
            <div className={cn(
              "rounded-2xl p-5 border",
              enrollmentApproved ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800" :
              enrollmentRejected ? "bg-destructive/10 border-destructive/30" :
              "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
            )}>
              <div className="flex items-center gap-3">
                {enrollmentApproved ? <CheckCircle className="w-5 h-5 text-emerald-600" /> :
                 enrollmentRejected ? <Shield className="w-5 h-5 text-destructive" /> :
                 <Clock className="w-5 h-5 text-amber-600" />}
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    {enrollmentApproved ? t("languages.enrollment.statusApproved") :
                     enrollmentRejected ? t("languages.enrollment.statusRejected") :
                     t("languages.enrollment.statusPending")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {enrollmentApproved ? t("languages.enrollment.statusApprovedDesc") :
                     enrollmentRejected ? (enrollment.admin_note || t("languages.enrollment.statusRejectedDesc")) :
                     t("languages.enrollment.statusPendingDesc")}
                  </p>
                </div>
                {enrollmentApproved && (
                  <DSButton size="sm" className="ms-auto" onClick={() => navigate(getLanguageCourseDashboardRoute("russian"))}>
                    {t("languages.enrollment.goToDashboard")}
                  </DSButton>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Why Russian */}
        <section className="max-w-5xl mx-auto px-4 py-8">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
            {t("languages.russian.whyTitle")}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {benefits.map((b, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}
                className="bg-card rounded-2xl p-5 border border-border text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <b.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-bold text-foreground text-sm mb-1">{t(`${b.key}.title`)}</h3>
                <p className="text-xs text-muted-foreground">{t(`${b.key}.desc`)}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ===== PRICING SECTION ===== */}
        <section id="pricing-section" className="max-w-5xl mx-auto px-4 py-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-2xl font-bold text-foreground mb-2 text-center">
              {t("languages.enrollment.pricingTitle")}
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-8 max-w-xl mx-auto">
              {t("languages.enrollment.pricingSubtitle")}
            </p>

            {!productsLoading && products.length > 0 && (
              <div className="grid md:grid-cols-3 gap-5">
                {products.map((p, i) => {
                  const Icon = courseTypeIcons[p.course_type] || BookOpen;
                  const isPro = p.course_type === "pro";
                  const isIntensive = p.course_type === "intensive_exam";
                  const typeKey = courseTypeKeys[p.course_type] || "regular";
                  const features = [`f1`, `f2`, `f3`, `f4`, `f5`];

                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * i }}
                      className={cn(
                        "relative bg-card rounded-2xl border-2 p-6 flex flex-col transition-all hover:shadow-lg",
                        isPro ? "border-primary shadow-md" : "border-border"
                      )}
                    >
                      {isPro && (
                        <div className="absolute -top-3 inset-x-0 flex justify-center">
                          <Badge className="bg-primary text-primary-foreground shadow-md">
                            {t("languages.product.recommended")}
                          </Badge>
                        </div>
                      )}

                      {/* Header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                          isIntensive ? "bg-amber-500/10" : isPro ? "bg-primary/10" : "bg-muted"
                        )}>
                          <Icon className={cn("w-6 h-6", isIntensive ? "text-amber-600 dark:text-amber-400" : isPro ? "text-primary" : "text-foreground")} />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-base">{t(`languages.enrollment.${typeKey}.name`)}</h3>
                          <span className="text-xs text-muted-foreground">{t(`languages.enrollment.${typeKey}.subtitle`)}</span>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="mb-3">
                        <span className="text-3xl font-extrabold text-foreground">${p.price_usd}</span>
                        <span className="text-sm text-muted-foreground ms-1">{t("languages.enrollment.usd")}</span>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-muted-foreground mb-4">
                        {t(`languages.enrollment.${typeKey}.desc`)}
                      </p>

                      {/* Best for badge */}
                      <div className="mb-4 px-3 py-2 rounded-lg bg-muted/50 border border-border">
                        <p className="text-xs font-medium text-foreground">
                          <Target className="w-3.5 h-3.5 inline-block me-1.5 text-primary" />
                          {t(`languages.enrollment.${typeKey}.bestFor`)}
                        </p>
                      </div>

                      {/* Features */}
                      <ul className="space-y-2 mb-5 flex-1">
                        {features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                            <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <span>{t(`languages.enrollment.${typeKey}.${f}`)}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Why more (intensive only) */}
                      {isIntensive && (
                        <button
                          onClick={() => setWhyMoreOpen(!whyMoreOpen)}
                          className="flex items-center gap-1.5 text-xs text-primary font-medium mb-4 hover:underline"
                        >
                          <Info className="w-3.5 h-3.5" />
                          {t("languages.enrollment.intensive.whyMore")}
                          {whyMoreOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {isIntensive && whyMoreOpen && (
                        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-foreground">
                          {t("languages.enrollment.intensive.whyMoreDesc")}
                        </div>
                      )}

                      {/* CTA */}
                      <DSButton
                        className="w-full"
                        variant={isPro ? "primary" : "outline"}
                        onClick={() => setEnrollOpen(true)}
                        disabled={!!enrollmentPending || !!enrollmentApproved}
                      >
                        {enrollmentApproved ? t("languages.enrollment.alreadyEnrolled") :
                         enrollmentPending ? t("languages.enrollment.pendingReview") :
                         t("languages.enrollment.enrollNow")}
                      </DSButton>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Free placement & bank transfer notes */}
            <div className="text-center mt-6 space-y-1">
              <p className="text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 inline-block text-emerald-500 me-1" />
                {t("languages.enrollment.freePlacementNote")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("languages.enrollment.bankTransferNote")}
              </p>
            </div>
          </motion.div>
        </section>

        {/* ===== COMPARISON TABLE ===== */}
        <section className="max-w-5xl mx-auto px-4 py-8">
          <h2 className="text-xl font-bold text-foreground mb-2 text-center">
            {t("languages.enrollment.comparison.title")}
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6 max-w-md mx-auto">
            {t("languages.enrollment.comparison.subtitle")}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start p-3 text-muted-foreground font-medium"></th>
                  <th className="text-center p-3 font-bold text-foreground">
                    <BookOpen className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                    {t("languages.enrollment.regular.name")}
                    <div className="text-xs font-normal text-muted-foreground">
                      {priceByCourseType.regular !== undefined ? `$${priceByCourseType.regular}` : "—"}
                    </div>
                  </th>
                  <th className="text-center p-3 font-bold text-primary">
                    <Star className="w-4 h-4 mx-auto mb-1 text-primary" />
                    {t("languages.enrollment.pro.name")}
                    <div className="text-xs font-normal text-muted-foreground">
                      {priceByCourseType.pro !== undefined ? `$${priceByCourseType.pro}` : "—"}
                    </div>
                  </th>
                  <th className="text-center p-3 font-bold text-foreground">
                    <Zap className="w-4 h-4 mx-auto mb-1 text-amber-500" />
                    {t("languages.enrollment.intensive.name")}
                    <div className="text-xs font-normal text-muted-foreground">
                      {priceByCourseType.intensive !== undefined ? `$${priceByCourseType.intensive}` : "—"}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.key} className="border-b border-border/50">
                    <td className="p-3 text-muted-foreground font-medium text-xs">
                      {translateLanguageCourseValue(t, `languages.enrollment.comparison.${row.key}`, row.key)}
                    </td>
                    <td className="p-3 text-center text-xs text-foreground">
                      {formatEnrollmentValue("comparison", row.regular)}
                    </td>
                    <td className="p-3 text-center text-xs text-primary font-medium">
                      {formatEnrollmentValue("comparison", row.pro)}
                    </td>
                    <td className="p-3 text-center text-xs text-foreground font-medium">
                      {formatEnrollmentValue("comparison", row.intensive)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ===== FREE VS PAID ===== */}
        <section className="max-w-5xl mx-auto px-4 py-10">
          <h2 className="text-xl font-bold text-foreground mb-6 text-center">
            {t("languages.enrollment.freeVsPaid.title")}
          </h2>
          <div className="grid md:grid-cols-2 gap-5">
            {/* Free Column */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Unlock className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="font-bold text-foreground">{t("languages.enrollment.freeVsPaid.freeTitle")}</h3>
              </div>
              <ul className="space-y-2.5">
                {getTranslationList("languages.enrollment.freeVsPaid.freeItems").map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{String(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Paid Column */}
            <div className="bg-card border-2 border-primary/30 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-bold text-foreground">{t("languages.enrollment.freeVsPaid.paidTitle")}</h3>
              </div>
              <ul className="space-y-2.5">
                {getTranslationList("languages.enrollment.freeVsPaid.paidItems").map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{String(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ===== UPCOMING COHORTS ===== */}
        {cohorts.length > 0 && (
          <section className="max-w-5xl mx-auto px-4 py-8">
            <h2 className="text-xl font-bold text-foreground mb-2 text-center">
              {t("languages.enrollment.upcomingCohorts")}
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              {t("languages.enrollment.upcomingCohortsDesc")}
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cohorts.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i }}
                  className="bg-card border border-border rounded-2xl p-5 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground text-sm">{formatDate(c.start_date)}</p>
                      <p className="text-[10px] text-muted-foreground">{t("languages.enrollment.groupCourse")}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>{t("languages.enrollment.capacity")}</span>
                      <span className="font-semibold text-foreground">{c.capacity} {t("languages.enrollment.students")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("languages.enrollment.minGroup")}</span>
                      <span className="font-semibold text-foreground">{c.min_to_start} {t("languages.enrollment.students")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t("languages.enrollment.status")}</span>
                      <Badge variant="secondary" className="text-[10px]">{t("languages.enrollment.registrationOpen")}</Badge>
                    </div>
                  </div>
                  <DSButton
                    size="sm"
                    className="w-full mt-4"
                    variant="outline"
                    onClick={() => setEnrollOpen(true)}
                    disabled={!!enrollmentPending || !!enrollmentApproved}
                  >
                    {t("languages.enrollment.enrollNow")}
                  </DSButton>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ===== HOW ENROLLMENT WORKS ===== */}
        <section className="max-w-5xl mx-auto px-4 py-10">
          <h2 className="text-xl font-bold text-foreground mb-2 text-center">
            {t("languages.enrollment.howToEnroll.title")}
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-8 max-w-md mx-auto">
            {t("languages.enrollment.howToEnroll.subtitle")}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrollSteps.map(({ num, key, icon: StepIcon }, i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i }}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {num}
                  </div>
                  <StepIcon className="w-4 h-4 text-muted-foreground" />
                </div>
                <h4 className="font-bold text-foreground text-sm mb-1">
                  {t(`languages.enrollment.howToEnroll.${key}`)}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {t(`languages.enrollment.howToEnroll.${key}d`)}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ===== LEARNING MODEL ===== */}
        <section className="max-w-5xl mx-auto px-4 py-10">
          <h2 className="text-xl font-bold text-foreground mb-2 text-center">
            {t("languages.enrollment.learningModel.title")}
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-8 max-w-lg mx-auto">
            {t("languages.enrollment.learningModel.subtitle")}
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {/* Human Teaching */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <GraduationCap className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-1">{t("languages.enrollment.learningModel.humanTitle")}</h3>
              <p className="text-xs text-muted-foreground mb-3">{t("languages.enrollment.learningModel.humanDesc")}</p>
              <ul className="space-y-1.5">
                {["human1", "human2", "human3"].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-foreground">
                    <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{t(`languages.enrollment.learningModel.${f}`)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Structured Path */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <LayoutList className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-1">{t("languages.enrollment.learningModel.structureTitle")}</h3>
              <p className="text-xs text-muted-foreground mb-3">{t("languages.enrollment.learningModel.structureDesc")}</p>
              <ul className="space-y-1.5">
                {["structure1", "structure2", "structure3"].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-foreground">
                    <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{t(`languages.enrollment.learningModel.${f}`)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* AI Support */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-1">{t("languages.enrollment.learningModel.aiTitle")}</h3>
              <p className="text-xs text-muted-foreground mb-3">{t("languages.enrollment.learningModel.aiDesc")}</p>
              <ul className="space-y-1.5">
                {["ai1", "ai2", "ai3"].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-foreground">
                    <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{t(`languages.enrollment.learningModel.${f}`)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-muted-foreground italic border-t border-border pt-2">
                {t("languages.enrollment.learningModel.aiNote")}
              </p>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="max-w-3xl mx-auto px-4 pb-16 text-center">
          <div className="bg-card border border-border rounded-2xl p-8">
            <h2 className="text-xl font-bold text-foreground mb-3">
              {t("languages.russian.startNow")}
            </h2>
            <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
              {t("languages.enrollment.freePlacementNote")}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <DSButton size="lg" onClick={() => navigate(getLanguageCourseOnboardingRoute("russian"))} className="gap-2 text-base px-8 py-5">
                {t("languages.russian.buildPlan")}
                <Arrow className="w-5 h-5" />
              </DSButton>
              <DSButton variant="outline" size="lg" onClick={() => setEnrollOpen(true)} disabled={!!enrollmentPending || !!enrollmentApproved}
                className="gap-2 text-base px-6 py-5">
                <CreditCard className="w-5 h-5" />
                {t("languages.enrollment.enrollNow")}
              </DSButton>
            </div>
          </div>
        </section>

        {/* Enrollment Modal */}
        <CourseEnrollmentModal
          open={enrollOpen}
          onClose={() => setEnrollOpen(false)}
          products={products}
          cohorts={cohorts}
          onSuccess={() => { refreshEnrollment(); }}
        />
      </div>
    </Layout>
  );
}
