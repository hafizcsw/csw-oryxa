/**
 * useStudentProgression — Teacher-controlled lesson progression hook
 * Reads from student_lesson_progression and student_course_state tables
 * These are the canonical server-truth tables for what's released/locked
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LessonProgressionEntry {
  id: string;
  lesson_slug: string;
  module_slug: string | null;
  status: 'locked' | 'released' | 'in_progress' | 'completed' | 'review_required';
  released_at: string | null;
  completed_at: string | null;
  teacher_notes: string | null;
  mastery_score: number | null;
}

export interface CourseState {
  current_lesson_slug: string | null;
  current_module_slug: string | null;
  progression_status: 'active' | 'paused' | 'completed' | 'review_hold';
  next_teacher_decision: string | null;
  last_teacher_action_at: string | null;
  last_student_activity_at: string | null;
}

export function useStudentProgression(userId: string | null, courseKey = 'russian') {
  const [progression, setProgression] = useState<LessonProgressionEntry[]>([]);
  const [courseState, setCourseState] = useState<CourseState | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) {
      setProgression([]);
      setCourseState(null);
      return;
    }

    setLoading(true);
    try {
      const [progRes, stateRes] = await Promise.all([
        supabase
          .from('student_lesson_progression')
          .select('id, lesson_slug, module_slug, status, released_at, completed_at, teacher_notes, mastery_score')
          .eq('student_user_id', userId)
          .eq('course_key', courseKey)
          .order('released_at', { ascending: true, nullsFirst: false }),
        supabase
          .from('student_course_state')
          .select('current_lesson_slug, current_module_slug, progression_status, next_teacher_decision, last_teacher_action_at, last_student_activity_at')
          .eq('student_user_id', userId)
          .eq('course_key', courseKey)
          .maybeSingle(),
      ]);

      setProgression((progRes.data as any[]) || []);
      setCourseState((stateRes.data as CourseState) || null);
    } catch (e) {
      console.error('[useStudentProgression]', e);
    } finally {
      setLoading(false);
    }
  }, [userId, courseKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`student-progression-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student_lesson_progression',
        filter: `student_user_id=eq.${userId}`,
      }, () => reload())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student_course_state',
        filter: `student_user_id=eq.${userId}`,
      }, () => reload())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  const releasedLessons = progression.filter(p => ['released', 'in_progress', 'completed'].includes(p.status));
  const lockedLessons = progression.filter(p => p.status === 'locked');
  const currentLesson = courseState?.current_lesson_slug || null;
  const isTeacherControlled = progression.length > 0;

  /**
   * Check if a lesson is accessible to the student
   * If teacher progression exists, only released/in_progress/completed lessons are accessible
   * If no teacher progression exists, fall back to legacy unlock logic
   */
  const isLessonAccessible = useCallback((lessonSlug: string): boolean => {
    if (!isTeacherControlled) return true; // No teacher control yet, use legacy
    const entry = progression.find(p => p.lesson_slug === lessonSlug);
    return entry ? ['released', 'in_progress', 'completed'].includes(entry.status) : false;
  }, [progression, isTeacherControlled]);

  const getLessonStatus = useCallback((lessonSlug: string): LessonProgressionEntry['status'] => {
    if (!isTeacherControlled) return 'released'; // Legacy mode
    const entry = progression.find(p => p.lesson_slug === lessonSlug);
    return entry?.status || 'locked';
  }, [progression, isTeacherControlled]);

  return {
    progression,
    courseState,
    loading,
    releasedLessons,
    lockedLessons,
    currentLesson,
    isTeacherControlled,
    isLessonAccessible,
    getLessonStatus,
    reload,
  };
}
