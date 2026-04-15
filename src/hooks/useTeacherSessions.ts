/**
 * useTeacherSessions — Manages teacher session CRUD via portalInvoke.
 * Includes promise-level deduplication and stale-while-revalidate caching.
 */
import { useState, useEffect, useCallback } from 'react';
import { portalInvoke } from '@/api/portalInvoke';

export interface TeacherSession {
  id: string;
  teacher_user_id: string;
  language_key: string;
  teacher_type?: 'language_teacher' | 'curriculum_exam_teacher';
  lesson_slug: string | null;
  module_slug: string | null;
  curriculum_course_id?: string | null;
  curriculum_module_id?: string | null;
  curriculum_lesson_id?: string | null;
  session_type: string;
  status: string;
  scheduled_at: string | null;
  zoom_link: string | null;
  summary: string | null;
  next_action: string | null;
  created_at: string;
  updated_at: string;
  students?: SessionStudent[];
}

export interface SessionStudent {
  id: string;
  session_id: string;
  student_user_id: string;
  attendance_status: string;
  full_name?: string | null;
  email?: string | null;
  current_lesson?: string | null;
  current_module?: string | null;
}

export interface SessionEvaluation {
  id: string;
  session_id: string;
  student_user_id: string;
  participation_score: number | null;
  understanding_score: number | null;
  confidence_score: number | null;
  needs_review: boolean;
  recommended_next_action: string | null;
  note: string | null;
}

// Module-level cache for deduplication
let _sessionsCache: TeacherSession[] | null = null;
let _sessionsCacheTime = 0;
let _sessionsInflight: Promise<void> | null = null;
const CACHE_TTL = 30_000; // 30s

export function useTeacherSessions() {
  const [sessions, setSessions] = useState<TeacherSession[]>(_sessionsCache || []);
  const [loading, setLoading] = useState(!_sessionsCache);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async (force = false) => {
    if (!force && _sessionsCache && Date.now() - _sessionsCacheTime < CACHE_TTL) {
      setSessions(_sessionsCache);
      setLoading(false);
      return;
    }

    if (_sessionsInflight) {
      await _sessionsInflight;
      if (_sessionsCache) setSessions(_sessionsCache);
      setLoading(false);
      return;
    }

    setLoading(!_sessionsCache);
    setError(null);

    _sessionsInflight = (async () => {
      try {
        const res = await portalInvoke<{ sessions: TeacherSession[] }>('teacher_list_sessions');
        if (res.ok && res.data) {
          _sessionsCache = res.data.sessions || [];
          _sessionsCacheTime = Date.now();
          setSessions(_sessionsCache);
        } else {
          setError(res.error || 'FETCH_FAILED');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'UNKNOWN_ERROR');
      } finally {
        setLoading(false);
        _sessionsInflight = null;
      }
    })();

    await _sessionsInflight;
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const refresh = useCallback(() => fetchSessions(true), [fetchSessions]);

  return { sessions, loading, error, refresh };
}

export function useTeacherSessionDetail(sessionId: string | null) {
  const [session, setSession] = useState<TeacherSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await portalInvoke<TeacherSession>('teacher_get_session', { session_id: sessionId });
      if (res.ok && res.data) {
        setSession(res.data);
      } else {
        setError(res.error || 'FETCH_FAILED');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'UNKNOWN_ERROR');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  return { session, loading, error, refresh: fetchSession };
}

export async function createSession(params: {
  student_user_ids: string[];
  language_key?: string;
  lesson_slug?: string | null;
  module_slug?: string | null;
  session_type?: string;
  teacher_type?: 'language_teacher' | 'curriculum_exam_teacher';
  curriculum_course_id?: string | null;
  curriculum_module_id?: string | null;
  curriculum_lesson_id?: string | null;
  scheduled_at?: string | null;
}) {
  return portalInvoke<TeacherSession>('teacher_create_session', params);
}

export async function updateSession(params: {
  session_id: string;
  status?: string;
  zoom_link?: string;
  lesson_slug?: string | null;
  module_slug?: string | null;
  session_type?: string;
  teacher_type?: 'language_teacher' | 'curriculum_exam_teacher';
  curriculum_course_id?: string | null;
  curriculum_module_id?: string | null;
  curriculum_lesson_id?: string | null;
  scheduled_at?: string | null;
}) {
  return portalInvoke<TeacherSession>('teacher_update_session', params);
}

export async function updateAttendance(sessionId: string, studentUserId: string, status: string) {
  return portalInvoke('teacher_update_attendance', {
    session_id: sessionId,
    student_user_id: studentUserId,
    attendance_status: status,
  });
}

export async function saveSessionOutcome(params: {
  session_id: string;
  summary: string;
  next_action?: string;
  action_items?: Array<{
    student_user_id: string;
    action_type?: string;
    title: string;
    description?: string;
    priority?: string;
    related_lesson_slug?: string;
    related_module_slug?: string;
    recap_available?: boolean;
  }>;
}) {
  return portalInvoke('teacher_save_session_outcome', params);
}

export async function saveStudentEvaluation(params: {
  session_id: string;
  student_user_id: string;
  participation_score?: number;
  understanding_score?: number;
  confidence_score?: number;
  needs_review?: boolean;
  recommended_next_action?: string;
  note?: string;
}) {
  return portalInvoke('teacher_save_evaluation', params);
}

export async function getSessionEvaluations(sessionId: string) {
  return portalInvoke<{ evaluations: SessionEvaluation[] }>('teacher_get_evaluations', {
    session_id: sessionId,
  });
}

export async function deleteSession(sessionId: string) {
  return portalInvoke('teacher_delete_session', { session_id: sessionId });
}
