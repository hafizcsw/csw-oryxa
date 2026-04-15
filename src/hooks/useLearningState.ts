/**
 * useLearningState — Account-linked learning state hook
 * Syncs learning progress to Supabase for authenticated users
 * Falls back to localStorage for anonymous users
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeRussianPathInput, resolveRussianPath } from '@/lib/learningPathResolver';
import { persistPlacementResult, syncRussianLearnerState } from '@/lib/russianExecutionPackWriters';
import { portalInvoke } from '@/api/portalInvoke';
import type { ExamNotice } from '@/types/russianExecutionPack';
export type { ExamNotice } from '@/types/russianExecutionPack';

const ONBOARDING_KEY = 'languages_russian_onboarding';

// ═══ Module-level cache: survives unmount/remount across lesson navigations ═══
let cachedUserId: string | null = null;
let cachedEnrollment: LearningEnrollment | null = null;
let cachedLoadTimestamp = 0;
const LEARNING_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export interface LearningEnrollment {
  id: string;
  user_id: string;
  language: string;
  path_key: string;
  goal: string | null;
  timeline: string | null;
  level_mode: string | null;
  daily_minutes: number;
  placement_result: string | null;
  placement_score?: number | null;
  started_at: string;
}

export interface VocabItem {
  id: string;
  word_ru: string;
  word_meaning: string;
  transliteration: string | null;
  lesson_slug: string | null;
  module_slug: string | null;
  mastery: 'new' | 'learning' | 'familiar' | 'mastered';
  review_count: number;
  last_reviewed_at: string | null;
}

export interface AssignmentItem {
  id: string;
  source_item_id?: string;
  title: string;
  description: string | null;
  instructions: string | null;
  module_slug: string | null;
  lesson_slug: string | null;
  due_date: string | null;
  status: 'new' | 'in_progress' | 'submitted' | 'reviewed' | 'overdue';
  submission_text: string | null;
  submission_file_url: string | null;
  submission_notes: string | null;
  submitted_at: string | null;
  feedback: string | null;
  score: number | null;
  review_decision?: 'pass' | 'revise' | 'reteach' | null;
  created_at: string | null;
}

interface SessionActionAssignment {
  id: string;
  title: string;
  description: string | null;
  action_type: string;
  status: string;
  due_at: string | null;
  related_lesson_slug: string | null;
  related_module_slug: string | null;
  student_response: string | null;
  teacher_feedback: string | null;
  review_decision?: 'pass' | 'revise' | 'reteach' | null;
  score?: number | null;
  completed_at: string | null;
  created_at: string | null;
}

export interface StudyStats {
  totalMinutes: number;
  sessionsCount: number;
  weeklyMinutes: number;
  daysActive: number;
  weekLessons: number;
  weekSessions: number;
}

export function useLearningState() {
  const [userId, setUserId] = useState<string | null>(cachedUserId);
  const [enrollment, setEnrollment] = useState<LearningEnrollment | null>(cachedEnrollment);
  const [vocabItems, setVocabItems] = useState<VocabItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [examNotices, setExamNotices] = useState<ExamNotice[]>([]);
  const [studyStats, setStudyStats] = useState<StudyStats>({ totalMinutes: 0, sessionsCount: 0, weeklyMinutes: 0, daysActive: 0, weekLessons: 0, weekSessions: 0 });
  const [loading, setLoading] = useState(!cachedEnrollment);
  const sessionStartRef = useRef<number | null>(null);

  // Get auth user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id || null;
      cachedUserId = uid;
      setUserId(uid);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const uid = session?.user?.id || null;
      cachedUserId = uid;
      setUserId(uid);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load data when userId changes
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    // If cache is fresh, don't block — load in background
    const isCacheFresh = cachedEnrollment && cachedUserId === userId && (Date.now() - cachedLoadTimestamp) < LEARNING_CACHE_TTL_MS;
    if (isCacheFresh) {
      setEnrollment(cachedEnrollment);
      setLoading(false);
      // Background refresh
      loadAllData(userId, true);
    } else {
      loadAllData(userId, false);
    }
  }, [userId]);

  const loadAllData = async (uid: string, isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      // Load enrollment
      const { data: enrollData } = await supabase
        .from('learning_enrollments')
        .select('*')
        .eq('user_id', uid)
        .eq('language', 'russian')
        .maybeSingle();

      if (enrollData) {
        setEnrollment(enrollData as any);
        cachedEnrollment = enrollData as any;
        cachedLoadTimestamp = Date.now();

        // Load vocab
        const { data: vocabData } = await supabase
          .from('learning_vocab_progress')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });
        setVocabItems((vocabData as any[]) || []);

        // Load assignments from shared teacher session action items (canonical homework runtime)
        const assignmentsRes = await portalInvoke<{ items: SessionActionAssignment[] }>('student_list_action_items');
        const mappedAssignments: AssignmentItem[] = (assignmentsRes.ok ? assignmentsRes.data?.items || [] : []).map((item) => {
          const resolvedStatus: AssignmentItem['status'] =
            item.status === 'reviewed'
              ? 'reviewed'
              : item.status === 'completed'
                ? (item.teacher_feedback ? 'reviewed' : 'submitted')
                : 'new';
          return {
            id: item.id,
            source_item_id: item.id,
            title: item.title,
            description: item.description,
            instructions: item.action_type,
            module_slug: item.related_module_slug,
            lesson_slug: item.related_lesson_slug,
            due_date: item.due_at,
            status: resolvedStatus,
            submission_text: item.student_response,
            submission_file_url: null,
            submission_notes: null,
            submitted_at: item.completed_at,
            feedback: item.teacher_feedback,
            score: typeof item.score === 'number' ? item.score : null,
            review_decision: item.review_decision ?? null,
            created_at: item.created_at,
          };
        });
        setAssignments(mappedAssignments);

        // Load exam notices
        const { data: examData } = await supabase
          .from('learning_exam_notices')
          .select('*')
          .eq('user_id', uid)
          .order('scheduled_at', { ascending: true });
        setExamNotices((examData as any[]) || []);

        // Compute study stats
        const { data: sessionData } = await supabase
          .from('learning_study_sessions')
          .select('duration_seconds, created_at')
          .eq('user_id', uid);

        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

        if (sessionData && sessionData.length > 0) {
          const totalSecs = sessionData.reduce((s, r) => s + (r.duration_seconds || 0), 0);
          const weekSessions = sessionData.filter(r => r.created_at && r.created_at > weekAgo);
          const weekSecs = weekSessions.reduce((s, r) => s + (r.duration_seconds || 0), 0);
          const uniqueDays = new Set(sessionData.map(r => r.created_at?.substring(0, 10))).size;
          setStudyStats({
            totalMinutes: Math.round(totalSecs / 60),
            sessionsCount: sessionData.length,
            weeklyMinutes: Math.round(weekSecs / 60),
            daysActive: uniqueDays,
            weekLessons: weekSessions.filter(s => s.duration_seconds && s.duration_seconds > 30).length,
            weekSessions: weekSessions.length,
          });
        }

        // Check for overdue assignments
        const now = new Date().toISOString();
        const overdueIds: string[] = [];
        mappedAssignments.forEach((a) => {
          if (a.due_date && a.due_date < now && (a.status === 'new' || a.status === 'in_progress')) {
            overdueIds.push(a.id);
          }
        });
        if (overdueIds.length > 0) {
          // Update overdue status locally
          setAssignments(prev => prev.map(a =>
            overdueIds.includes(a.id) ? { ...a, status: 'overdue' as const } : a
          ));
        }
      }
    } catch (e) {
      console.error('[useLearningState] Error loading:', e);
    }
    setLoading(false);
  };

  // Ensure enrollment exists (called when starting plan)
  const ensureEnrollment = useCallback(async () => {
    if (!userId) return null;
    if (enrollment) return enrollment;

    try {
      const onboarding = localStorage.getItem(ONBOARDING_KEY);
      const parsed = onboarding ? JSON.parse(onboarding) : {};
      const normalized = normalizeRussianPathInput(parsed);
      const resolvedPath = normalized ? resolveRussianPath(normalized) : null;

      const { data, error } = await supabase
        .from('learning_enrollments')
        .upsert({
          user_id: userId,
          language: 'russian',
          path_key: resolvedPath?.pathKey || parsed.pathKey || 'russian_general',
          goal: normalized?.goal || parsed.goal || null,
          timeline: normalized?.timeline || parsed.timeline || null,
          level_mode: normalized?.level || parsed.level || null,
          daily_minutes: parseInt(normalized?.dailyMinutes || parsed.dailyMinutes) || 30,
          academic_track: normalized?.academicTrack || parsed.academicTrack || null,
          placement_result: normalized?.placementResult || parsed.placementResult || null,
          placement_score: normalized?.placementScore ?? parsed.placementScore ?? null,
        }, { onConflict: 'user_id,language' })
        .select()
        .single();

      if (data) {
        setEnrollment(data as any);
        return data;
      }
      if (error) console.error('[ensureEnrollment]', error);
    } catch (e) {
      console.error('[ensureEnrollment]', e);
    }
    return null;
  }, [userId, enrollment]);

  // Sync lesson completion to DB
  const syncLessonComplete = useCallback(async (lessonSlug: string, moduleSlug: string) => {
    if (!userId) return;
    const enr = enrollment || await ensureEnrollment();
    try {
      await supabase.from('learning_lesson_progress').upsert({
        user_id: userId,
        enrollment_id: enr?.id,
        lesson_slug: lessonSlug,
        module_slug: moduleSlug,
        status: 'completed',
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,lesson_slug' });

      await syncRussianLearnerState(userId);
    } catch (e) {
      console.error('[syncLessonComplete]', e);
    }
  }, [userId, enrollment, ensureEnrollment]);

  // Track study session start
  const startStudySession = useCallback(() => {
    sessionStartRef.current = Date.now();
  }, []);

  // Track study session end
  const endStudySession = useCallback(async (lessonSlug?: string, moduleSlug?: string) => {
    if (!userId || !sessionStartRef.current) return;
    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000);
    sessionStartRef.current = null;
    if (duration < 5) return;

    try {
      await supabase.from('learning_study_sessions').insert({
        user_id: userId,
        enrollment_id: enrollment?.id,
        lesson_slug: lessonSlug,
        module_slug: moduleSlug,
        event_type: 'lesson_study',
        duration_seconds: Math.min(duration, 3600),
      });
      setStudyStats(prev => ({
        ...prev,
        totalMinutes: prev.totalMinutes + Math.round(duration / 60),
        sessionsCount: prev.sessionsCount + 1,
      }));
    } catch (e) {
      console.error('[endStudySession]', e);
    }
  }, [userId, enrollment]);

  // Add vocab word
  const addVocabWord = useCallback(async (wordRu: string, meaning: string, transliteration: string | null, lessonSlug: string, moduleSlug: string) => {
    if (!userId) return;
    try {
      const { data } = await supabase.from('learning_vocab_progress').upsert({
        user_id: userId,
        word_ru: wordRu,
        word_meaning: meaning,
        transliteration,
        lesson_slug: lessonSlug,
        module_slug: moduleSlug,
        mastery: 'new',
      }, { onConflict: 'user_id,word_ru' }).select().single();
      if (data) {
        setVocabItems(prev => {
          const existing = prev.findIndex(v => v.word_ru === wordRu);
          if (existing >= 0) return prev;
          return [data as any, ...prev];
        });
      }
    } catch (e) {
      console.error('[addVocabWord]', e);
    }
  }, [userId]);

  // Update vocab mastery
  const updateVocabMastery = useCallback(async (wordRu: string, mastery: VocabItem['mastery']) => {
    if (!userId) return;
    try {
      await supabase.from('learning_vocab_progress')
        .update({ mastery, review_count: (vocabItems.find(v => v.word_ru === wordRu)?.review_count ?? 0) + 1, last_reviewed_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('word_ru', wordRu);
      setVocabItems(prev => prev.map(v => v.word_ru === wordRu ? { ...v, mastery, review_count: (v.review_count || 0) + 1, last_reviewed_at: new Date().toISOString() } : v));
    } catch (e) {
      console.error('[updateVocabMastery]', e);
    }
  }, [userId, vocabItems]);

  // Submit assignment
  const submitAssignment = useCallback(async (assignmentId: string, text: string | null, notes: string | null) => {
    if (!userId) return false;
    try {
      const res = await portalInvoke('student_complete_action_item', {
        item_id: assignmentId,
        response: [text, notes].filter(Boolean).join('\n\n').trim() || null,
      });
      if (res.ok) {
        setAssignments(prev => prev.map(a =>
          a.id === assignmentId ? { ...a, status: 'submitted' as const, submission_text: text, submission_notes: notes, submitted_at: new Date().toISOString() } : a
        ));
        return true;
      }
    } catch (e) {
      console.error('[submitAssignment]', e);
    }
    return false;
  }, [userId]);

  // Update assignment status to in_progress
  const startAssignment = useCallback(async (assignmentId: string) => {
    if (!userId) return;
    try {
      setAssignments(prev => prev.map(a =>
        a.id === assignmentId && a.status === 'new' ? { ...a, status: 'in_progress' as const } : a
      ));
    } catch (e) {
      console.error('[startAssignment]', e);
    }
  }, [userId]);

  // Save placement result
  const savePlacementResult = useCallback(async (score: number, totalQuestions: number, resultCategory: string, answers: any, resultPayload?: Record<string, unknown> | null) => {
    if (!userId) return;
    try {
      await supabase.from('learning_placement_results').upsert({
        user_id: userId,
        language: 'russian',
        score,
        total_questions: totalQuestions,
        result_category: resultCategory,
        answers,
        result_payload: resultPayload ?? null,
      } as any, { onConflict: 'user_id,language' });

      await persistPlacementResult(userId, score, totalQuestions, resultCategory, answers, resultPayload as any);

      if (enrollment) {
        await supabase.from('learning_enrollments')
          .update({ placement_result: resultCategory, placement_score: score })
          .eq('id', enrollment.id);
        setEnrollment(prev => prev ? { ...prev, placement_result: resultCategory, placement_score: score } : prev);
      }
    } catch (e) {
      console.error('[savePlacementResult]', e);
    }
  }, [userId, enrollment]);

  return {
    userId,
    enrollment,
    vocabItems,
    assignments,
    examNotices,
    studyStats,
    loading,
    ensureEnrollment,
    syncLessonComplete,
    startStudySession,
    endStudySession,
    addVocabWord,
    updateVocabMastery,
    submitAssignment,
    startAssignment,
    savePlacementResult,
    reload: () => userId && loadAllData(userId),
  };
}
