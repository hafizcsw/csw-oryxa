import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  BookOpen, Clock, Flame, Brain, Trophy, ChevronRight, ChevronLeft,
  Play, GraduationCap, Lock, Star, BarChart3, Target, CreditCard,
  CheckCircle, AlertCircle, ShieldCheck
} from "lucide-react";
import { DSButton } from "@/components/design-system/DSButton";
import { getProgress, getAllLessonsFromModules } from "@/lib/russianCourse";
import { useRussianActivation, type RussianActivationStatus } from "@/hooks/useRussianActivation";
import { useMyEnrollment } from "@/hooks/useCourseProducts";
import { resolveRussianPathContext } from "@/lib/russianPathState";
import { getLanguageCourseBaseRoute, getLanguageCourseDashboardRoute, getLanguageCourseOnboardingRoute, getLanguageCoursePlanRoute } from "@/lib/languageCourseConfig";

type EnrollmentStatus = "exploring" | "path_selected" | "placement_done" | "awaiting_payment" | "active" | "paused" | "completed";
type PaymentStatus = "unpaid" | "pending" | "paid" | "failed";

interface CourseCard {
  id: string;
  slug: string;
  flag: string;
  nameKey: string;
  descKey: string;
  status: "active" | "awaiting_payment" | "placement_done" | "not_started" | "coming_soon";
  progress?: number;
  lessonsCompleted?: number;
  lessonsTotal?: number;
  level?: string;
  wordsLearned?: number;
  enrollmentStatus?: EnrollmentStatus;
  paymentStatus?: PaymentStatus;
  dashboardRoute?: string;
  onboardingRoute?: string;
  planRoute?: string;
}

function buildRussianCourse(
  dbEnrollment: any | null,
  activationStatus: RussianActivationStatus,
  isActivated: boolean,
): CourseCard {
  const base: CourseCard = {
    id: "russian",
    slug: "russian",
    flag: "🇷🇺",
    nameKey: "languages.catalog.russian.name",
    descKey: "languages.catalog.russian.desc",
    status: "not_started",
    dashboardRoute: getLanguageCourseDashboardRoute("russian"),
    onboardingRoute: getLanguageCourseOnboardingRoute("russian"),
    planRoute: getLanguageCoursePlanRoute("russian"),
  };

  if (isActivated) {
    base.status = "active";
    base.enrollmentStatus = "active";
    base.paymentStatus = "paid";
  } else if (["awaiting_payment", "payment_pending", "failed_or_retry"].includes(activationStatus)) {
    base.status = "awaiting_payment";
    base.enrollmentStatus = "awaiting_payment";
    base.paymentStatus = activationStatus === "payment_pending" ? "pending" : activationStatus === "failed_or_retry" ? "failed" : "unpaid";
  }

  // Check DB enrollment first
  if (dbEnrollment && base.status !== "active" && base.status !== "awaiting_payment") {
    const enrollStatus = (dbEnrollment.enrollment_status || "exploring") as EnrollmentStatus;
    const payStatus = (dbEnrollment.payment_status || "unpaid") as PaymentStatus;

    base.enrollmentStatus = enrollStatus;
    base.paymentStatus = payStatus;

    if (payStatus === "paid" && (enrollStatus === "active" || enrollStatus === "completed")) {
      base.status = "active";
    } else if (enrollStatus === "placement_done" || enrollStatus === "path_selected" || enrollStatus === "awaiting_payment") {
      base.status = payStatus === "paid" ? "active" : "awaiting_payment";
    } else if (enrollStatus === "exploring") {
      base.status = "not_started";
    }
  }

  // Enrich with local progress data
  try {
    const { pathModules: modules } = resolveRussianPathContext(dbEnrollment);
    if (modules.length === 0) return base;
    const progress = getProgress();
    const allLessons = getAllLessonsFromModules(modules);
    const completed = progress.completedLessons.filter(s => allLessons.some(l => l.slug === s)).length;

    if (base.status === "not_started" && !dbEnrollment) {
      // Has local onboarding but no DB record — treat as path_selected
      base.status = "awaiting_payment";
      base.enrollmentStatus = "path_selected";
      base.paymentStatus = "unpaid";
    }

    base.progress = allLessons.length > 0 ? Math.round((completed / allLessons.length) * 100) : 0;
    base.lessonsCompleted = completed;
    base.lessonsTotal = allLessons.length;
    base.level = "A1";
  } catch {}

  return base;
}

