import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useTeacherOpsSettings, type TeacherType } from '@/hooks/useTeacherOpsSettings';

export function TeacherSettingsPanel() {
  const { t } = useLanguage();
  const { settings, updateSettings } = useTeacherOpsSettings();

  return (
    <div className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('staff.teacher.settings.operating', { defaultValue: 'Operating Profile' })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('staff.teacher.session.teacher_type', { defaultValue: 'Teacher Type' })}</Label>
            <Select value={settings.teacherType} onValueChange={(v) => updateSettings({ teacherType: v as TeacherType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="language_teacher">{t('staff.teacher.type.language_teacher', { defaultValue: 'Language Teacher' })}</SelectItem>
                <SelectItem value="curriculum_exam_teacher">{t('staff.teacher.type.curriculum_exam_teacher', { defaultValue: 'Curriculum/Exam Teacher' })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>{t('staff.teacher.settings.exam_default', { defaultValue: 'Default exam mode' })}</Label>
            <Switch checked={settings.examModeDefault} onCheckedChange={(checked) => updateSettings({ examModeDefault: checked })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('staff.teacher.settings.intensity', { defaultValue: 'Intensity & Workload' })}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t('staff.teacher.settings.required_weekly', { defaultValue: 'Required sessions/week' })}</Label>
            <Input type="number" min={1} max={7} value={settings.requiredSessionsPerWeek} onChange={(e) => updateSettings({ requiredSessionsPerWeek: Number(e.target.value) || 1 })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('staff.teacher.settings.daily_cap', { defaultValue: 'Daily session cap' })}</Label>
            <Input type="number" min={1} max={2} value={settings.dailySessionCap} onChange={(e) => updateSettings({ dailySessionCap: Number(e.target.value) || 1 })} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>{t('staff.teacher.settings.ai_policy', { defaultValue: 'AI recap default policy' })}</Label>
            <Select value={settings.aiRecapDefault} onValueChange={(v) => updateSettings({ aiRecapDefault: v as 'teacher_approval' | 'auto_after_session' | 'blocked' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="teacher_approval">{t('staff.teacher.settings.ai_teacher_approval', { defaultValue: 'Teacher approval required' })}</SelectItem>
                <SelectItem value="auto_after_session">{t('staff.teacher.settings.ai_auto', { defaultValue: 'Auto after completed session' })}</SelectItem>
                <SelectItem value="blocked">{t('staff.teacher.settings.ai_blocked', { defaultValue: 'Blocked by default' })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
