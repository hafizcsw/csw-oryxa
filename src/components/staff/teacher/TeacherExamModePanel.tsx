import { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTeacherExamMode, upsertTeacherExamMode } from '@/hooks/useTeacherOps';
import { toast } from '@/hooks/use-toast';

interface Props {
  studentUserId: string;
}

export function TeacherExamModePanel({ studentUserId }: Props) {
  const { t } = useLanguage();
  const { mode, refresh } = useTeacherExamMode(studentUserId);
  const [examTarget, setExamTarget] = useState(mode?.exam_target || 'TORFL');
  const [examDate, setExamDate] = useState(mode?.exam_date || '');
  const [requiredWeekly, setRequiredWeekly] = useState(mode?.required_sessions_per_week || 5);
  const [dailyCap, setDailyCap] = useState(mode?.daily_target_sessions || 1);

  const countdown = useMemo(() => {
    if (!examDate) return null;
    const diff = Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000);
    return diff;
  }, [examDate]);

  const save = async () => {
    const res = await upsertTeacherExamMode({
      student_user_id: studentUserId,
      exam_target: examTarget,
      exam_date: examDate || null,
      required_sessions_per_week: requiredWeekly,
      daily_target_sessions: dailyCap,
      emergency_catchup_enabled: requiredWeekly >= 5,
    });
    if (res.ok) {
      toast({ title: t('staff.teacher.exam.saved') });
      refresh();
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>{t('staff.teacher.exam.title')}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Input value={examTarget} onChange={(e) => setExamTarget(e.target.value)} placeholder={t('staff.teacher.exam.target')} />
          <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          <Input type="number" min={3} max={7} value={requiredWeekly} onChange={(e) => setRequiredWeekly(Number(e.target.value) || 5)} />
          <Input type="number" min={1} max={2} value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value) || 1)} />
        </div>
        {countdown !== null && <Badge variant={countdown <= 30 ? 'destructive' : 'secondary'}>{t('staff.teacher.exam.countdown', { count: countdown })}</Badge>}
        <Button onClick={save}>{t('staff.teacher.exam.save')}</Button>
      </CardContent>
    </Card>
  );
}
