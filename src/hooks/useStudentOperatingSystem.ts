import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AssignmentItem, LearningEnrollment, StudyStats } from '@/hooks/useLearningState';
import type { DashboardPayload, ExamNotice } from '@/types/russianExecutionPack';
import type { StudentOperatingSystemData } from '@/types/studentOperatingSystem';
import { buildStudentOperatingSystemData } from '@/lib/studentOperatingSystem';
import { portalInvoke } from '@/api/portalInvoke';

interface Props {
  userId: string | null;
  assignments: AssignmentItem[];
  examNotices: ExamNotice[];
  enrollment: LearningEnrollment | null;
  dashboardData: DashboardPayload | null;
  studyStats: StudyStats;
  completedLessons: number;
  totalLessons: number;
}

export function useStudentOperatingSystem({
  userId,
  assignments,
  examNotices,
  enrollment,
  dashboardData,
  studyStats,
  completedLessons,
  totalLessons,
}: Props) {
  type SessionMembershipRow = { session_id: string; attendance_status: string | null };
  type SessionRow = { id: string; status: string; scheduled_at: string | null; session_type: string; lesson_slug: string | null; module_slug: string | null; zoom_link: string | null; summary: string | null; next_action: string | null; teacher_user_id: string };
  type SessionNoteRow = { session_id: string; summary: string; next_action: string | null };
  type EvaluationRow = { session_id: string; understanding_score: number | null; confidence_score: number | null; participation_score: number | null };
  type StudentSessionsPayload = {
    sessions: SessionRow[];
    notes: SessionNoteRow[];
    evaluations: EvaluationRow[];
    teacherNames?: Record<string, string | null>;
    attendanceBySessionId?: Record<string, string | null>;
    aiRecapUsage?: number;
  };

  const [sessionsRaw, setSessionsRaw] = useState<SessionRow[]>([]);
  const [sessionNotes, setSessionNotes] = useState<SessionNoteRow[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([]);
  const [teacherNames, setTeacherNames] = useState<Record<string, string | null>>({});
  const [attendanceBySessionId, setAttendanceBySessionId] = useState<Record<string, string | null>>({});
  const [aiRecapUsage, setAiRecapUsage] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setSessionsRaw([]);
      setSessionNotes([]);
      setEvaluations([]);
      setTeacherNames({});
      setAttendanceBySessionId({});
      setAiRecapUsage(0);
      return;
    }

    const toAttendanceMap = (rows: SessionMembershipRow[] | null | undefined) => {
      const map: Record<string, string | null> = {};
      (rows || []).forEach((row) => {
        map[row.session_id] = row.attendance_status ?? null;
      });
      return map;
    };

    let alive = true;
    setLoading(true);

    Promise.resolve().then(async () => {
      const apiSessions = await portalInvoke<StudentSessionsPayload>('student_list_sessions');
      if (apiSessions.ok && apiSessions.data) {
        if (!alive) return;

        // Deduplicate by session ID at source
        const sessionsFromApi = Array.from(new Map((apiSessions.data.sessions || []).map(s => [s.id, s])).values());
        let attendanceMap = apiSessions.data.attendanceBySessionId || {};

        if (!Object.keys(attendanceMap).length && sessionsFromApi.length) {
          const sessionIds = Array.from(new Set(sessionsFromApi.map((s) => s.id).filter(Boolean)));
          if (sessionIds.length) {
            const { data: attendanceRows } = await supabase
              .from('teacher_session_students')
              .select('session_id, attendance_status')
              .eq('student_user_id', userId)
              .in('session_id', sessionIds);

            attendanceMap = toAttendanceMap((attendanceRows || []) as SessionMembershipRow[]);
          }
        }

        setSessionsRaw(sessionsFromApi);
        setSessionNotes(apiSessions.data.notes || []);
        setEvaluations(apiSessions.data.evaluations || []);
        setTeacherNames(apiSessions.data.teacherNames || {});
        setAttendanceBySessionId(attendanceMap);
        setAiRecapUsage(apiSessions.data.aiRecapUsage ?? (apiSessions.data.notes || []).length);
        return;
      }

      const { data: membershipRows, error: membershipError } = await supabase
        .from('teacher_session_students')
        .select('session_id, attendance_status')
        .eq('student_user_id', userId);

      if (membershipError) {
        throw membershipError;
      }

      const membershipList = (membershipRows || []) as SessionMembershipRow[];
      const attendanceMap = toAttendanceMap(membershipList);
      const sessionIds = Array.from(new Set(membershipList.map((row) => row.session_id)));

      if (!sessionIds.length) {
        if (alive) {
          setSessionsRaw([]);
          setSessionNotes([]);
          setEvaluations([]);
          setTeacherNames({});
          setAttendanceBySessionId({});
          setAiRecapUsage(0);
        }
        return;
      }

      const sessionsQuery = supabase
        .from('teacher_sessions')
        .select('id, status, scheduled_at, session_type, lesson_slug, module_slug, zoom_link, summary, next_action, teacher_user_id')
        .in('id', sessionIds);

      const [sessionsRes, notesRes, evalRes] = await Promise.all([
        sessionsQuery,
        supabase
          .from('teacher_session_notes')
          .select('session_id, summary, next_action')
          .in('session_id', sessionIds),
        supabase
          .from('teacher_student_session_evaluations')
          .select('session_id, understanding_score, confidence_score, participation_score')
          .eq('student_user_id', userId)
          .in('session_id', sessionIds),
      ]);

      if (sessionsRes.error) {
        throw sessionsRes.error;
      }

      const sessions = sessionsRes.data || [];
      const uniqueTeacherIds = Array.from(new Set((sessions as SessionRow[]).map((session) => session.teacher_user_id).filter(Boolean)));

      let nameMap: Record<string, string | null> = {};
      if (uniqueTeacherIds.length) {
        const [{ data: profileRows }, { data: teacherProfileRows }] = await Promise.all([
          supabase.from('profiles').select('user_id, full_name').in('user_id', uniqueTeacherIds),
          supabase.from('teacher_public_profiles').select('user_id, display_name').in('user_id', uniqueTeacherIds),
        ]);

        (profileRows || []).forEach((row: { user_id: string; full_name: string | null }) => {
          nameMap[row.user_id] = row.full_name;
        });

        (teacherProfileRows || []).forEach((row: { user_id: string; display_name: string | null }) => {
          if (row.display_name) nameMap[row.user_id] = row.display_name;
        });
      }

      if (!alive) return;
      setSessionsRaw(sessions);
      setSessionNotes(notesRes.data || []);
      setEvaluations(evalRes.data || []);
      setTeacherNames(nameMap);
      setAttendanceBySessionId(attendanceMap);
      setAiRecapUsage((notesRes.data || []).length);
    }).catch((error) => {
      console.error('[useStudentOperatingSystem]', error);
    }).finally(() => {
      if (alive) setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [userId]);

  const data: StudentOperatingSystemData | null = useMemo(() => {
    if (!userId) return null;

    return buildStudentOperatingSystemData({
      sessions: sessionsRaw,
      sessionNotes,
      evaluations,
      teacherNames,
      attendanceBySessionId,
      assignments,
      examNotices,
      enrollment,
      dashboardData,
      studyStats,
      completedLessons,
      totalLessons,
      aiRecapUsage,
    });
  }, [
    userId,
    sessionsRaw,
    sessionNotes,
    evaluations,
    teacherNames,
    attendanceBySessionId,
    assignments,
    examNotices,
    enrollment,
    dashboardData,
    studyStats,
    completedLessons,
    totalLessons,
    aiRecapUsage,
  ]);

  return {
    data,
    loading,
  };
}
