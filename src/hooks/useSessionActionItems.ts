/**
 * useSessionActionItems — Shared lifecycle hooks for session action items.
 * Used by both teacher (to create/list) and student (to list/complete).
 */
import { useState, useEffect, useCallback } from 'react';
import { portalInvoke } from '@/api/portalInvoke';

export interface SessionActionItem {
  id: string;
  session_id: string;
  teacher_user_id: string;
  student_user_id: string;
  action_type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_at: string | null;
  completed_at: string | null;
  student_response: string | null;
  teacher_feedback: string | null;
  related_lesson_slug: string | null;
  related_module_slug: string | null;
  recap_available: boolean;
  created_at: string;
  updated_at: string;
}

// ===== Teacher hooks =====

export function useTeacherActionItems(studentUserId?: string, statusFilter?: string, sessionId?: string) {
  const [items, setItems] = useState<SessionActionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await portalInvoke<{ items: SessionActionItem[] }>('teacher_list_action_items', {
      student_user_id: studentUserId || null,
      status: statusFilter || null,
      session_id: sessionId || null,
    });
    if (res.ok && res.data) setItems(res.data.items || []);
    setLoading(false);
  }, [studentUserId, statusFilter, sessionId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { items, loading, refresh };
}

export async function createTeacherActionItems(items: Array<{
  session_id: string;
  student_user_id: string;
  action_type: string;
  title: string;
  description?: string;
  priority?: string;
  due_at?: string;
  related_lesson_slug?: string;
  related_module_slug?: string;
  recap_available?: boolean;
}>) {
  return portalInvoke<{ items: SessionActionItem[] }>('teacher_create_action_items', { items });
}

// ===== Student hooks =====

export function useStudentActionItems(statusFilter?: string) {
  const [items, setItems] = useState<SessionActionItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await portalInvoke<{ items: SessionActionItem[] }>('student_list_action_items', {
      status: statusFilter || null,
    });
    if (res.ok && res.data) setItems(res.data.items || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  return { items, loading, refresh };
}

export async function completeStudentActionItem(itemId: string, response?: string) {
  return portalInvoke<SessionActionItem>('student_complete_action_item', {
    item_id: itemId,
    response: response || null,
  });
}

export async function deleteStudentActionItem(itemId: string) {
  return portalInvoke('student_delete_action_item', { item_id: itemId });
}

export async function dismissStudentSession(sessionId: string) {
  return portalInvoke('student_dismiss_session', { session_id: sessionId });
}

export async function reviewTeacherActionItem(itemId: string, feedback: string, decision: 'pass' | 'revise' | 'reteach', score?: number | null) {
  return portalInvoke<SessionActionItem>('teacher_review_action_item', {
    item_id: itemId,
    feedback: feedback || null,
    decision,
    score: typeof score === 'number' ? score : null,
  });
}