const COMING_SOON: CourseCard[] = [
  { id: "english", slug: "english", flag: "🇬🇧", nameKey: "languages.home.english", descKey: "languages.home.englishDesc", status: "coming_soon" },
  { id: "turkish", slug: "turkish", flag: "🇹🇷", nameKey: "languages.home.turkish", descKey: "languages.home.turkishDesc", status: "coming_soon" },
  { id: "french", slug: "french", flag: "🇫🇷", nameKey: "languages.home.french", descKey: "languages.home.frenchDesc", status: "coming_soon" },
  { id: "german", slug: "german", flag: "🇩🇪", nameKey: "languages.home.german", descKey: "languages.home.germanDesc", status: "coming_soon" },
];

export default function MyLearning() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { loading: activationLoading, enrollment: activationEnrollment, activationStatus, isActivated, paymentRoute } = useRussianActivation();
  const { enrollment: courseEnrollment } = useMyEnrollment("russian");
  const isAr = language === "ar";
  const Arrow = isAr ? ChevronLeft : ChevronRight;

  const [isAuth, setIsAuth] = useState<boolean | null>(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAuth(false);
        navigate("/languages", { replace: true });
        return;
      }
      setIsAuth(true);
      setUserName(session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "");
    };
    check();
  }, [navigate]);

  // Phase 1: Active students go directly to their course dashboard
  useEffect(() => {
    if (isAuth && !activationLoading && isActivated) {
      navigate("/languages/russian/dashboard", { replace: true });
    }
  }, [isAuth, activationLoading, isActivated, navigate]);

  if (isAuth === null || activationLoading) return null;
  if (!isAuth) return null;
  // If active, the redirect effect above will handle it — show nothing while redirecting
  if (isActivated) return null;

  const russian = buildRussianCourse(activationEnrollment, activationStatus, isActivated);
  const activeCourses = [russian].filter(c => c.status === "active");
  const pendingCourses = [russian].filter(c => c.status === "awaiting_payment");
  const availableCourses = [russian].filter(c => c.status === "not_started");

  const totalLessons = activeCourses.reduce((s, c) => s + (c.lessonsCompleted || 0), 0);
  const totalProgress = activeCourses.length > 0
    ? Math.round(activeCourses.reduce((s, c) => s + (c.progress || 0), 0) / activeCourses.length) : 0;

  return (
    <Layout>
      <div className="min-h-[80vh] bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8">

          {/* ═══ Welcome ═══ */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="mb-8 relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/8 via-card to-card p-6">
            <div className="absolute -top-20 -end-20 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="relative flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                <GraduationCap className="w-7 h-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {t("languages.home.welcome", { name: userName })}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t("languages.home.subtitle")}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="relative grid grid-cols-4 gap-3">
              {[
                { icon: Target, value: `${totalProgress}%`, label: t("languages.home.overallProgress"), color: "text-primary", bg: "bg-primary/10" },
                { icon: BookOpen, value: totalLessons, label: t("languages.home.lessonsLabel"), color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { icon: Brain, value: 0, label: t("languages.home.wordsLabel"), color: "text-violet-500", bg: "bg-violet-500/10" },
                { icon: Flame, value: activeCourses.length, label: t("languages.home.activeCourses"), color: "text-orange-500", bg: "bg-orange-500/10" },
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="bg-card/80 backdrop-blur-sm border border-border rounded-xl p-3 text-center">
                  <div className={cn("w-8 h-8 rounded-lg mx-auto mb-1.5 flex items-center justify-center", stat.bg)}>
                    <stat.icon className={cn("w-4 h-4", stat.color)} />
                  </div>
                  <p className="text-lg font-extrabold text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ═══ Active courses ═══ */}
          {activeCourses.length > 0 && (
            <Section icon={Play} titleKey="languages.home.activeLearning" delay={0.15}>
              {activeCourses.map(course => (
                <ActiveCourseCard key={course.id} course={course} t={t} Arrow={Arrow}
                  onClick={() => navigate(course.dashboardRoute!)} />
              ))}
            </Section>
          )}

          {/* ═══ Awaiting payment ═══ */}
          {pendingCourses.length > 0 && (
            <Section icon={CreditCard} titleKey="languages.home.awaitingPayment" delay={0.2}>
              {pendingCourses.map(course => (
                <PendingCourseCard key={course.id} course={course} t={t}
                  courseEnrollment={courseEnrollment}
                  onActivate={() => navigate(paymentRoute)}
                  onContinueFree={() => navigate(course.planRoute || course.onboardingRoute!)} />
              ))}
            </Section>
          )}

          {/* ═══ Available to start ═══ */}
          {availableCourses.length > 0 && (
            <Section icon={Star} titleKey="languages.home.startLearning" delay={0.25}>
              {availableCourses.map(course => (
                <button key={course.id}
                  onClick={() => navigate(course.onboardingRoute || `/languages/${course.slug}`)}
                  className="w-full bg-card border border-border rounded-2xl p-4 text-start hover:border-primary/30 hover:shadow-sm transition-all group">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{course.flag}</span>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-foreground">{t(course.nameKey)}</h3>
                      <p className="text-xs text-muted-foreground">{t(course.descKey)}</p>
                    </div>
                    <Arrow className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </button>
              ))}
            </Section>
          )}

          {/* ═══ Coming soon ═══ */}
          <Section icon={Clock} titleKey="languages.home.comingSoon" delay={0.3}>
            <div className="grid grid-cols-2 gap-2">
              {COMING_SOON.map(lang => (
                <div key={lang.id} className="bg-card border border-border rounded-2xl p-4 opacity-60">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{lang.flag}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{t(lang.nameKey)}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Lock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{t("languages.home.comingSoonLabel")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </Layout>
  );
}

/* ── Sub-components ── */

function Section({ icon: Icon, titleKey, delay, children }: {
  icon: typeof Play; titleKey: string; delay: number; children: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay }} className="mb-8">
      <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
        <Icon className="w-4 h-4 text-primary" />
        {t(titleKey)}
      </h2>
      <div className="space-y-3">{children}</div>
    </motion.section>
  );
}

function ActiveCourseCard({ course, t, Arrow, onClick }: {
  course: CourseCard; t: (k: string) => string; Arrow: typeof ChevronRight; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className="w-full bg-card border-2 border-primary/20 rounded-2xl p-5 text-start hover:border-primary/40 hover:shadow-md transition-all group">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-3xl shrink-0">
          {course.flag}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-base font-bold text-foreground">{t(course.nameKey)}</h3>
            <div className="flex items-center gap-1.5">
              {course.level && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{course.level}</span>
              )}
              <Arrow className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                initial={{ width: 0 }} animate={{ width: `${course.progress || 0}%` }}
                transition={{ duration: 0.6, delay: 0.3 }} />
            </div>
            <span className="text-xs font-bold text-foreground tabular-nums min-w-[36px] text-end">{course.progress}%</span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" />{course.lessonsCompleted}/{course.lessonsTotal} {t("languages.home.lessons")}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function PendingCourseCard({ course, t, onActivate, onContinueFree, courseEnrollment }: {
  course: CourseCard; t: (k: string) => string; onActivate: () => void; onContinueFree: () => void; courseEnrollment?: any;
}) {
  const hasSubmitted = courseEnrollment && ["submitted", "under_review"].includes(courseEnrollment.request_status);
  const isRejected = courseEnrollment?.request_status === "rejected";

  return (
    <div className="bg-card border-2 border-amber-400/30 rounded-2xl p-5">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-3xl shrink-0">
          {course.flag}
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-foreground">{t(course.nameKey)}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            {hasSubmitted ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {t("languages.enrollment.awaitingApproval")}
                </span>
              </>
            ) : isRejected ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                <span className="text-xs font-medium text-destructive">
                  {t("languages.enrollment.statusRejected")}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {t("languages.home.paymentRequired")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      {course.progress != null && course.progress > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${course.progress}%` }} />
          </div>
          <span className="text-xs font-bold text-foreground">{course.progress}%</span>
        </div>
      )}
      <div className="flex gap-2">
        {hasSubmitted ? (
          <div className="flex-1 text-center py-2 px-4 rounded-lg bg-muted text-muted-foreground text-sm font-medium">
            {t("languages.enrollment.pendingReview")}
          </div>
        ) : (
          <DSButton onClick={onActivate} className="flex-1 gap-1.5">
            <CreditCard className="w-4 h-4" />
            {t("languages.home.activateCourse")}
          </DSButton>
        )}
        <DSButton variant="outline" onClick={onContinueFree} className="gap-1.5">
          {t("languages.home.continueFree")}
        </DSButton>
      </div>
    </div>
  );
}
