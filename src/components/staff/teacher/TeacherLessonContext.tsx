/**
 * TeacherLessonContext — Teacher-authorized inline lesson viewer.
 * Shows lesson content directly with quick-action buttons.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ExternalLink, Eye, Lock, Unlock, BookOpen, Play, ChevronDown, ChevronUp } from 'lucide-react';
import type { TeacherPermissions } from '@/lib/teacherPermissions';

interface TeacherLessonContextProps {
  studentName: string;
  studentUserId?: string;
  lessonSlug: string;
  moduleSlug: string;
  permissions: TeacherPermissions;
  onClose: () => void;
  lessonStatus?: string;
  currentStep?: string | null;
  attemptCount?: number;
  weakSpots?: string[];
  recapAllowed?: boolean;
  unlocked?: boolean;
}

export function TeacherLessonContext({
  studentName,
  studentUserId,
  lessonSlug,
  moduleSlug,
  permissions,
  onClose,
  lessonStatus,
  currentStep,
  attemptCount,
  weakSpots,
  recapAllowed,
  unlocked,
}: TeacherLessonContextProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const lessonUrl = useMemo(() => {
    const params = new URLSearchParams({ teacher_mode: '1' });
    if (studentUserId) params.set('student_id', studentUserId);
    return `/languages/russian/lessons/${lessonSlug}?${params.toString()}`;
  }, [lessonSlug, studentUserId]);

  if (!permissions.can('can_open_lesson_context')) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {moduleSlug && <span className="text-muted-foreground">{moduleSlug} / </span>}
                {lessonSlug}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="default" size="sm" className="h-7 text-xs gap-1.5" onClick={() => navigate(lessonUrl)}>
              <Play className="h-3 w-3" />
              {t('staff.teacher.open_shared_lesson', { defaultValue: 'Open Lesson' })}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
              <a href={lessonUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 pb-3 px-4 space-y-3">
          <Separator />
          <div className="flex flex-wrap gap-1.5">
            {typeof unlocked === 'boolean' && (
              <Badge variant={unlocked ? 'secondary' : 'destructive'} className="text-[10px]">
                {unlocked ? <Unlock className="h-3 w-3 me-1" /> : <Lock className="h-3 w-3 me-1" />}
                {unlocked
                  ? t('staff.teacher.lesson_unlocked', { defaultValue: 'Unlocked' })
                  : t('staff.teacher.lesson_locked', { defaultValue: 'Locked' })}
              </Badge>
            )}
            {lessonStatus && <Badge variant="secondary" className="text-[10px]">{lessonStatus}</Badge>}
            {currentStep && <Badge variant="outline" className="text-[10px]">{currentStep}</Badge>}
            {typeof attemptCount === 'number' && (
              <Badge variant="outline" className="text-[10px]">
                {t('staff.teacher.attempt_count', { defaultValue: '{{count}} attempts', count: attemptCount })}
              </Badge>
            )}
            {typeof recapAllowed === 'boolean' && (
              <Badge variant={recapAllowed ? 'secondary' : 'destructive'} className="text-[10px]">
                {recapAllowed
                  ? t('staff.teacher.recap_allowed', { defaultValue: 'AI recap allowed' })
                  : t('staff.teacher.recap_blocked', { defaultValue: 'AI recap blocked' })}
              </Badge>
            )}
          </div>

          {weakSpots && weakSpots.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                {t('staff.teacher.weak_spots', { defaultValue: 'Weak spots' })}
              </p>
              <div className="flex flex-wrap gap-1">
                {weakSpots.map((item) => (
                  <Badge key={item} variant="outline" className="text-[10px]">{item}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}