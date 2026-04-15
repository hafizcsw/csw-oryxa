import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTeacherAiFollowups } from '@/hooks/useTeacherOps';

interface Props { studentUserId: string; }

export function TeacherAiFollowupPanel({ studentUserId }: Props) {
  const { t } = useLanguage();
  const { rows } = useTeacherAiFollowups(studentUserId);

  return (
    <Card>
      <CardHeader><CardTitle>{t('staff.teacher.ai_followup.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">{t('staff.teacher.ai_followup.empty')}</p>}
        {rows.map((row) => (
          <div key={row.id} className="border rounded-md p-2 space-y-1">
            <div className="flex gap-2 flex-wrap">
              {row.lesson_slug && <Badge variant="outline">{row.lesson_slug}</Badge>}
              <Badge variant={row.escalation_requested ? 'destructive' : 'secondary'}>
                {row.escalation_requested ? t('staff.teacher.ai_followup.escalated') : t('staff.teacher.ai_followup.normal')}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{row.student_questions.join(' · ') || t('staff.teacher.ai_followup.no_questions')}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
