/**
 * TeacherStudentDetail — Detailed view of a single student's Russian learning state.
 * Uses teacher permission adapter for action gating.
 */
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTeacherStudentDetail, addTeacherNote } from '@/hooks/useTeacherStudents';
import { PageLoader } from '@/components/ui/PageLoader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, BookOpen, Brain, ClipboardCheck, MessageSquarePlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { TeacherLessonContext } from '@/components/staff/teacher/TeacherLessonContext';
import type { TeacherPermissions } from '@/lib/teacherPermissions';

interface TeacherStudentDetailProps {
  studentUserId: string;
  permissions: TeacherPermissions;
  onBack: () => void;
}

export function TeacherStudentDetail({ studentUserId, permissions, onBack }: TeacherStudentDetailProps) {
  const { t } = useLanguage();
  const { detail, loading, error, refresh } = useTeacherStudentDetail(studentUserId);
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showLessonContext, setShowLessonContext] = useState(false);

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

  const { profile, lessons, vocab, placements, notes } = detail;
  const completedLessons = lessons.filter((l: any) => l.status === 'completed');
  const inProgressLessons = lessons.filter((l: any) => l.status === 'in_progress');
  const masteredVocab = vocab.filter((v: any) => v.mastery === 'mastered');
  const latestPlacement = placements[0] || null;
  const currentLesson = inProgressLessons[0] || completedLessons[0];

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

  const studentName = profile?.full_name || t('staff.teacher.unnamed', { defaultValue: 'Unnamed Student' });

  // If lesson context is expanded, show it full-screen-ish
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
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{studentName}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {profile?.email && <span>{profile.email}</span>}
            {profile?.phone && <span>· {profile.phone}</span>}
          </div>
        </div>
        {profile?.city && (
          <Badge variant="outline">{profile.city}{profile.country ? `, ${profile.country}` : ''}</Badge>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {t('staff.teacher.lessons_progress', { defaultValue: 'Lessons' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{completedLessons.length}</p>
            <p className="text-xs text-muted-foreground">
              {t('staff.teacher.in_progress_count', { defaultValue: '{{count}} in progress', count: inProgressLessons.length })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Brain className="h-4 w-4" />
              {t('staff.teacher.vocabulary', { defaultValue: 'Vocabulary' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{masteredVocab.length}<span className="text-sm font-normal text-muted-foreground">/{vocab.length}</span></p>
            <p className="text-xs text-muted-foreground">{t('staff.teacher.mastered', { defaultValue: 'mastered' })}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              {t('staff.teacher.placement', { defaultValue: 'Placement' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latestPlacement ? (
              <>
                <p className="text-2xl font-bold">{latestPlacement.score}<span className="text-sm font-normal text-muted-foreground">/{latestPlacement.total_questions}</span></p>
                <Badge variant="secondary" className="mt-1">{latestPlacement.result_category}</Badge>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t('staff.teacher.no_placement', { defaultValue: 'Not taken' })}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('staff.teacher.current_position', { defaultValue: 'Current Position' })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{currentLesson?.module_slug || '—'}</p>
            <p className="text-xs text-muted-foreground">{currentLesson?.lesson_slug || '—'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Lesson Context Entry — permission-gated */}
      {currentLesson && permissions.can('can_open_lesson_context') && (
        <TeacherLessonContext
          studentName={studentName}
          studentUserId={studentUserId}
          lessonSlug={currentLesson.lesson_slug}
          moduleSlug={currentLesson.module_slug}
          permissions={permissions}
          onClose={() => setShowLessonContext(false)}
        />
      )}

      {/* Lesson Progress Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('staff.teacher.lesson_history', { defaultValue: 'Lesson History' })}</CardTitle>
        </CardHeader>
        <CardContent>
          {lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('staff.teacher.no_lessons', { defaultValue: 'No lesson progress yet' })}</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {lessons.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{l.lesson_slug}</p>
                    <p className="text-xs text-muted-foreground">{l.module_slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={l.status === 'completed' ? 'default' : 'secondary'}>
                      {l.status}
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

      {/* Teacher Notes — permission-gated */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4" />
            {t('staff.teacher.notes_title', { defaultValue: 'Teacher Notes' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {permissions.can('can_add_teacher_note') && (
            <div className="space-y-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={t('staff.teacher.note_placeholder', { defaultValue: 'Add a note about this student...' })}
                rows={3}
              />
              <Button onClick={handleAddNote} disabled={submitting || !newNote.trim()} size="sm">
                {submitting 
                  ? t('common.submitting', { defaultValue: 'Submitting...' })
                  : t('staff.teacher.add_note', { defaultValue: 'Add Note' })
                }
              </Button>
            </div>
          )}

          {notes.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              {notes.map((n: any) => (
                <div key={n.id} className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm">{n.note}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {notes.length === 0 && !permissions.can('can_add_teacher_note') && (
            <p className="text-sm text-muted-foreground">{t('staff.teacher.no_notes', { defaultValue: 'No notes yet' })}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
