import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { Play, CheckCircle2, Lock, BookOpen, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getAllLessonsFromModules, type Module } from "@/lib/russianCourse";
import type { AssignmentItem, ExamNotice } from "@/hooks/useLearningState";
import type { DashboardPayload } from '@/types/russianExecutionPack';
import { StudentOperatingSystemPanel } from '@/components/languages/dashboard/StudentOperatingSystemPanel';
import type { StudentOperatingSystemData } from '@/types/studentOperatingSystem';
import type { SharedExamTruth } from '@/lib/examTruth';
import type { CourseState, LessonProgressionEntry } from '@/hooks/useStudentProgression';
import type { ResolvedPath } from "@/lib/learningPathResolver";
import { useState, useMemo } from "react";
import { DashboardCoursesTab } from "./DashboardCoursesTab";

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

interface Props {
  onboardingState: { goal: string; timeline: string; level: string; dailyMinutes: string; academicTrack?: string } | null;
  studyStats: { daysActive: number; totalMinutes: number; sessionsCount: number; weeklyMinutes: number; weekLessons?: number };
  vocabCount: number;
  assignmentsPending: number;
  examUpcoming: number;
  goalKeyMap: (v: string) => string;
  timelineKeyMap: (v: string) => string;
  levelKeyMap: (v: string) => string;
  dailyKeyMap: (v: string) => string;
  nextAssignment?: AssignmentItem | null;
  nextExam?: ExamNotice | null;
  onTabChange?: (tab: string) => void;
  pathModules: Module[];
  resolvedPath: ResolvedPath;
  dashboardData?: DashboardPayload | null;
  operatingSystemData?: StudentOperatingSystemData | null;
  userName?: string;
  isTeacherControlled?: boolean;
  isLessonAccessible?: (lessonSlug: string) => boolean;
  getLessonStatus?: (lessonSlug: string) => string;
  courseState?: CourseState | null;
  releasedLessons?: LessonProgressionEntry[];
  examTruth?: SharedExamTruth;
}

export function DashboardOverviewTab({
  studyStats, assignmentsPending, nextAssignment, nextExam, onTabChange, pathModules, resolvedPath, dashboardData, operatingSystemData, userName, isTeacherControlled, isLessonAccessible, getLessonStatus, courseState, releasedLessons, examTruth,
}: Props) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  // Real progress only: truth source is student_lesson_progression (completed lessons)
  const allLessons = getAllLessonsFromModules(pathModules);
  const allLessonSlugs = new Set(allLessons.map((l) => l.slug));
  const completedSessionLessonSlugs = new Set(
    (operatingSystemData?.sessions ?? [])
      .filter((session) => session.status === 'completed' && Boolean(session.targetLessonSlug))
      .map((session) => session.targetLessonSlug as string)
  );
  const completedLessonSlugs = new Set(
    (releasedLessons ?? [])
      .filter((l) => l.status === 'completed' && Boolean(l.completed_at) && allLessonSlugs.has(l.lesson_slug) && completedSessionLessonSlugs.has(l.lesson_slug))
      .map((l) => l.lesson_slug)
  );
  const completedCount = completedLessonSlugs.size;
  const totalCount = allLessons.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* ═══ Operating System Panel (Session + Current Lesson only) ═══ */}
      {operatingSystemData && (
        <StudentOperatingSystemPanel
          data={operatingSystemData}
          dashboardData={dashboardData}
          onTabChange={onTabChange}
          assignmentsPending={assignmentsPending}
          nextAssignment={nextAssignment ?? null}
          nextExam={nextExam ?? null}
          courseState={courseState ?? null}
          releasedLessons={releasedLessons ?? []}
          examTruth={examTruth}
          isTeacherControlled={Boolean(isTeacherControlled)}
          getLessonStatus={getLessonStatus}
          compact
        />
      )}

      {/* ═══ Curriculum — CEFR Timeline ═══ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            {t('languages.dashboard.os.curriculumBrowser')}
          </h3>
          <span className="text-xs text-muted-foreground">{completedCount}/{totalCount} {t('languages.dashboard.lessonsCompleted')}</span>
        </div>
        <DashboardCoursesTab
          progressPercent={totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}
          completedLessonSlugs={completedLessonSlugs}
          pathModuleSlugs={pathModules.map(m => m.slug)}
        />
      </div>
    </div>
  );
}
