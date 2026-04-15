/**
 * TeacherSessionDetail — Full session operating surface with status lifecycle,
 * attendance, evaluations, outcomes, edit-draft, and lesson context.
 */
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  useTeacherSessionDetail,
  updateSession,
  updateAttendance,
  saveSessionOutcome,
  saveStudentEvaluation,
  getSessionEvaluations,
  deleteSession,
} from '@/hooks/useTeacherSessions';
import type { SessionEvaluation } from '@/hooks/useTeacherSessions';
import { createTeacherActionItems, reviewTeacherActionItem, useTeacherActionItems } from '@/hooks/useSessionActionItems';
import { PageLoader } from '@/components/ui/PageLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { TeacherLessonContext } from '@/components/staff/teacher/TeacherLessonContext';
import { TeacherCurriculumSelector } from '@/components/staff/teacher/TeacherCurriculumSelector';
import type { TeacherPermissions } from '@/lib/teacherPermissions';
import {
  ArrowLeft, Video, BookOpen, ClipboardCheck, Users, Save,
  CheckCircle2, XCircle, Clock, AlertTriangle, Calendar,
  Edit, Play, Square, Ban, ChevronRight, Send, Trash2
} from 'lucide-react';

const ATTENDANCE_OPTIONS = ['attended', 'absent', 'late', 'partial'] as const;
const STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['live', 'cancelled'],
  live: ['completed'],
  completed: [],
  cancelled: ['draft'],
};
const NEXT_ACTIONS = ['continue', 'review_current_lesson', 'repeat_before_next', 'homework_assigned', 'checkpoint_ready'] as const;

interface Props {
  sessionId: string;
  permissions: TeacherPermissions;
  onBack: () => void;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'draft': return <Edit className="h-4 w-4" />;
    case 'scheduled': return <Calendar className="h-4 w-4" />;
    case 'live': return <Play className="h-4 w-4" />;
    case 'completed': return <CheckCircle2 className="h-4 w-4" />;
    case 'cancelled': return <Ban className="h-4 w-4" />;
    default: return <Clock className="h-4 w-4" />;
  }
}

