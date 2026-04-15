/**
 * TeacherProgressionControls — Teacher controls for releasing/locking lessons
 * Used inside TeacherStudentWorkspace to manage student progression
 */
import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Lock, Unlock, Play, RotateCcw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LessonEntry {
  lesson_slug: string;
  module_slug: string | null;
  status: string;
  released_at: string | null;
  teacher_notes: string | null;
}

interface Props {
  studentUserId: string;
  courseKey?: string;
}

export function TeacherProgressionControls({ studentUserId, courseKey = 'russian' }: Props) {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<LessonEntry[]>([]);
  const [courseState, setCourseState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [progRes, stateRes] = await Promise.all([
        supabase
          .from('student_lesson_progression')
          .select('lesson_slug, module_slug, status, released_at, teacher_notes')
          .eq('student_user_id', studentUserId)
          .eq('course_key', courseKey)
          .order('released_at', { ascending: true, nullsFirst: false }),
        supabase
          .from('student_course_state')
          .select('*')
          .eq('student_user_id', studentUserId)
          .eq('course_key', courseKey)
          .maybeSingle(),
      ]);
      
      let progression = (progRes.data as any[]) || [];
      
      // If no teacher-released lessons, derive from student's own progress
      if (progression.length === 0) {
        const { data: selfProgress } = await supabase
          .from('learning_lesson_progress')
          .select('lesson_slug, module_slug, status, completed_at')
          .eq('user_id', studentUserId)
          .order('completed_at', { ascending: true, nullsFirst: false });
        
        if (selfProgress?.length) {
          progression = selfProgress.map((p: any) => ({
            lesson_slug: p.lesson_slug,
            module_slug: p.module_slug,
            status: p.status === 'completed' ? 'completed' : 'in_progress',
            released_at: p.completed_at,
            teacher_notes: null,
          }));
        }
      }
      
      setEntries(progression);
      setCourseState(stateRes.data);
    } catch (e) {
      console.error('[TeacherProgressionControls]', e);
    } finally {
      setLoading(false);
    }
  }, [studentUserId, courseKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const releaseLesson = async (lessonSlug: string, moduleSlug?: string) => {
    setActionLoading(lessonSlug);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase.from('student_lesson_progression').upsert({
        student_user_id: studentUserId,
        course_key: courseKey,
        lesson_slug: lessonSlug,
        module_slug: moduleSlug || null,
        status: 'released',
        released_by: session.user.id,
        released_at: new Date().toISOString(),
      } as any, { onConflict: 'student_user_id,course_key,lesson_slug' });

      // Update course state current lesson
      await supabase.from('student_course_state').upsert({
        student_user_id: studentUserId,
        course_key: courseKey,
        current_lesson_slug: lessonSlug,
        current_module_slug: moduleSlug || null,
        progression_status: 'active',
        last_teacher_action_at: new Date().toISOString(),
      } as any, { onConflict: 'student_user_id,course_key' });

      toast.success(t('staff.teacher.lessonReleased', { defaultValue: 'Lesson released' }));
      await loadData();
    } catch (e) {
      console.error('[releaseLesson]', e);
      toast.error(t('staff.teacher.actionFailed', { defaultValue: 'Action failed' }));
    } finally {
      setActionLoading(null);
    }
  };

  const holdLesson = async (lessonSlug: string) => {
    setActionLoading(lessonSlug);
    try {
      await supabase.from('student_lesson_progression').upsert({
        student_user_id: studentUserId,
        course_key: courseKey,
        lesson_slug: lessonSlug,
        status: 'locked',
      } as any, { onConflict: 'student_user_id,course_key,lesson_slug' });

      toast.success(t('staff.teacher.lessonLocked', { defaultValue: 'Lesson locked' }));
      await loadData();
    } catch (e) {
      console.error('[holdLesson]', e);
      toast.error(t('staff.teacher.actionFailed', { defaultValue: 'Action failed' }));
    } finally {
      setActionLoading(null);
    }
  };

  const setReviewRequired = async (lessonSlug: string) => {
    setActionLoading(lessonSlug);
    try {
      await supabase.from('student_lesson_progression').upsert({
        student_user_id: studentUserId,
        course_key: courseKey,
        lesson_slug: lessonSlug,
        status: 'review_required',
      } as any, { onConflict: 'student_user_id,course_key,lesson_slug' });

      toast.success(t('staff.teacher.reviewAssigned', { defaultValue: 'Review assigned' }));
      await loadData();
    } catch (e) {
      console.error('[setReviewRequired]', e);
      toast.error(t('staff.teacher.actionFailed', { defaultValue: 'Action failed' }));
    } finally {
      setActionLoading(null);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'released': return <Unlock className="w-3.5 h-3.5 text-emerald-500" />;
      case 'in_progress': return <Play className="w-3.5 h-3.5 text-blue-500" />;
      case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-primary" />;
      case 'review_required': return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
      default: return <Lock className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          {t('staff.teacher.progressionControl', { defaultValue: 'Lesson Progression' })}
        </h4>
        {courseState && (
          <span className="text-xs text-muted-foreground">
            {t('staff.teacher.currentLesson', { defaultValue: 'Current' })}: {courseState.current_lesson_slug || '-'}
          </span>
        )}
      </div>

      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t('staff.teacher.noProgressionYet', { defaultValue: 'No lessons released yet. Use the curriculum selector to release lessons.' })}
        </p>
      )}

      <div className="space-y-1.5">
        {entries.map((entry) => (
          <div key={entry.lesson_slug} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
            <div className="flex items-center gap-2 min-w-0">
              {statusIcon(entry.status)}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{entry.lesson_slug}</p>
                {entry.module_slug && <p className="text-xs text-muted-foreground">{entry.module_slug}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {entry.status === 'locked' && (
                <Button size="sm" variant="outline" onClick={() => releaseLesson(entry.lesson_slug, entry.module_slug || undefined)} disabled={actionLoading === entry.lesson_slug}>
                  {actionLoading === entry.lesson_slug ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                </Button>
              )}
              {['released', 'in_progress'].includes(entry.status) && (
                <>
                  <Button size="sm" variant="outline" onClick={() => holdLesson(entry.lesson_slug)} disabled={actionLoading === entry.lesson_slug}>
                    <Lock className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setReviewRequired(entry.lesson_slug)} disabled={actionLoading === entry.lesson_slug}>
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
              {entry.status === 'review_required' && (
                <Button size="sm" variant="outline" onClick={() => releaseLesson(entry.lesson_slug, entry.module_slug || undefined)} disabled={actionLoading === entry.lesson_slug}>
                  <Unlock className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
