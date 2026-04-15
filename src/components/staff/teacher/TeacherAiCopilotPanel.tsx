import { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { runTeacherCopilot } from '@/hooks/useTeacherOps';
import type { TeacherSession } from '@/hooks/useTeacherSessions';
import { BookOpen, User, Calendar, AlertTriangle } from 'lucide-react';

interface Props {
  studentUserId: string;
  studentName?: string | null;
  lessonSlug?: string | null;
  sessionId?: string | null;
  teacherType: 'language_teacher' | 'curriculum_exam_teacher';
  sessions?: TeacherSession[];
  examUrgency?: boolean;
}

const ACTIONS = [
  'summarize_student_state',
  'propose_weekly_plan',
  'generate_homework',
  'generate_oral_written_drills',
  'summarize_recurring_mistakes',
  'propose_next_lesson_focus',
  'produce_exam_cram_plan',
  'session_outcome_to_followups',
] as const;

export function TeacherAiCopilotPanel({
  studentUserId,
  studentName,
  lessonSlug,
  sessionId,
  teacherType,
  sessions = [],
  examUrgency = false,
}: Props) {
  const { t } = useLanguage();
  const [action, setAction] = useState<(typeof ACTIONS)[number]>('summarize_student_state');
  const [output, setOutput] = useState('');
  const [tasks, setTasks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Derive context from sessions for this student
  const ctx = useMemo(() => {
    const studentSessions = sessions.filter(
      (s) => s.students?.some((st) => st?.student_user_id === studentUserId)
    );
    const latest = studentSessions
      .filter((s) => s.status === 'completed')
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
    const upcoming = studentSessions
      .filter((s) => s.status === 'scheduled' && s.scheduled_at)
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())[0];
    const effectiveLesson = lessonSlug || latest?.lesson_slug || upcoming?.lesson_slug || null;
    const effectiveSession = sessionId || latest?.id || null;
    return { latest, upcoming, effectiveLesson, effectiveSession };
  }, [sessions, studentUserId, lessonSlug, sessionId]);

  const run = async () => {
    setLoading(true);
    const res = await runTeacherCopilot({
      action,
      student_user_id: studentUserId,
      lesson_slug: ctx.effectiveLesson,
      session_id: ctx.effectiveSession,
      teacher_type: teacherType,
    });
    if (res.ok && res.data) {
      setOutput(res.data.output || '');
      setTasks(res.data.tasks || []);
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('staff.teacher.ai.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Context strip */}
        <div className="rounded-md border bg-muted/50 p-3 space-y-1 text-sm">
          <p className="font-medium text-muted-foreground">{t('staff.teacher.ai.context')}</p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {studentName || studentUserId.slice(0, 8)}
            </span>
            {ctx.effectiveLesson && (
              <Badge variant="outline" className="gap-1">
                <BookOpen className="h-3 w-3" />
                {ctx.effectiveLesson}
              </Badge>
            )}
            {ctx.upcoming?.scheduled_at && (
              <Badge variant="outline" className="gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(ctx.upcoming.scheduled_at).toLocaleDateString()}
              </Badge>
            )}
            {examUrgency && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t('staff.teacher.ai.examUrgent')}
              </Badge>
            )}
          </div>
          {ctx.latest?.summary && (
            <p className="text-xs text-muted-foreground mt-1">
              {t('staff.teacher.ai.lastSessionSummary')}: {ctx.latest.summary.slice(0, 120)}
              {ctx.latest.summary.length > 120 ? '…' : ''}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((item) => (
            <Button key={item} size="sm" variant={item === action ? 'default' : 'outline'} onClick={() => setAction(item)}>
              {t(`staff.teacher.ai.action.${item}`)}
            </Button>
          ))}
        </div>
        <Button onClick={run} disabled={loading}>{t('staff.teacher.ai.run')}</Button>
        <Textarea value={output} readOnly rows={6} placeholder={t('staff.teacher.ai.output_placeholder')} />
        <div className="flex flex-wrap gap-1">
          {tasks.map((task) => <Badge key={task} variant="secondary">{task}</Badge>)}
        </div>
      </CardContent>
    </Card>
  );
}