function AttendanceIcon({ status }: { status: string }) {
  switch (status) {
    case 'attended': return <CheckCircle2 className="h-4 w-4 text-primary" />;
    case 'absent': return <XCircle className="h-4 w-4 text-destructive" />;
    case 'late': return <Clock className="h-4 w-4 text-accent-foreground" />;
    case 'partial': return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
    default: return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

export function TeacherSessionDetailView({ sessionId, permissions, onBack }: Props) {
  const { t } = useLanguage();
  const { session, loading, error, refresh } = useTeacherSessionDetail(sessionId);
  const [zoomLink, setZoomLink] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [moduleSlug, setModuleSlug] = useState('');
  const [lessonSlug, setLessonSlug] = useState('');
  const [sessionType, setSessionType] = useState('');
  const [teacherType, setTeacherType] = useState<'language_teacher' | 'curriculum_exam_teacher'>('language_teacher');
  const [summary, setSummary] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [saving, setSaving] = useState(false);
  const [evaluations, setEvaluations] = useState<Record<string, Partial<SessionEvaluation>>>({});
  const [showLesson, setShowLesson] = useState(false);
  const [editMode, setEditMode] = useState(false);
  // Expanded outcome fields
  const [homeworkTitle, setHomeworkTitle] = useState('');
  const [homeworkDesc, setHomeworkDesc] = useState('');
  const [actionType, setActionType] = useState('homework');
  const [actionPriority, setActionPriority] = useState('normal');
  const [recapAvailable, setRecapAvailable] = useState(false);
  const [reviewFeedbackByItem, setReviewFeedbackByItem] = useState<Record<string, string>>({});
  const [reviewDecisionByItem, setReviewDecisionByItem] = useState<Record<string, 'pass' | 'revise' | 'reteach'>>({});
  const [reviewScoreByItem, setReviewScoreByItem] = useState<Record<string, string>>({});
  const { items: actionItems, refresh: refreshActionItems } = useTeacherActionItems(undefined, undefined, sessionId);

  useEffect(() => {
    if (session) {
      setZoomLink(session.zoom_link || '');
      setSummary(session.summary || '');
      setNextAction(session.next_action || '');
      setModuleSlug(session.module_slug || '');
      setLessonSlug(session.lesson_slug || '');
      setSessionType(session.session_type || 'lesson_delivery');
      setTeacherType(session.teacher_type || 'language_teacher');
      if (session.scheduled_at) {
        const d = new Date(session.scheduled_at);
        setScheduledDate(d.toISOString().slice(0, 10));
        setScheduledTime(d.toISOString().slice(11, 16));
      } else {
        setScheduledDate('');
        setScheduledTime('');
      }
    }
  }, [session]);

  useEffect(() => {
    if (sessionId) {
      getSessionEvaluations(sessionId).then(res => {
        if (res.ok && res.data) {
          const map: Record<string, Partial<SessionEvaluation>> = {};
          for (const ev of res.data.evaluations) {
            map[ev.student_user_id] = ev;
          }
          setEvaluations(map);
        }
      });
    }
  }, [sessionId]);

  if (loading) return <PageLoader />;
  if (error || !session) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error || t('staff.teacher.session.load_error', { defaultValue: 'Failed to load session' })}</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 me-2" />
          {t('common.back', { defaultValue: 'Back' })}
        </Button>
      </div>
    );
  }

  const isDraft = session.status === 'draft';
  const isEditable = isDraft || editMode;
  const allowedTransitions = STATUS_TRANSITIONS[session.status] || [];
  const students = session.students || [];

  const handleStatusUpdate = async (newStatus: string) => {
    setSaving(true);
    const res = await updateSession({ session_id: sessionId, status: newStatus });
    if (res.ok) {
      toast({ title: t('staff.teacher.session.status_updated', { defaultValue: 'Status updated' }) });
      refresh();
    } else {
      toast({ title: t('staff.teacher.session.update_error', { defaultValue: 'Update failed' }), variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    const scheduledAt = scheduledDate && scheduledTime
      ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      : null;
    const res = await updateSession({
      session_id: sessionId,
      zoom_link: zoomLink || undefined,
      module_slug: moduleSlug || null,
      lesson_slug: lessonSlug || null,
      session_type: sessionType,
      teacher_type: teacherType,
      scheduled_at: scheduledAt,
    });
    if (res.ok) {
      toast({ title: t('staff.teacher.session.details_saved', { defaultValue: 'Details saved' }) });
      setEditMode(false);
      refresh();
    }
    setSaving(false);
  };

  const handleAttendance = async (studentUserId: string, status: string) => {
    const res = await updateAttendance(sessionId, studentUserId, status);
    if (res.ok) refresh();
  };

  const handleSaveOutcome = async () => {
    setSaving(true);
    const outcomeItems = homeworkTitle.trim()
      ? students.map((s) => ({
          student_user_id: s.student_user_id,
          action_type: actionType,
          title: homeworkTitle.trim(),
          description: homeworkDesc.trim() || undefined,
          priority: actionPriority,
          related_lesson_slug: session.lesson_slug || undefined,
          related_module_slug: session.module_slug || undefined,
          recap_available: recapAvailable,
        }))
      : [];
    const res = await saveSessionOutcome({ session_id: sessionId, summary, next_action: nextAction, action_items: outcomeItems });
    if (res.ok) {
      toast({ title: t('staff.teacher.session.outcome_saved', { defaultValue: 'Outcome saved' }) });
      if (outcomeItems.length) {
        setHomeworkTitle('');
        setHomeworkDesc('');
      }
      refresh();
      refreshActionItems();
    }
    setSaving(false);
  };

  const handleSaveEvaluation = async (studentUserId: string) => {
    const ev = evaluations[studentUserId];
    if (!ev) return;
    setSaving(true);
    const res = await saveStudentEvaluation({
      session_id: sessionId,
      student_user_id: studentUserId,
      participation_score: ev.participation_score ?? undefined,
      understanding_score: ev.understanding_score ?? undefined,
      confidence_score: ev.confidence_score ?? undefined,
      needs_review: ev.needs_review ?? false,
      recommended_next_action: ev.recommended_next_action ?? undefined,
      note: ev.note ?? undefined,
    });
    if (res.ok) toast({ title: t('staff.teacher.session.eval_saved', { defaultValue: 'Evaluation saved' }) });
    setSaving(false);
  };

  const updateEval = (studentUserId: string, field: string, value: string | number | boolean) => {
    setEvaluations(prev => ({
      ...prev,
      [studentUserId]: { ...prev[studentUserId], [field]: value },
    }));
  };

  if (showLesson && session.lesson_slug) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setShowLesson(false)}>
          <ArrowLeft className="h-4 w-4 me-2" />
          {t('staff.teacher.session.back_to_session', { defaultValue: 'Back to session' })}
        </Button>
        <TeacherLessonContext
          studentName={t('staff.teacher.session.session_lesson', { defaultValue: 'Session' })}
          lessonSlug={session.lesson_slug}
          moduleSlug={session.module_slug || ''}
          permissions={permissions}
          onClose={() => setShowLesson(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-0.5">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold">
              {t(`staff.teacher.session.type_${session.session_type}`, { defaultValue: session.session_type.replace(/_/g, ' ') })}
            </h2>
            <Badge
              variant={
                session.status === 'completed' ? 'default' :
                session.status === 'live' ? 'destructive' :
                session.status === 'cancelled' ? 'outline' :
                'secondary'
              }
              className="text-xs"
            >
              <StatusIcon status={session.status} />
              <span className="ms-1">{t(`staff.teacher.session.status_${session.status}`, { defaultValue: session.status })}</span>
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
            <Badge variant="outline">{t(`staff.teacher.type.${session.teacher_type || 'language_teacher'}`, { defaultValue: session.teacher_type || 'language_teacher' })}</Badge>
            {session.module_slug && <span>{session.module_slug}</span>}
            {session.lesson_slug && <span>/ {session.lesson_slug}</span>}
            {session.scheduled_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(session.scheduled_at).toLocaleString()}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {students.length} {t('staff.teacher.session.students_label', { defaultValue: 'students' })}
            </span>
          </div>
        </div>

        {/* Status transition + Delete buttons */}
        <div className="flex gap-2 shrink-0">
          {allowedTransitions.map(s => (
            <Button key={s} variant="outline" size="sm" disabled={saving} onClick={() => handleStatusUpdate(s)}>
              <StatusIcon status={s} />
              <span className="ms-1.5">{t(`staff.teacher.session.status_${s}`, { defaultValue: s })}</span>
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={async () => {
              if (!window.confirm(t('staff.teacher.session.delete_confirm', { defaultValue: 'Are you sure you want to delete this session?' }))) return;
              setSaving(true);
              const res = await deleteSession(sessionId);
              if (res.ok) {
                toast({ title: t('staff.teacher.session.deleted', { defaultValue: 'Session deleted' }) });
                onBack();
              } else {
                toast({ title: res.error || 'Delete failed', variant: 'destructive' });
              }
              setSaving(false);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            {t('staff.teacher.session.tab_overview', { defaultValue: 'Overview' })}
          </TabsTrigger>
          <TabsTrigger value="attendance" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <ClipboardCheck className="h-3.5 w-3.5 me-1.5" />
            {t('staff.teacher.session.tab_attendance', { defaultValue: 'Attendance' })}
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            {t('staff.teacher.session.tab_evaluations', { defaultValue: 'Evaluations' })}
          </TabsTrigger>
          <TabsTrigger value="outcome" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            {t('staff.teacher.session.tab_outcome', { defaultValue: 'Outcome' })}
          </TabsTrigger>
        </TabsList>

        {/* ===== Overview Tab ===== */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Session Details Card — editable in draft or edit mode */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {t('staff.teacher.session.details_title', { defaultValue: 'Session Details' })}
                </CardTitle>
                {!isDraft && !editMode && (
                  <Button variant="ghost" size="sm" onClick={() => setEditMode(true)}>
                    <Edit className="h-4 w-4 me-1.5" />
                    {t('staff.teacher.session.edit', { defaultValue: 'Edit' })}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditable ? (
                <>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('staff.teacher.session.teacher_type', { defaultValue: 'Teacher Type' })}</label>
                    <Select value={teacherType} onValueChange={(value) => setTeacherType(value as 'language_teacher' | 'curriculum_exam_teacher')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="language_teacher">{t('staff.teacher.type.language_teacher', { defaultValue: 'Language Teacher' })}</SelectItem>
                        <SelectItem value="curriculum_exam_teacher">{t('staff.teacher.type.curriculum_exam_teacher', { defaultValue: 'Curriculum/Exam Teacher' })}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('staff.teacher.session.type_label', { defaultValue: 'Session Type' })}</label>
                    <Select value={sessionType} onValueChange={setSessionType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['lesson_delivery', 'review', 'reinforcement', 'checkpoint_prep'].map(type => (
                          <SelectItem key={type} value={type}>
                            {t(`staff.teacher.session.type_${type}`, { defaultValue: type.replace(/_/g, ' ') })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <TeacherCurriculumSelector
                    moduleSlug={moduleSlug}
                    lessonSlug={lessonSlug}
                    onModuleChange={(value) => {
                      setModuleSlug(value);
                      setLessonSlug('');
                    }}
                    onLessonChange={setLessonSlug}
                  />

                  <Separator />

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {t('staff.teacher.session.schedule_label', { defaultValue: 'Schedule' })}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                      <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Video className="h-3.5 w-3.5" />
                      {t('staff.teacher.session.zoom_label', { defaultValue: 'Zoom Link' })}
                    </label>
                    <Input value={zoomLink} onChange={e => setZoomLink(e.target.value)} placeholder="https://zoom.us/j/..." />
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveDetails} disabled={saving}>
                      <Save className="h-4 w-4 me-1.5" />
                      {t('staff.teacher.session.save', { defaultValue: 'Save' })}
                    </Button>
                    {editMode && (
                      <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>
                        {t('staff.teacher.session.cancel', { defaultValue: 'Cancel' })}
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <DetailRow
                    label={t('staff.teacher.session.type_label', { defaultValue: 'Type' })}
                    value={t(`staff.teacher.session.type_${session.session_type}`, { defaultValue: session.session_type.replace(/_/g, ' ') })}
                  />
                  <DetailRow
                    label={t('staff.teacher.session.module_label', { defaultValue: 'Module' })}
                    value={session.module_slug || '—'}
                  />
                  <DetailRow
                    label={t('staff.teacher.session.lesson_label', { defaultValue: 'Lesson' })}
                    value={session.lesson_slug || '—'}
                  />
                  <DetailRow
                    label={t('staff.teacher.session.schedule_label', { defaultValue: 'Schedule' })}
                    value={session.scheduled_at ? new Date(session.scheduled_at).toLocaleString() : '—'}
                  />
                  {session.zoom_link && (
                    <DetailRow
                      label={t('staff.teacher.session.zoom_label', { defaultValue: 'Zoom' })}
                      value={
                        <a href={session.zoom_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                          <Video className="h-3.5 w-3.5" />
                          {t('staff.teacher.session.join_zoom', { defaultValue: 'Join meeting' })}
                        </a>
                      }
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lesson Context shortcut */}
          {session.lesson_slug && permissions.can('can_open_lesson_context') && (
            <Card className="border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => setShowLesson(true)}>
              <CardContent className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium text-sm">{t('staff.teacher.lesson_context', { defaultValue: 'Lesson Context' })}</p>
                    <p className="text-xs text-muted-foreground">{session.module_slug} / {session.lesson_slug}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          )}

          {/* Students list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t('staff.teacher.session.students_label', { defaultValue: 'Students' })}
                <Badge variant="secondary" className="text-xs">{students.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t('staff.teacher.no_students', { defaultValue: 'No students' })}
                </p>
              ) : (
                <div className="space-y-2">
                  {students.map(s => (
                    <div key={s.student_user_id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="text-sm font-medium">{s.full_name || s.email || s.student_user_id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.current_module && s.current_lesson ? `${s.current_module} / ${s.current_lesson}` : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <AttendanceIcon status={s.attendance_status} />
                        <Badge variant="outline" className="text-xs">
                          {t(`staff.teacher.session.attendance_${s.attendance_status}`, { defaultValue: s.attendance_status || 'pending' })}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Attendance Tab ===== */}
        <TabsContent value="attendance" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                {t('staff.teacher.session.mark_attendance', { defaultValue: 'Mark Attendance' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {students.map(s => (
                <div key={s.student_user_id} className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/30 transition-colors border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <AttendanceIcon status={s.attendance_status} />
                    <p className="text-sm font-medium">{s.full_name || s.student_user_id.slice(0, 8)}</p>
                  </div>
                  <RadioGroup
                    value={s.attendance_status || 'pending'}
                    onValueChange={(v) => handleAttendance(s.student_user_id, v)}
                    className="flex gap-3"
                  >
                    {ATTENDANCE_OPTIONS.map(opt => (
                      <div key={opt} className="flex items-center gap-1.5">
                        <RadioGroupItem value={opt} id={`att-${s.student_user_id}-${opt}`} />
                        <Label htmlFor={`att-${s.student_user_id}-${opt}`} className="text-xs cursor-pointer">
                          {t(`staff.teacher.session.attendance_${opt}`, { defaultValue: opt })}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Evaluations Tab ===== */}
        <TabsContent value="evaluations" className="space-y-4 mt-4">
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('staff.teacher.no_students', { defaultValue: 'No students' })}
            </p>
          ) : (
            students.map(s => {
              const ev = evaluations[s.student_user_id] || {};
              return (
                <Card key={s.student_user_id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {s.full_name || s.student_user_id.slice(0, 8)}
                      {ev.needs_review && (
                        <Badge variant="destructive" className="text-xs">
                          {t('staff.teacher.session.needs_review', { defaultValue: 'Needs review' })}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      {(['participation_score', 'understanding_score', 'confidence_score'] as const).map(field => (
                        <div key={field} className="space-y-1">
                          <Label className="text-xs">{t(`staff.teacher.session.eval_${field}`, { defaultValue: field.replace(/_/g, ' ') })}</Label>
                          <Select
                            value={String(ev[field] ?? '')}
                            onValueChange={v => updateEval(s.student_user_id, field, v ? Number(v) : null)}
                          >
                            <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5].map(n => (
                                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={ev.needs_review ?? false}
                        onCheckedChange={v => updateEval(s.student_user_id, 'needs_review', v)}
                      />
                      <Label className="text-sm">{t('staff.teacher.session.needs_review', { defaultValue: 'Needs review' })}</Label>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">{t('staff.teacher.session.next_action_label', { defaultValue: 'Recommended Next Action' })}</Label>
                      <Select
                        value={ev.recommended_next_action || ''}
                        onValueChange={v => updateEval(s.student_user_id, 'recommended_next_action', v)}
                      >
                        <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {NEXT_ACTIONS.map(a => (
                            <SelectItem key={a} value={a}>
                              {t(`staff.teacher.session.action_${a}`, { defaultValue: a.replace(/_/g, ' ') })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      value={ev.note || ''}
                      onChange={e => updateEval(s.student_user_id, 'note', e.target.value)}
                      placeholder={t('staff.teacher.session.eval_note_placeholder', { defaultValue: 'Teacher note...' })}
                      rows={2}
                    />
                    <Button size="sm" onClick={() => handleSaveEvaluation(s.student_user_id)} disabled={saving}>
                      <Save className="h-3 w-3 me-1" />
                      {t('staff.teacher.session.save_eval', { defaultValue: 'Save Evaluation' })}
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ===== Outcome Tab ===== */}
        <TabsContent value="outcome" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {t('staff.teacher.session.outcome_title', { defaultValue: 'Session Outcome' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('staff.teacher.session.summary_label', { defaultValue: 'Summary' })}</Label>
                <Textarea
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  rows={4}
                  placeholder={t('staff.teacher.session.summary_placeholder', { defaultValue: 'What was covered in this session...' })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('staff.teacher.session.next_action_label', { defaultValue: 'Next Action / Follow-up' })}</Label>
                <Select value={nextAction} onValueChange={setNextAction}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {NEXT_ACTIONS.map(a => (
                      <SelectItem key={a} value={a}>
                        {t(`staff.teacher.session.action_${a}`, { defaultValue: a.replace(/_/g, ' ') })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={recapAvailable} onCheckedChange={(v) => setRecapAvailable(v === true)} />
                <Label className="text-sm">{t('staff.teacher.session.recap_available', { defaultValue: 'AI Recap available for students' })}</Label>
              </div>
              <Button onClick={handleSaveOutcome} disabled={saving || !summary.trim()}>
                <Save className="h-4 w-4 me-2" />
                {t('staff.teacher.session.save_outcome', { defaultValue: 'Save Outcome' })}
              </Button>
            </CardContent>
          </Card>

          {/* Assign action items to students */}
          {students.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t('staff.teacher.session.assign_actions', { defaultValue: 'Assign Student Actions' })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('staff.teacher.session.action_type_label', { defaultValue: 'Action Type' })}</Label>
                    <Select value={actionType} onValueChange={setActionType}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['homework', 'review', 'checkpoint', 'session_recovery', 'exam_recovery', 'teacher_follow_up'].map(at => (
                          <SelectItem key={at} value={at}>
                            {t(`staff.teacher.session.action_type_${at}`, { defaultValue: at.replace(/_/g, ' ') })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('staff.teacher.session.action_priority_label', { defaultValue: 'Priority' })}</Label>
                    <Select value={actionPriority} onValueChange={setActionPriority}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['normal', 'high', 'urgent'].map(p => (
                          <SelectItem key={p} value={p}>{t(`staff.teacher.session.priority_${p}`, { defaultValue: p })}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('staff.teacher.session.action_title_label', { defaultValue: 'Task Title' })}</Label>
                  <Input value={homeworkTitle} onChange={e => setHomeworkTitle(e.target.value)} placeholder={t('staff.teacher.session.action_title_placeholder', { defaultValue: 'e.g. Complete exercises 1-5' })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('staff.teacher.session.action_desc_label', { defaultValue: 'Task Description' })}</Label>
                  <Textarea value={homeworkDesc} onChange={e => setHomeworkDesc(e.target.value)} rows={2} placeholder={t('staff.teacher.session.action_desc_placeholder', { defaultValue: 'Detailed instructions...' })} />
                </div>
                <Button
                  size="sm"
                  disabled={saving || !homeworkTitle.trim()}
                  onClick={async () => {
                    setSaving(true);
                    const actionItems = students.map(s => ({
                      session_id: sessionId,
                      student_user_id: s.student_user_id,
                      action_type: actionType,
                      title: homeworkTitle.trim(),
                      description: homeworkDesc.trim() || undefined,
                      priority: actionPriority,
                      related_lesson_slug: session.lesson_slug || undefined,
                      related_module_slug: session.module_slug || undefined,
                      recap_available: recapAvailable,
                    }));
                    const res = await createTeacherActionItems(actionItems);
                    if (res.ok) {
                      toast({ title: t('staff.teacher.session.actions_assigned', { defaultValue: 'Actions assigned to students' }) });
                      setHomeworkTitle('');
                      setHomeworkDesc('');
                      refreshActionItems();
                    } else {
                      toast({ title: t('staff.teacher.session.actions_error', { defaultValue: 'Failed to assign actions' }), variant: 'destructive' });
                    }
                    setSaving(false);
                  }}
                >
                  <Send className="h-3.5 w-3.5 me-1.5" />
                  {t('staff.teacher.session.assign_to_all', { defaultValue: 'Assign to all students' })}
                </Button>
              </CardContent>
            </Card>
          )}
          {actionItems.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {t('staff.teacher.session.actions_progress')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {actionItems.map((item) => {
                  const studentName = students.find((s) => s.student_user_id === item.student_user_id)?.full_name || item.student_user_id.slice(0, 8);
                  return (
                    <div key={item.id} className="rounded-md border border-border p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <Badge variant={item.status === 'completed' ? 'default' : 'outline'} className="text-xs">
                          {t(`languages.dashboard.actions.status_${item.status}`)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{studentName}</p>
                      {item.student_response && (
                        <p className="text-xs text-foreground">{item.student_response}</p>
                      )}
                      {item.teacher_feedback && (
                        <p className="text-xs text-primary">{item.teacher_feedback}</p>
                      )}
                      {item.status === 'completed' && (
                        <div className="space-y-2 pt-1.5">
                          <Select
                            value={reviewDecisionByItem[item.id] || 'pass'}
                            onValueChange={(value: 'pass' | 'revise' | 'reteach') => setReviewDecisionByItem((prev) => ({ ...prev, [item.id]: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pass">{t('staff.teacher.session.review_decision_pass', { defaultValue: 'Pass' })}</SelectItem>
                              <SelectItem value="revise">{t('staff.teacher.session.review_decision_revise', { defaultValue: 'Revise and resubmit' })}</SelectItem>
                              <SelectItem value="reteach">{t('staff.teacher.session.review_decision_reteach', { defaultValue: 'Reteach before continue' })}</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-muted-foreground">
                            {t('staff.teacher.session.review_progression_effect', {
                              defaultValue: 'Decision affects progression: pass → active, revise/reteach → review hold.',
                            })}
                          </p>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={reviewScoreByItem[item.id] ?? ''}
                            onChange={(e) => setReviewScoreByItem((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder={t('staff.teacher.session.review_score_placeholder', { defaultValue: 'Score (0-100), optional' })}
                          />
                          <Textarea
                            rows={2}
                            value={reviewFeedbackByItem[item.id] ?? ''}
                            onChange={(e) => setReviewFeedbackByItem((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder={t('staff.teacher.session.review_feedback_placeholder', { defaultValue: 'Add feedback for this submission' })}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving || !(reviewFeedbackByItem[item.id] || '').trim()}
                            onClick={async () => {
                              setSaving(true);
                              const rawScore = reviewScoreByItem[item.id];
                              const parsedScore = rawScore !== undefined && rawScore !== '' ? Number(rawScore) : null;
                              const reviewRes = await reviewTeacherActionItem(
                                item.id,
                                (reviewFeedbackByItem[item.id] || '').trim(),
                                reviewDecisionByItem[item.id] || 'pass',
                                Number.isFinite(parsedScore as number) ? parsedScore : null,
                              );
                              if (reviewRes.ok) {
                                toast({ title: t('staff.teacher.session.review_saved', { defaultValue: 'Feedback sent to student' }) });
                                setReviewFeedbackByItem((prev) => ({ ...prev, [item.id]: '' }));
                                refreshActionItems();
                              } else {
                                toast({ title: t('staff.teacher.session.review_error', { defaultValue: 'Failed to send feedback' }), variant: 'destructive' });
                              }
                              setSaving(false);
                            }}
                          >
                            {t('staff.teacher.session.mark_reviewed', { defaultValue: 'Mark reviewed' })}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Detail row for read-only view */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-end">{value}</span>
    </div>
  );
}
