import {
  BookOpen,
  BarChart3,
  Users,
  GraduationCap,
  MessageCircle,
  CalendarDays,
  Library,
  UsersRound,
} from "lucide-react";
import type { BusuuNavTab } from "@/components/languages/dashboard/BusuuNavBar";

export const RUSSIAN_STUDENT_NAV_IDS = [
  "overview",
  "sessions",
  "messages",
  "assignments",
  "progress",
  "exams",
  "courses",
  "community",
] as const;

const TAB_ICONS = {
  overview: BookOpen,
  sessions: CalendarDays,
  messages: MessageCircle,
  assignments: GraduationCap,
  progress: BarChart3,
  exams: Users,
  courses: Library,
  community: UsersRound,
} as const;

export function buildRussianStudentNavTabs(
  badges: Partial<Record<(typeof RUSSIAN_STUDENT_NAV_IDS)[number], number>> = {},
): BusuuNavTab[] {
  return RUSSIAN_STUDENT_NAV_IDS.map((tab) => ({
    id: tab,
    icon: TAB_ICONS[tab],
    labelKey: `languages.dashboard.tabs.${tab}`,
    badge: badges[tab] ?? 0,
  }));
}

export function getRussianStudentNavHref(tab: string, options: { teacherMode?: boolean } = {}) {
  const params = new URLSearchParams({ tab });

  if (options.teacherMode) {
    params.set("teacher_mode", "1");
  }

  return `/languages/russian/dashboard?${params.toString()}`;
}
