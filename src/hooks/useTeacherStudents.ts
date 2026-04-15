/**
 * useTeacherStudents — Fetches Russian language students for teacher dashboard.
 * Uses portalInvoke to query via edge function (staff-gated).
 * Includes promise-level deduplication and stale-while-revalidate caching.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { portalInvoke } from '@/api/portalInvoke';

export interface TeacherStudent {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_storage_path: string | null;
  enrollment_status: string;
  request_status: string | null;
  current_module: string | null;
  current_lesson: string | null;
  lessons_completed: number;
  total_lessons_started: number;
  words_learned: number;
  total_vocab: number;
  placement_score: number | null;
  placement_category: string | null;
  placement_date: string | null;
  latest_activity: string | null;
  enrolled_at: string | null;
}

export interface TeacherStudentDetail {
  profile: any;
  courseState?: any;
  lessons: any[];
  vocab: any[];
  placements: any[];
  notes: any[];
  examNotices?: any[];
  releasedLessons?: any[];
  taughtLessons?: string[];
}

// Module-level cache for deduplication
let _studentsCache: TeacherStudent[] | null = null;
let _studentsCacheTime = 0;
let _studentsInflight: Promise<void> | null = null;
const CACHE_TTL = 30_000; // 30s stale-while-revalidate

export function useTeacherStudents() {
  const [students, setStudents] = useState<TeacherStudent[]>(_studentsCache || []);
  const [loading, setLoading] = useState(!_studentsCache);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async (force = false) => {
    // Return cached if fresh
    if (!force && _studentsCache && Date.now() - _studentsCacheTime < CACHE_TTL) {
      setStudents(_studentsCache);
      setLoading(false);
      return;
    }

    // Dedup in-flight requests
    if (_studentsInflight) {
      await _studentsInflight;
      if (_studentsCache) setStudents(_studentsCache);
      setLoading(false);
      return;
    }

    setLoading(!_studentsCache); // only show loading if no cached data
    setError(null);

    _studentsInflight = (async () => {
      try {
        const res = await portalInvoke<{ students: TeacherStudent[] }>('teacher_get_students');
        if (res.ok && res.data) {
          _studentsCache = res.data.students || [];
          _studentsCacheTime = Date.now();
          setStudents(_studentsCache);
        } else {
          setError(res.error || 'FETCH_FAILED');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'UNKNOWN_ERROR');
      } finally {
        setLoading(false);
        _studentsInflight = null;
      }
    })();

    await _studentsInflight;
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const refresh = useCallback(() => fetchStudents(true), [fetchStudents]);

  return { students, loading, error, refresh };
}

export function useTeacherStudentDetail(studentUserId: string | null) {
  const [detail, setDetail] = useState<TeacherStudentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!studentUserId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await portalInvoke<TeacherStudentDetail>('teacher_get_student_detail', {
        student_user_id: studentUserId,
      });
      if (res.ok && res.data) {
        setDetail(res.data);
      } else {
        setError(res.error || 'FETCH_FAILED');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'UNKNOWN_ERROR');
    } finally {
      setLoading(false);
    }
  }, [studentUserId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { detail, loading, error, refresh: fetch };
}

export async function addTeacherNote(studentUserId: string, note: string) {
  return portalInvoke('teacher_add_note', {
    student_user_id: studentUserId,
    note,
    language_key: 'russian',
  });
}

export async function setTeacherExamDecision(studentUserId: string, decision: 'proceed' | 'retake' | 'recovery', reason?: string) {
  return portalInvoke('teacher_set_exam_decision', {
    student_user_id: studentUserId,
    decision,
    reason: reason || null,
  });
}
