import { useEffect, useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CreditCard, Lock,
  BookOpen, BarChart3, Users, GraduationCap, MessageCircle, CalendarDays, Library, UsersRound,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { DashboardOverviewTab } from "@/components/languages/dashboard/DashboardOverviewTab";
import { DashboardAssignmentsTab } from "@/components/languages/dashboard/DashboardAssignmentsTab";
import { DashboardProgressTab } from "@/components/languages/dashboard/DashboardProgressTab";
import { DashboardExamsTab } from "@/components/languages/dashboard/DashboardExamsTab";
import { DashboardSessionsTab } from "@/components/languages/dashboard/DashboardSessionsTab";
import { DashboardMessagesTab } from "@/components/languages/dashboard/DashboardMessagesTab";
import { DashboardCoursesTab } from "@/components/languages/dashboard/DashboardCoursesTab";
import { DashboardCommunityTab } from "@/components/languages/dashboard/DashboardCommunityTab";
import { DSButton } from "@/components/design-system/DSButton";
import { useLearningState } from "@/hooks/useLearningState";
import { useRussianActivation } from "@/hooks/useRussianActivation";
import { translateLanguageCourseValue } from "@/lib/languageCourseI18n";
import type { OnboardingState } from "@/lib/learningPathResolver";
import { resolveRussianPathContext } from "@/lib/russianPathState";
import { useRussianDashboardData } from '@/hooks/useRussianDashboardData';
import { useStudentOperatingSystem } from '@/hooks/useStudentOperatingSystem';
import { useStudentProgression } from '@/hooks/useStudentProgression';
import { ALL_RUSSIAN_MODULES, getAllLessonsFromModules } from '@/lib/russianCourse';
import { resolveSharedExamTruth } from '@/lib/examTruth';
import { useCommUnreadCount } from '@/hooks/useCommApi';
import { BusuuNavBar, type BusuuNavTab, type NavNotification } from '@/components/languages/dashboard/BusuuNavBar';
import { useStudentFriendships } from '@/hooks/useStudentFriendships';
import { buildAvatarDisplayUrl } from '@/features/avatar/avatarImageUtils';
import { Layout } from "@/components/layout/Layout";

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

const TABS = ["overview", "sessions", "messages", "assignments", "progress", "exams", "courses", "community"] as const;

const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  overview: BookOpen,
  sessions: CalendarDays,
  messages: MessageCircle,
  assignments: GraduationCap,
  progress: BarChart3,
  exams: Users,
  courses: Library,
  community: UsersRound,
};

