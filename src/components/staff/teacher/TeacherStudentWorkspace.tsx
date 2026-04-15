/**
 * TeacherStudentWorkspace — Full teaching workspace for a single student.
 * Replaces old flat detail view with operational teacher surface.
 */
import { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTeacherStudentDetail, addTeacherNote, setTeacherExamDecision } from '@/hooks/useTeacherStudents';
import { resolveSharedExamTruth } from '@/lib/examTruth';
import { PageLoader } from '@/components/ui/PageLoader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { TeacherLessonContext } from '@/components/staff/teacher/TeacherLessonContext';
import { TeacherActionReflection } from '@/components/staff/teacher/TeacherActionReflection';
import { TeacherProgressionControls } from '@/components/staff/teacher/TeacherProgressionControls';
import type { TeacherPermissions } from '@/lib/teacherPermissions';
import { resolveCurriculumPosition } from '@/lib/teacherCurriculum';
import {
  ArrowLeft, BookOpen, Brain, ClipboardCheck, MessageSquarePlus,
  Eye, Plus, Calendar, AlertTriangle, CheckCircle2,
  TrendingUp, Clock, Flag, ExternalLink, Zap,
  GraduationCap, Target, Send, ShieldAlert, Rocket
} from 'lucide-react';

interface Props {
  studentUserId: string;
  permissions: TeacherPermissions;
  onBack: () => void;
  onCreateSession?: (studentUserId: string) => void;
  onSelectSession?: (sessionId: string) => void;
  sessions?: any[];
}

