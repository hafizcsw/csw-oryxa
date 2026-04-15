import { useCallback, useEffect, useState } from 'react';
import { portalInvoke } from '@/api/portalInvoke';

export interface TeacherPlan {
  id: string;
  student_user_id: string;
  teacher_type: 'language_teacher' | 'curriculum_exam_teacher';
  plan_type: 'weekly_plan' | 'monthly_plan' | 'intensive_plan' | 'exam_sprint_plan' | 'catch_up_plan' | 'custom_plan';
  status: 'active' | 'paused' | 'completed';
  title: string;
  target_lessons: string[];
  homework_payload: string[];
  checkpoint_payload: string[];
  ai_policy: Record<string, unknown>;
  start_date: string | null;
  end_date: string | null;
  delivered_sessions?: number;
}

export interface TeacherReviewItem {
  id: string;
  student_user_id: string | null;
  session_id: string | null;
  queue_type: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  recommended_next_action: string | null;
  status: 'open' | 'in_progress' | 'resolved';
  outreach_log: Array<{ at: string; note: string }>;
}

export interface TeacherExamMode {
  student_user_id: string;
  exam_target: string | null;
  exam_date: string | null;
  countdown_days: number | null;
  required_sessions_per_week: number;
  daily_target_sessions: number;
  emergency_catchup_enabled: boolean;
  mock_readiness_score: number | null;
  risk_flags: string[];
}

export interface TeacherAiFollowup {
  id: string;
  student_user_id: string;
  lesson_slug: string | null;
  recap_used: boolean;
  student_questions: string[];
  confusion_topics: string[];
  common_mistakes: string[];
  practice_completion: number | null;
  escalation_requested: boolean;
  created_at: string;
}

export function useTeacherPlans(studentUserId?: string) {
  const [plans, setPlans] = useState<TeacherPlan[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await portalInvoke<{ plans: TeacherPlan[] }>('teacher_list_plans', { student_user_id: studentUserId || null });
    if (res.ok && res.data) setPlans(res.data.plans || []);
    setLoading(false);
  }, [studentUserId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { plans, loading, refresh };
}

export async function createTeacherPlan(payload: Record<string, unknown>) {
  return portalInvoke<TeacherPlan>('teacher_create_plan', payload);
}

export async function upsertReviewItem(payload: Record<string, unknown>) {
  return portalInvoke<TeacherReviewItem>('teacher_upsert_review_item', payload);
}

export async function updateReviewItemStatus(payload: Record<string, unknown>) {
  return portalInvoke<TeacherReviewItem>('teacher_update_review_item_status', payload);
}

export function useTeacherReviewItems(studentUserId?: string) {
  const [items, setItems] = useState<TeacherReviewItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await portalInvoke<{ items: TeacherReviewItem[] }>('teacher_list_review_items', { student_user_id: studentUserId || null });
    if (res.ok && res.data) setItems(res.data.items || []);
    setLoading(false);
  }, [studentUserId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { items, loading, refresh };
}

export async function runTeacherCopilot(payload: Record<string, unknown>) {
  return portalInvoke<{ output: string; tasks: string[] }>('teacher_ai_copilot', payload);
}

export function useTeacherAiFollowups(studentUserId?: string) {
  const [rows, setRows] = useState<TeacherAiFollowup[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await portalInvoke<{ rows: TeacherAiFollowup[] }>('teacher_get_ai_followups', { student_user_id: studentUserId || null });
    if (res.ok && res.data) setRows(res.data.rows || []);
    setLoading(false);
  }, [studentUserId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { rows, loading, refresh };
}

export function useTeacherExamMode(studentUserId?: string) {
  const [mode, setMode] = useState<TeacherExamMode | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!studentUserId) {
      setMode(null);
      return;
    }
    setLoading(true);
    const res = await portalInvoke<TeacherExamMode>('teacher_get_exam_mode', { student_user_id: studentUserId });
    if (res.ok && res.data) setMode(res.data);
    setLoading(false);
  }, [studentUserId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { mode, loading, refresh };
}

export async function upsertTeacherExamMode(payload: Record<string, unknown>) {
  return portalInvoke<TeacherExamMode>('teacher_upsert_exam_mode', payload);
}