export default function RussianDashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isTeacherMode = searchParams.get("teacher_mode") === "1";
  const { loading: activationLoading, isActivated, activationStatus, paymentRoute } = useRussianActivation();
  const [hasTeacherProgression, setHasTeacherProgression] = useState(false);
  const { count: unreadMessages } = useCommUnreadCount();

  const activeTab = isTeacherMode ? "courses" : ((searchParams.get("tab") as typeof TABS[number]) || "overview");
  const setActiveTab = (tab: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", isTeacherMode ? "courses" : tab);

    if (isTeacherMode) nextParams.set("teacher_mode", "1");
    else nextParams.delete("teacher_mode");

    setSearchParams(nextParams, { replace: true });
  };

  const [onboardingState, setOnboardingState] = useState<OnboardingState | null>(null);
  const { userId, enrollment, vocabItems, assignments, examNotices, studyStats, loading, ensureEnrollment, submitAssignment, startAssignment } = useLearningState();
  const { dashboard: dashboardData, phase1a, phase1b, phase1c, phase1Full } = useRussianDashboardData(userId);
  const [userName, setUserName] = useState<string | undefined>(undefined);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const { pendingReceived: friendRequests } = useStudentFriendships(userId, 'russian');

  useEffect(() => {
    if (!userId) return;
    supabase.from('profiles').select('full_name, avatar_storage_path').eq('user_id', userId).maybeSingle()
      .then(({ data }) => {
        if (data?.full_name) setUserName(data.full_name);
        if (data?.avatar_storage_path) setUserAvatar(data.avatar_storage_path);
      });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('student_course_state')
      .select('progression_status')
      .eq('student_user_id', userId)
      .eq('course_key', 'russian')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.progression_status === 'active') {
          setHasTeacherProgression(true);
        }
      });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!isTeacherMode) return;

    const nextParams = new URLSearchParams(searchParams);
    let changed = false;

    if (nextParams.get("tab") !== "courses") {
      nextParams.set("tab", "courses");
      changed = true;
    }

    if (nextParams.get("teacher_mode") !== "1") {
      nextParams.set("teacher_mode", "1");
      changed = true;
    }

    if (changed) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [isTeacherMode, searchParams, setSearchParams]);

  useEffect(() => {
    if (isTeacherMode) return;

    if (loading || activationLoading) return;
    if (isActivated || hasTeacherProgression) {
      const { onboardingState: nextState } = resolveRussianPathContext(enrollment);
      if (nextState) setOnboardingState(nextState);
      if (!enrollment) ensureEnrollment();
      return;
    }
    const { onboardingState: nextState } = resolveRussianPathContext(enrollment);
    if (nextState) {
      setOnboardingState(nextState);
      if (!enrollment) ensureEnrollment();
      return;
    }
    navigate("/languages/russian/onboarding");
  }, [navigate, ensureEnrollment, enrollment, loading, activationLoading, isActivated, hasTeacherProgression, isTeacherMode]);

  const { resolvedPath, pathModules } = useMemo(
    () => {
      if (isTeacherMode) {
        return { onboardingState: null, resolvedPath: null, pathModules: ALL_RUSSIAN_MODULES };
      }

      return onboardingState ? resolveRussianPathContext({
        goal: onboardingState.goal, timeline: onboardingState.timeline,
        level_mode: onboardingState.level, daily_minutes: onboardingState.dailyMinutes,
        academic_track: onboardingState.academicTrack, placement_result: onboardingState.placementResult,
        placement_score: onboardingState.placementScore,
      }) : { onboardingState: null, resolvedPath: null, pathModules: [] };
    },
    [isTeacherMode, onboardingState]
  );

  const lessonUniverse = useMemo(() => getAllLessonsFromModules(pathModules), [pathModules]);
  const lessonUniverseSlugs = useMemo(() => new Set(lessonUniverse.map((lesson) => lesson.slug)), [lessonUniverse]);

  const {
    isTeacherControlled, isLessonAccessible, getLessonStatus, courseState, releasedLessons,
  } = useStudentProgression(userId);

  const completedLessonSlugs = useMemo(() => new Set(
    releasedLessons
      .filter((lesson) => lesson.status === 'completed' && Boolean(lesson.completed_at) && lessonUniverseSlugs.has(lesson.lesson_slug))
      .map((lesson) => lesson.lesson_slug)
  ), [releasedLessons, lessonUniverseSlugs]);

  const completedLessons = completedLessonSlugs.size;

  const { data: operatingSystemData } = useStudentOperatingSystem({
    userId, assignments, examNotices, enrollment,
    dashboardData: dashboardData ?? null, studyStats,
    completedLessons, totalLessons: lessonUniverse.length,
  });

  const formatProductLabel = (key: string) => translateLanguageCourseValue(t, `languages.product.${key}`, key);

  if (!isTeacherMode && activationLoading) return null;
  if (!isTeacherMode && (!onboardingState || !resolvedPath)) return null;

  if (!isTeacherMode && !isActivated && !hasTeacherProgression) {
    return (
      <Layout>
        <div className="min-h-[80vh] bg-background">
          <div className="max-w-3xl mx-auto px-4 py-8">
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-medium mb-4">
                <Lock className="w-3.5 h-3.5" />
                {activationStatus === "payment_pending" ? t("languages.home.awaitingPayment") : t("languages.home.paymentRequired")}
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">{t(resolvedPath.nameKey)}</h1>
              <p className="text-sm text-muted-foreground mb-5">{t("languages.home.paymentRequired")}</p>
              <div className="rounded-xl border border-border bg-background p-4 mb-5">
                <div className="text-sm font-semibold text-foreground mb-2">{t("languages.product.fullTier")}</div>
                <ul className="space-y-1.5 text-sm text-foreground">
                  {["fullItem1", "fullItem2", "fullItem4"].map((key) => (
                    <li key={key}>• {formatProductLabel(key)}</li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground mt-3">{t("languages.product.fullPriceNote")}</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4 mb-6">
                <p className="text-sm text-foreground">• {t("languages.product.freePlacement")}</p>
                <p className="text-sm text-foreground">• {pathModules.length} {t("languages.home.lessons")}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <DSButton onClick={() => navigate(paymentRoute)} className="gap-2">
                  <CreditCard className="w-4 h-4" />
                  {t("languages.home.activateCourse")}
                </DSButton>
                <DSButton variant="outline" onClick={() => navigate("/languages/russian/plan")}>
                  {t("languages.dashboard.viewPlan")}
                </DSButton>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const pendingAssignments = assignments.filter(a => a.status === 'new' || a.status === 'in_progress' || a.status === 'overdue').length;
  const taughtLessonSlugs = (operatingSystemData?.sessions || [])
    .filter((session) => session.status === 'completed' && session.targetLessonSlug)
    .map((session) => session.targetLessonSlug as string);
  const sharedExamTruth = resolveSharedExamTruth({
    examNotices: examNotices as any[],
    releasedLessonSlugs: releasedLessons.map((lesson) => lesson.lesson_slug),
    taughtLessonSlugs,
    nextTeacherDecision: courseState?.next_teacher_decision,
  });
  const upcomingExams = examNotices.filter((e) => e.status === 'upcoming').length;
  const nextAssignment = assignments.find(a => a.status === 'new' || a.status === 'in_progress' || a.status === 'overdue') || null;
  const nextExam = sharedExamTruth.nextExam;

  const upcomingSessions = (operatingSystemData?.sessions?.filter(s => {
    if (s.status !== 'upcoming' && s.status !== 'live') return false;
    if (!s.scheduledAt) return true;
    return Date.now() < new Date(s.scheduledAt).getTime() + 60 * 60 * 1000;
  }).length || 0);

  const progressPercent = lessonUniverse.length > 0
    ? Math.round((completedLessons / lessonUniverse.length) * 100)
    : 0;

  const busuuTabs: BusuuNavTab[] = TABS.map(tab => ({
    id: tab,
    icon: TAB_ICONS[tab] as any,
    labelKey: `languages.dashboard.tabs.${tab}`,
    badge: tab === 'assignments' ? pendingAssignments
      : tab === 'exams' ? upcomingExams
      : tab === 'sessions' ? upcomingSessions
      : tab === 'messages' ? (unreadMessages || 0)
      : 0,
  }));

  const totalNotifications = pendingAssignments + upcomingExams + (unreadMessages || 0) + upcomingSessions;

  // Build notifications list for the bell dropdown (not a hook — after early returns)
  const navNotifications: NavNotification[] = (() => {
    const items: NavNotification[] = [];
    friendRequests.forEach(fr => {
      items.push({ id: `fr-${fr.id}`, type: 'friend_request', titleKey: 'languages.dashboard.notifications.newFriendRequest', actionTabId: 'community', timestamp: fr.created_at });
    });
    (operatingSystemData?.sessions || []).filter(s => s.status === 'upcoming' || s.status === 'live').forEach(s => {
      items.push({ id: `sess-${s.id}`, type: 'session', titleKey: 'languages.dashboard.notifications.upcomingSession', timestamp: s.scheduledAt || undefined, actionTabId: 'sessions' });
    });
    assignments.filter(a => a.status === 'new' || a.status === 'in_progress' || a.status === 'overdue').slice(0, 5).forEach(a => {
      items.push({ id: `assign-${a.id}`, type: a.status === 'overdue' ? 'absence' : 'assignment', titleKey: a.status === 'overdue' ? 'languages.dashboard.notifications.overdueAssignment' : 'languages.dashboard.notifications.pendingAssignment', actionTabId: 'assignments' });
    });
    examNotices.filter(e => e.status === 'upcoming').slice(0, 3).forEach(e => {
      items.push({ id: `exam-${e.id}`, type: 'teacher', titleKey: 'languages.dashboard.notifications.upcomingExam', actionTabId: 'exams' });
    });
    return items;
  })();

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <DashboardOverviewTab
            onboardingState={onboardingState} studyStats={studyStats} vocabCount={vocabItems.length}
            assignmentsPending={pendingAssignments} examUpcoming={upcomingExams}
            goalKeyMap={goalKeyMap} timelineKeyMap={timelineKeyMap} levelKeyMap={levelKeyMap} dailyKeyMap={dailyKeyMap}
            nextAssignment={nextAssignment} nextExam={nextExam} onTabChange={setActiveTab}
            pathModules={pathModules} resolvedPath={resolvedPath} dashboardData={dashboardData}
            operatingSystemData={operatingSystemData} userName={userName}
            isTeacherControlled={isTeacherControlled} isLessonAccessible={isLessonAccessible}
            getLessonStatus={getLessonStatus} courseState={courseState} releasedLessons={releasedLessons}
            examTruth={sharedExamTruth}
          />
        );
      case "sessions":
        return <DashboardSessionsTab operatingSystemData={operatingSystemData} />;
      case "messages":
        return <DashboardMessagesTab operatingSystemData={operatingSystemData} />;
      case "assignments":
        return <DashboardAssignmentsTab assignments={assignments} onSubmit={submitAssignment} onStart={startAssignment} operatingSystemData={operatingSystemData} />;
      case "progress":
        return <DashboardProgressTab studyStats={studyStats} vocabCount={vocabItems.length} enrollment={enrollment} pathModules={pathModules} dashboardData={dashboardData} operatingSystemData={operatingSystemData} releasedLessons={releasedLessons} courseState={courseState} phase1a={phase1a} phase1b={phase1b} phase1c={phase1c} phase1Full={phase1Full} />;
      case "exams":
        return <DashboardExamsTab examNotices={examNotices} pathModules={pathModules} dashboardData={dashboardData} operatingSystemData={operatingSystemData} />;
      case "courses":
        return <DashboardCoursesTab progressPercent={progressPercent} completedLessonSlugs={completedLessonSlugs} pathModuleSlugs={isTeacherMode ? undefined : resolvedPath ? [...resolvedPath.coreModules, ...resolvedPath.branchModules] : undefined} teacherMode={isTeacherMode} />;
      case "community":
        return <DashboardCommunityTab userId={userId} courseKey="russian" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-[#18191A]">
      <BusuuNavBar
        tabs={busuuTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        streakDays={operatingSystemData?.streakDays ?? 0}
        progressPercent={progressPercent}
        notificationCount={totalNotifications}
        courseLabel={dashboardData?.course.title || t('languages.catalog.russian.name')}
        languageFlag="🇷🇺"
        pendingFriendRequests={friendRequests.length}
        notifications={navNotifications}
        vocabCount={vocabItems.length}
        completedLessons={completedLessons}
        totalLessons={lessonUniverse.length}
      />

      {/* ═══ Main Content — full width, no sidebar ═══ */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <motion.main
          key={activeTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="min-w-0"
        >
          {renderTabContent()}
        </motion.main>
      </div>
    </div>
  );
}