export function TeacherStudentWorkspace({ studentUserId, permissions, onBack, onCreateSession, onSelectSession, sessions = [] }: Props) {
  const { t } = useLanguage();
  const { detail, loading, error, refresh } = useTeacherStudentDetail(studentUserId);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showLessonContext, setShowLessonContext] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  if (!permissions.can('can_view_student_detail')) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t('staff.teacher.no_permission', { defaultValue: 'You do not have permission to view this.' })}
        <Button variant="outline" onClick={onBack} className="mt-4 block mx-auto">
          <ArrowLeft className="h-4 w-4 me-2" />
          {t('common.back', { defaultValue: 'Back' })}
        </Button>
      </div>
    );
  }

  if (loading) return <PageLoader />;
  if (error || !detail) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{error || t('staff.teacher.detail_error', { defaultValue: 'Failed to load student details' })}</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ArrowLeft className="h-4 w-4 me-2" />
          {t('common.back', { defaultValue: 'Back' })}
        </Button>
      </div>
    );
  }

  const { profile, courseState, lessons, vocab, placements, notes } = detail;
  const completedLessons = lessons.filter((l: any) => l.status === 'completed');
  const inProgressLessons = lessons.filter((l: any) => l.status === 'in_progress');
  const masteredVocab = vocab.filter((v: any) => v.mastery === 'mastered');
  const latestPlacement = placements[0] || null;
  const totalStudySeconds: number = (detail as any).totalStudySeconds || 0;
  const currentLesson = inProgressLessons[0] || completedLessons[completedLessons.length - 1];
  
  // Resolve current position from multiple sources: lesson progress > courseState
  const resolvedModuleSlug = currentLesson?.module_slug || courseState?.current_module_slug || profile?.current_module || null;
  const resolvedLessonSlug = currentLesson?.lesson_slug || courseState?.current_lesson_slug || profile?.current_lesson || null;
  
  const curriculumPosition = resolveCurriculumPosition({
    moduleSlug: resolvedModuleSlug,
    lessonSlug: resolvedLessonSlug,
    completedLessonSlugs: completedLessons.map((lesson: any) => lesson.lesson_slug),
  });
  const studentName = profile?.full_name || t('staff.teacher.unnamed', { defaultValue: 'Unnamed Student' });
  
  // Resolve activity status from courseState
  const lastActivity = courseState?.last_student_activity_at || null;
  const isActive = lastActivity && (Date.now() - new Date(lastActivity).getTime()) < 3 * 86400000;

  // Attendance from student sessions
  const studentSessions = sessions.filter((s: any) =>
    s.students?.some((st: any) => st?.student_user_id === studentUserId)
  );
  const attendedCount = studentSessions.filter((s: any) =>
    s.students?.find((st: any) => st?.student_user_id === studentUserId)?.attendance_status === 'attended'
  ).length;
  const totalSessionCount = studentSessions.length;

  // Progress percentage
  const totalLessons = lessons.length;
  const progressPct = totalLessons > 0 ? Math.round((completedLessons.length / Math.max(totalLessons, 1)) * 100) : 0;
  const vocabPct = vocab.length > 0 ? Math.round((masteredVocab.length / vocab.length) * 100) : 0;

  // Readiness assessment
  const readinessSignals = {
    hasPlacement: !!latestPlacement,
    placementCategory: latestPlacement?.result_category || null,
    lessonsCompleted: completedLessons.length,
    vocabMastery: vocabPct,
    isActive: isActive || (profile?.latest_activity
      ? (Date.now() - new Date(profile.latest_activity).getTime()) < 14 * 24 * 60 * 60 * 1000
      : false),
  };
  const examNotices = detail.examNotices || [];
  const releasedLessons = detail.releasedLessons || [];
  const taughtLessons = detail.taughtLessons || [];
  const examTruth = resolveSharedExamTruth({
    examNotices,
    releasedLessonSlugs: releasedLessons.map((lesson: any) => lesson.lesson_slug).filter(Boolean),
    taughtLessonSlugs: taughtLessons,
    nextTeacherDecision: detail.courseState?.next_teacher_decision,
  });
  const latestExam = examTruth.latestResult;
  const nextExam = examTruth.nextExam;
  const examCoverage = examTruth.coverage;
  const examRecoveryState = examTruth.recoveryState;

  const handleQuickTaggedAction = async (tag: string, body: string) => {
    if (!permissions.can('can_add_teacher_note')) return;
    setSubmitting(true);
    try {
      const res = await addTeacherNote(studentUserId, `[${tag}] ${body}`);
      if (res.ok) {
        toast({ title: t('staff.teacher.note_added', { defaultValue: 'Note added' }) });
        refresh();
      } else {
        toast({ title: t('staff.teacher.note_error', { defaultValue: 'Failed to add note' }), variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !permissions.can('can_add_teacher_note')) return;
    setSubmitting(true);
    try {
      const res = await addTeacherNote(studentUserId, newNote.trim());
      if (res.ok) {
        toast({ title: t('staff.teacher.note_added', { defaultValue: 'Note added' }) });
        setNewNote('');
        refresh();
      } else {
        toast({ title: t('staff.teacher.note_error', { defaultValue: 'Failed to add note' }), variant: 'destructive' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Full-screen lesson context
  if (showLessonContext && currentLesson) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setShowLessonContext(false)}>
          <ArrowLeft className="h-4 w-4 me-2" />
          {t('staff.teacher.back_to_detail', { defaultValue: 'Back to student detail' })}
        </Button>
        <TeacherLessonContext
          studentName={studentName}
          studentUserId={studentUserId}
          lessonSlug={currentLesson.lesson_slug}
          moduleSlug={currentLesson.module_slug}
          permissions={permissions}
          onClose={() => setShowLessonContext(false)}
          lessonStatus={currentLesson.status}
          currentStep={currentLesson.current_step || null}
          attemptCount={currentLesson.attempt_count || 0}
          weakSpots={currentLesson.weak_spots || []}
          recapAllowed={currentLesson.ai_recap_allowed !== false}
          unlocked={curriculumPosition.unlockedLessonSlugs.includes(currentLesson.lesson_slug)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Student Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1 shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold">{studentName}</h2>
            {!readinessSignals.isActive && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 me-1" />
                {t('staff.teacher.inactive', { defaultValue: 'Inactive' })}
              </Badge>
            )}
            {readinessSignals.hasPlacement && (
              <Badge variant="outline" className="text-xs">
                {readinessSignals.placementCategory}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            {profile?.email && <span>{profile.email}</span>}
            {profile?.phone && <span>· {profile.phone}</span>}
            {profile?.city && <span>· {profile.city}</span>}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          {currentLesson && permissions.can('can_open_lesson_context') && (
            <Button variant="outline" size="sm" onClick={() => setShowLessonContext(true)}>
              <Eye className="h-4 w-4 me-1.5" />
              {t('staff.teacher.open_lesson', { defaultValue: 'Open Lesson' })}
            </Button>
          )}
          {onCreateSession && permissions.can('can_create_session') && (
            <Button variant="default" size="sm" onClick={() => onCreateSession(studentUserId)}>
              <Plus className="h-4 w-4 me-1.5" />
              {t('staff.teacher.create_session_for', { defaultValue: 'New Session' })}
            </Button>
          )}
          {permissions.can('can_add_teacher_note') && (
            <Button
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => handleQuickTaggedAction('assign_homework', t('staff.teacher.quick_homework_default', { defaultValue: 'Homework assigned from current lesson' }))}
            >
              <Send className="h-4 w-4 me-1.5" />
              {t('staff.teacher.assign_homework', { defaultValue: 'Assign Homework' })}
            </Button>
          )}
          {permissions.can('can_add_teacher_note') && (
            <Button
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => handleQuickTaggedAction('intervention_needed', t('staff.teacher.quick_intervention_default', { defaultValue: 'Intervention flagged from teacher workspace' }))}
            >
              <ShieldAlert className="h-4 w-4 me-1.5" />
              {t('staff.teacher.mark_intervention', { defaultValue: 'Mark Intervention' })}
            </Button>
          )}
          {permissions.can('can_add_teacher_note') && (
            <Button
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => handleQuickTaggedAction('exam_mode', t('staff.teacher.quick_exam_default', { defaultValue: 'Exam mode escalation requested' }))}
            >
              <Rocket className="h-4 w-4 me-1.5" />
              {t('staff.teacher.switch_exam_mode', { defaultValue: 'Switch to Exam Mode' })}
            </Button>
          )}
        </div>
      </div>

      {/* Key Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard
          icon={<BookOpen className="h-4 w-4" />}
          label={t('staff.teacher.lessons_progress', { defaultValue: 'Lessons' })}
          value={`${completedLessons.length}/${totalLessons}`}
          sub={<Progress value={progressPct} className="h-1.5 mt-1" />}
        />
        <MetricCard
          icon={<Clock className="h-4 w-4" />}
          label={t('staff.teacher.study_time', { defaultValue: 'Study Time' })}
          value={totalStudySeconds >= 3600
            ? `${Math.floor(totalStudySeconds / 3600)}h ${Math.round((totalStudySeconds % 3600) / 60)}m`
            : `${Math.round(totalStudySeconds / 60)}m`
          }
          sub={<span className="text-xs text-muted-foreground">{t('staff.teacher.self_practice', { defaultValue: 'Self practice' })}</span>}
        />
        <MetricCard
          icon={<Brain className="h-4 w-4" />}
          label={t('staff.teacher.vocabulary', { defaultValue: 'Vocabulary' })}
          value={`${masteredVocab.length}/${vocab.length}`}
          sub={<Progress value={vocabPct} className="h-1.5 mt-1" />}
        />
        <MetricCard
          icon={<Calendar className="h-4 w-4" />}
          label={t('staff.teacher.attendance_label', { defaultValue: 'Attendance' })}
          value={totalSessionCount > 0 ? `${attendedCount}/${totalSessionCount}` : '—'}
          sub={totalSessionCount > 0 && (
            <Progress value={Math.round((attendedCount / totalSessionCount) * 100)} className="h-1.5 mt-1" />
          )}
        />
      </div>

      {/* Current Position Bar */}
      <Card className="bg-muted/30">
        <CardContent className="py-3 px-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{currentLesson?.module_slug || '—'}</span>
            <span className="text-xs text-muted-foreground">/ {currentLesson?.lesson_slug || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Flag className="h-3.5 w-3.5" />
            {curriculumPosition.absoluteIndex >= 0
              ? `${curriculumPosition.absoluteIndex + 1}/${curriculumPosition.totalLessons}`
              : '—'}
            {latestPlacement && (
              <Badge variant="secondary" className="text-xs ms-2">{latestPlacement.result_category}</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Workspace Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <TrendingUp className="h-3.5 w-3.5 me-1.5" />
            {t('staff.teacher.tab_progress', { defaultValue: 'Progress' })}
          </TabsTrigger>
          <TabsTrigger value="notes" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <MessageSquarePlus className="h-3.5 w-3.5 me-1.5" />
            {t('staff.teacher.notes_title', { defaultValue: 'Notes' })}
            {notes.length > 0 && <Badge variant="secondary" className="text-xs ms-1.5 px-1.5 py-0 h-5">{notes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="sessions" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Calendar className="h-3.5 w-3.5 me-1.5" />
            {t('staff.teacher.session.tab_sessions', { defaultValue: 'Sessions' })}
            {studentSessions.length > 0 && <Badge variant="secondary" className="text-xs ms-1.5 px-1.5 py-0 h-5">{studentSessions.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="vocab" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Brain className="h-3.5 w-3.5 me-1.5" />
            {t('staff.teacher.vocabulary', { defaultValue: 'Vocabulary' })}
          </TabsTrigger>
          <TabsTrigger value="exam" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <ShieldAlert className="h-3.5 w-3.5 me-1.5" />
            {t('staff.teacher.exam_workflow', { defaultValue: 'Exam Workflow' })}
          </TabsTrigger>
        </TabsList>

        {/* Progress Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Teacher Progression Controls — Release/Lock/Review lessons */}
          <TeacherProgressionControls studentUserId={studentUserId} />

          {/* Action Reflection — student completion status */}
          <TeacherActionReflection studentUserId={studentUserId} onSelectSession={onSelectSession} />

          {/* Readiness indicator — compact */}
          {!readinessSignals.isActive && (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="py-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <p className="text-sm text-destructive">
                    {t('staff.teacher.readiness_inactive', { defaultValue: 'Student has been inactive — may need follow-up' })}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lesson Context Quick Access */}
          {currentLesson && permissions.can('can_open_lesson_context') && (
            <TeacherLessonContext
              studentName={studentName}
              studentUserId={studentUserId}
              lessonSlug={currentLesson.lesson_slug}
              moduleSlug={currentLesson.module_slug}
              permissions={permissions}
              onClose={() => {}}
            />
          )}

          {/* Lesson History */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                {t('staff.teacher.lesson_history', { defaultValue: 'Lesson History' })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  {t('staff.teacher.no_lessons', { defaultValue: 'No lesson progress yet' })}
                </p>
              ) : (
                <div className="space-y-1 max-h-[320px] overflow-y-auto">
                  {lessons.map((l: any, i: number) => (
                    <div key={l.id || i} className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${l.status === 'completed' ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                        <div>
                          <p className="text-sm font-medium">{l.lesson_slug}</p>
                          <p className="text-xs text-muted-foreground">{l.module_slug}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {l.study_time_seconds > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {l.study_time_seconds >= 3600
                              ? `${Math.floor(l.study_time_seconds / 3600)}h ${Math.round((l.study_time_seconds % 3600) / 60)}m`
                              : `${Math.round(l.study_time_seconds / 60)}m`}
                          </span>
                        )}
                        <Badge variant={l.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                          {t(`staff.teacher.lesson_status_${l.status}`, { defaultValue: l.status })}
                        </Badge>
                        {l.completed_at && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(l.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-4 mt-4">
          {permissions.can('can_add_teacher_note') && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={t('staff.teacher.note_placeholder', { defaultValue: 'Add a note about this student...' })}
                  rows={3}
                />
                <Button onClick={handleAddNote} disabled={submitting || !newNote.trim()} size="sm">
                  <MessageSquarePlus className="h-4 w-4 me-1.5" />
                  {submitting
                    ? t('common.submitting', { defaultValue: 'Submitting...' })
                    : t('staff.teacher.add_note', { defaultValue: 'Add Note' })
                  }
                </Button>
              </CardContent>
            </Card>
          )}

          {notes.length > 0 ? (
            <div className="space-y-3">
              {notes.map((n: any) => (
                <Card key={n.id} className="bg-muted/30">
                  <CardContent className="py-3">
                    <p className="text-sm">{n.note}</p>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('staff.teacher.no_notes', { defaultValue: 'No notes yet' })}
            </p>
          )}
        </TabsContent>

        <TabsContent value="sessions" className="space-y-3 mt-4">
          {/* Last session follow-up indicator */}
          {studentSessions.length > 0 && (() => {
            const lastCompleted = studentSessions.find((s: any) => s.status === 'completed');
            if (lastCompleted?.next_action) {
              return (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">
                        {t('staff.teacher.session.follow_up_from_last', { defaultValue: 'Follow-up from last session:' })}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {t(`staff.teacher.session.action_${lastCompleted.next_action}`, { defaultValue: lastCompleted.next_action.replace(/_/g, ' ') })}
                      </Badge>
                    </div>
                    {lastCompleted.summary && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{lastCompleted.summary}</p>
                    )}
                  </CardContent>
                </Card>
              );
            }
            return null;
          })()}

          {studentSessions.length > 0 ? (
            studentSessions.map((s: any) => {
              const studentEntry = s.students?.find((st: any) => st?.student_user_id === studentUserId);
              return (
                <Card
                  key={s.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onSelectSession?.(s.id)}
                >
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {t(`staff.teacher.session.type_${s.session_type}`, { defaultValue: s.session_type?.replace(/_/g, ' ') || '—' })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.module_slug}{s.lesson_slug && ` / ${s.lesson_slug}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {studentEntry && (
                          <Badge variant={studentEntry.attendance_status === 'attended' ? 'default' : 'secondary'} className="text-xs">
                            {t(`staff.teacher.session.attendance_${studentEntry.attendance_status}`, { defaultValue: studentEntry.attendance_status })}
                          </Badge>
                        )}
                        <Badge variant={s.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                          {t(`staff.teacher.session.status_${s.status}`, { defaultValue: s.status })}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(s.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {/* Show outcome preview */}
                    {s.status === 'completed' && s.next_action && (
                      <div className="mt-2">
                        <Badge variant="outline" className="text-xs">
                          {t('staff.teacher.session.next_action_prefix', { defaultValue: 'Next:' })} {t(`staff.teacher.session.action_${s.next_action}`, { defaultValue: s.next_action.replace(/_/g, ' ') })}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-3">
                {t('staff.teacher.no_student_sessions', { defaultValue: 'No sessions with this student yet' })}
              </p>
              {onCreateSession && permissions.can('can_create_session') && (
                <Button variant="outline" size="sm" onClick={() => onCreateSession(studentUserId)}>
                  <Plus className="h-4 w-4 me-1.5" />
                  {t('staff.teacher.create_session_for', { defaultValue: 'New Session' })}
                </Button>
              )}
            </div>
          )}
        </TabsContent>

        {/* Vocabulary Tab */}
        <TabsContent value="vocab" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="text-center">
              <CardContent className="py-4">
                <p className="text-2xl font-bold text-primary">{masteredVocab.length}</p>
                <p className="text-xs text-muted-foreground">{t('staff.teacher.mastered', { defaultValue: 'Mastered' })}</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="py-4">
                <p className="text-2xl font-bold">{vocab.filter((v: any) => v.mastery === 'learning').length}</p>
                <p className="text-xs text-muted-foreground">{t('staff.teacher.learning', { defaultValue: 'Learning' })}</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="py-4">
                <p className="text-2xl font-bold text-muted-foreground">{vocab.filter((v: any) => v.mastery === 'new' || !v.mastery).length}</p>
                <p className="text-xs text-muted-foreground">{t('staff.teacher.new_words', { defaultValue: 'New' })}</p>
              </CardContent>
            </Card>
          </div>

          {vocab.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('staff.teacher.recent_vocab', { defaultValue: 'Recent Vocabulary' })}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 max-h-[240px] overflow-y-auto">
                  {vocab.slice(0, 50).map((v: any, i: number) => (
                    <Badge
                      key={v.id || i}
                      variant={v.mastery === 'mastered' ? 'default' : v.mastery === 'learning' ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {v.word || v.term || `#${i + 1}`}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="exam" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                {t('staff.teacher.exam_truth', { defaultValue: 'Weekly Exam Truth' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <MetricCard icon={<Target className="h-4 w-4" />} label={t('staff.teacher.next_exam', { defaultValue: 'Next exam' })} value={nextExam?.title || '—'} />
                <MetricCard icon={<TrendingUp className="h-4 w-4" />} label={t('staff.teacher.latest_result', { defaultValue: 'Latest result' })} value={latestExam?.score != null ? `${latestExam.score}%` : '—'} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('staff.teacher.covered_lessons', { defaultValue: 'Covered lessons (released + taught)' })}</p>
                <p className="text-sm font-medium text-foreground mt-1">{examCoverage.length ? examCoverage.join(', ') : '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t('staff.teacher.recovery_state', { defaultValue: 'Recovery state' })}: {examRecoveryState}</Badge>
                {profile?.current_lesson && <Badge variant="secondary">{t('staff.teacher.current_lesson', { defaultValue: 'Current' })}: {profile.current_lesson}</Badge>}
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={async () => {
                  const res = await setTeacherExamDecision(studentUserId, 'recovery', `coverage=${examCoverage.join('|')}`);
                  if (res.ok) { toast({ title: t('staff.teacher.exam_decision_saved', { defaultValue: 'Exam recovery decision saved' }) }); refresh(); }
                }}>
                  {t('staff.teacher.exam_recovery', { defaultValue: 'Set Recovery' })}
                </Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  const res = await setTeacherExamDecision(studentUserId, 'retake', `coverage=${examCoverage.join('|')}`);
                  if (res.ok) { toast({ title: t('staff.teacher.exam_decision_saved', { defaultValue: 'Exam retake decision saved' }) }); refresh(); }
                }}>
                  {t('staff.teacher.exam_retake', { defaultValue: 'Set Retake' })}
                </Button>
                <Button size="sm" onClick={async () => {
                  const res = await setTeacherExamDecision(studentUserId, 'proceed', `coverage=${examCoverage.join('|')}`);
                  if (res.ok) { toast({ title: t('staff.teacher.exam_decision_saved', { defaultValue: 'Exam proceed decision saved' }) }); refresh(); }
                }}>
                  {t('staff.teacher.exam_proceed', { defaultValue: 'Proceed' })}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Small metric card used in the strip */
function MetricCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="text-lg font-bold leading-tight">{value}</p>
        {sub}
      </CardContent>
    </Card>
  );
}
