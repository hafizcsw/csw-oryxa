import { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { createTeacherPlan, useTeacherPlans } from '@/hooks/useTeacherOps';
import { getRussianCurriculumModules } from '@/lib/teacherCurriculum';
import { toast } from '@/hooks/use-toast';

interface Props {
  studentUserId: string;
  teacherType: 'language_teacher' | 'curriculum_exam_teacher';
}

const PLAN_TYPES = ['weekly_plan', 'monthly_plan', 'intensive_plan', 'exam_sprint_plan', 'catch_up_plan', 'custom_plan'] as const;

export function TeacherPlanBuilder({ studentUserId, teacherType }: Props) {
  const { t } = useLanguage();
  const { plans, refresh } = useTeacherPlans(studentUserId);
  const modules = useMemo(() => getRussianCurriculumModules(), []);
  const [planType, setPlanType] = useState<(typeof PLAN_TYPES)[number]>(teacherType === 'curriculum_exam_teacher' ? 'exam_sprint_plan' : 'weekly_plan');
  const [title, setTitle] = useState('');
  const [targetModule, setTargetModule] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedLessons = useMemo(() => modules.find((mod) => mod.slug === targetModule)?.lessons.map((l) => l.slug) || [], [modules, targetModule]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const res = await createTeacherPlan({
      student_user_id: studentUserId,
      teacher_type: teacherType,
      plan_type: planType,
      title: title.trim(),
      target_lessons: selectedLessons,
      homework_payload: selectedLessons.slice(0, 3),
      checkpoint_payload: selectedLessons.slice(-1),
      ai_policy: { recap_release: 'teacher_approval' },
    });
    if (res.ok) {
      toast({ title: t('staff.teacher.plan.created') });
      setTitle('');
      refresh();
    } else {
      toast({ title: t('staff.teacher.plan.create_error'), variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('staff.teacher.plan.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('staff.teacher.plan.title_placeholder')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Select value={planType} onValueChange={(v) => setPlanType(v as (typeof PLAN_TYPES)[number])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLAN_TYPES.map((item) => <SelectItem key={item} value={item}>{t(`staff.teacher.plan.type.${item}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={targetModule} onValueChange={setTargetModule}>
            <SelectTrigger><SelectValue placeholder={t('staff.teacher.plan.target_module')} /></SelectTrigger>
            <SelectContent>
              {modules.map((module) => <SelectItem key={module.slug} value={module.slug}>{t(module.titleKey)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button disabled={saving || !title.trim()} onClick={handleCreate}>{t('staff.teacher.plan.create')}</Button>

        <div className="space-y-2">
          {plans.map((plan) => (
            <div key={plan.id} className="border rounded-md p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{plan.title}</p>
                <Badge variant="outline">{t(`staff.teacher.plan.type.${plan.plan_type}`)}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t('staff.teacher.plan.target_count', { count: plan.target_lessons?.length || 0 })}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
